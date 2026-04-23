from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import gzip
import io

from .database import SessionLocal, engine, get_db
from .models import Base, PDFFile, Annotation, StudyCard, CardReview, ReviewSession, Image
from .schemas import (
    PDFFileResponse,
    PDFFileMetadataUpdate,
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    FileUploadResponse,
    ZoomLevelUpdate,
    ReadPositionUpdate,
    TotalPagesUpdate,
    ImageCreate,
    ImageResponse,
    ImageUploadResponse,
    StudyCardCreate,
    StudyCardResponse,
    StudyCardUpdate,
    CardReviewCreate,
    CardReviewResponse,
    CardReviewResult,
    ReviewSessionCreate,
    ReviewSessionResponse,
    DueCardsResponse,
    ReviewOptions,
    TimelineResponse,
    CardTimeline,
    TimelinePoint,
    DashboardStats,
    LibraryRefreshResponse,
)
from .spaced_repetition import SpacedRepetitionService
from . import gemini as gemini_client
from .utils import (
    calculate_file_hash_from_bytes,
    is_pdf_file,
    get_file_mime_type,
    generate_unique_filename,
    save_uploaded_file,
    validate_file_size,
    ensure_upload_dir,
    strip_file_extension,
)

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)


def _migrate_study_card_cloze_index() -> None:
    """Idempotent migration: add study_cards.cloze_index + swap unique constraint.

    The original schema carried `UniqueConstraint('annotation_id')` so each
    annotation had exactly one card. The cloze redesign creates one card per
    [[word]] blank, keyed on (annotation_id, cloze_index). SQLite can't drop a
    table-level UNIQUE constraint in place, so when the old constraint is
    detected we rebuild the table. `create_all` plus a stray
    `CREATE UNIQUE INDEX IF NOT EXISTS` covers fresh databases.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "study_cards" not in insp.get_table_names():
        return

    with engine.begin() as conn:
        ddl_row = conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='study_cards'"
        )).first()
        table_sql = (ddl_row[0] if ddl_row else "") or ""

        # The old constraint text is the table-level form SQLAlchemy emits.
        # Presence means we must rebuild; absence means the table is already
        # on the new shape (or was created fresh by create_all).
        has_legacy_unique = "UNIQUE (annotation_id)" in table_sql

        if has_legacy_unique:
            # Rebuild: copy rows into a correctly-shaped temp table, swap names.
            # FKs are deferred so the copy doesn't trip on card_reviews.card_id.
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            conn.execute(text("DROP TABLE IF EXISTS study_cards_new"))
            conn.execute(text(
                """
                CREATE TABLE study_cards_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    annotation_id INTEGER NOT NULL,
                    cloze_index INTEGER NOT NULL DEFAULT 0,
                    difficulty FLOAT,
                    stability FLOAT,
                    elapsed_days INTEGER,
                    scheduled_days INTEGER,
                    reps INTEGER,
                    lapses INTEGER,
                    state VARCHAR,
                    last_review DATETIME,
                    created_date DATETIME DEFAULT (CURRENT_TIMESTAMP),
                    due DATETIME,
                    CONSTRAINT uq_study_card_annotation_cloze
                        UNIQUE (annotation_id, cloze_index),
                    FOREIGN KEY(annotation_id)
                        REFERENCES annotations (id) ON DELETE CASCADE
                )
                """
            ))
            conn.execute(text(
                """
                INSERT INTO study_cards_new (
                    id, annotation_id, cloze_index, difficulty, stability,
                    elapsed_days, scheduled_days, reps, lapses, state,
                    last_review, created_date, due
                )
                SELECT id, annotation_id, 0, difficulty, stability,
                       elapsed_days, scheduled_days, reps, lapses, state,
                       last_review, created_date, due
                FROM study_cards
                """
            ))
            conn.execute(text("DROP TABLE study_cards"))
            conn.execute(text("ALTER TABLE study_cards_new RENAME TO study_cards"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_study_cards_id ON study_cards (id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_study_cards_annotation_id "
                "ON study_cards (annotation_id)"
            ))
            conn.execute(text("PRAGMA foreign_keys=ON"))
        else:
            # Fresh table from create_all (or already rebuilt). Make sure the
            # expected column + composite unique index exist.
            cols = {c["name"] for c in insp.get_columns("study_cards")}
            if "cloze_index" not in cols:
                conn.execute(text(
                    "ALTER TABLE study_cards ADD COLUMN cloze_index INTEGER NOT NULL DEFAULT 0"
                ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_study_card_annotation_cloze "
                "ON study_cards (annotation_id, cloze_index)"
            ))


_migrate_study_card_cloze_index()


def _migrate_pdf_file_title() -> None:
    """Idempotent: add pdf_files.title column if missing.

    Populated by Gemini enrichment and/or the webapp's pdfjs metadata path.
    Older rows stay NULL; display layer falls back to original_filename.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "pdf_files" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("pdf_files")}
    if "title" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE pdf_files ADD COLUMN title VARCHAR"))


_migrate_pdf_file_title()


app = FastAPI(
    title="PDF Annotation API",
    description="Backend API for PDF annotation and note-taking",
    version="1.0.0",
)

# CORS middleware — allow localhost dev and production origins
_cors_origins = ["http://localhost:3000", "http://localhost:8000"]
_extra_origins = os.getenv("CORS_ORIGINS", "")
if _extra_origins:
    _cors_origins.extend([o.strip() for o in _extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
IMAGES_DIR = os.path.join(UPLOAD_DIR, "images")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "50000000"))  # 50MB
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", "10000000"))  # 10MB

# Ensure upload directories exist
ensure_upload_dir(UPLOAD_DIR)
ensure_upload_dir(IMAGES_DIR)


# Simple GZip middleware for compression
class GZipMiddleware:
    def __init__(self, app, minimum_size: int = 500):
        self.app = app
        self.minimum_size = minimum_size

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Check if client accepts gzip
            headers = dict(scope.get("headers", []))
            accept_encoding = headers.get(b"accept-encoding", b"").decode()
            
            # Skip compression for file downloads and images to avoid streaming issues
            path = scope.get("path", "")
            if path and ("/download" in path or "/images/" in path):
                await self.app(scope, receive, send)
                return

            if "gzip" in accept_encoding:
                # Create compressing send wrapper
                compressing_send = CompressingSend(send, self.minimum_size)
                await self.app(scope, receive, compressing_send)
                return

        await self.app(scope, receive, send)


class CompressingSend:
    def __init__(self, send, minimum_size: int):
        self.send = send
        self.minimum_size = minimum_size
        self.initial_message = None
        self.started = False

    async def __call__(self, message):
        message_type = message["type"]

        if message_type == "http.response.start":
            self.initial_message = message

        elif message_type == "http.response.body" and not self.started:
            self.started = True
            body = message.get("body", b"")
            more_body = message.get("more_body", False)

            if len(body) < self.minimum_size and not more_body:
                # Don't compress small responses
                await self.send(self.initial_message)
                await self.send(message)
            else:
                # Compress the body
                compressed_body = gzip.compress(body)

                # Update headers properly
                headers = list(self.initial_message.get("headers", []))

                # Remove existing content-length header (let HTTP use chunked transfer)
                headers = [h for h in headers if h[0].lower() != b"content-length"]

                # Add compression headers
                headers.append((b"content-encoding", b"gzip"))
                # Don't set Content-Length - let HTTP handle chunked transfer encoding

                # Add vary header if not present
                has_vary = any(h[0].lower() == b"vary" for h in headers)
                if not has_vary:
                    headers.append((b"vary", b"Accept-Encoding"))

                # Update the message
                self.initial_message["headers"] = headers
                message["body"] = compressed_body

                await self.send(self.initial_message)
                await self.send(message)
        else:
            await self.send(message)


# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=500)


# Custom exception handlers for better debugging
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"❌ Validation error on {request.method} {request.url}")
    print(f"   Errors: {exc.errors()}")
    print(f"   Body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "message": "Validation failed - check request data format",
        },
    )


@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    print(f"❌ Pydantic validation error on {request.method} {request.url}")
    print(f"   Errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "message": "Data validation failed"},
    )


@app.get("/")
async def root():
    return {"message": "PDF Annotation API is running"}


def _enrich_file_metadata_task(file_id: int, pdf_bytes: bytes) -> None:
    """Background task: run Gemini extraction and persist results.

    Fills in title/author/excerpt only if the row doesn't already have that
    field (treating user / pdfjs-supplied values as authoritative). Uses its
    own SessionLocal because the request-scoped session is already closed
    by the time FastAPI runs the task.
    """
    if not gemini_client.is_configured():
        return
    meta = gemini_client.extract_pdf_metadata(pdf_bytes)
    if not meta:
        return

    session = SessionLocal()
    try:
        file = session.query(PDFFile).filter(PDFFile.id == file_id).first()
        if not file:
            return
        touched = False
        if meta.get("title") and not file.title:
            file.title = meta["title"]
            touched = True
        if meta.get("author") and not file.author:
            file.author = meta["author"]
            touched = True
        if meta.get("excerpt") and not file.excerpt:
            file.excerpt = meta["excerpt"]
            touched = True
        if touched:
            session.commit()
            print(
                f"✨ Gemini enriched file_id={file_id}: "
                f"title={file.title!r} author={file.author!r}"
            )
    except Exception as e:
        session.rollback()
        print(f"❌ Gemini enrichment DB write failed for file_id={file_id}: {e}")
    finally:
        session.close()


def _refresh_file_metadata_task(file_id: int, force: bool) -> None:
    """Background task: re-read a PDF from disk and re-run Gemini.

    If `force` is False, only null fields are filled. If True, Gemini's output
    overwrites whatever is there (still skipping when Gemini itself returns
    None for a field).
    """
    if not gemini_client.is_configured():
        return

    session = SessionLocal()
    try:
        file = session.query(PDFFile).filter(PDFFile.id == file_id).first()
        if not file or not file.file_path or not os.path.exists(file.file_path):
            return
        with open(file.file_path, "rb") as f:
            pdf_bytes = f.read()
        meta = gemini_client.extract_pdf_metadata(pdf_bytes)
        if not meta:
            return

        touched = False
        for field in ("title", "author", "excerpt"):
            new_val = meta.get(field)
            if not new_val:
                continue
            if force or not getattr(file, field):
                setattr(file, field, new_val)
                touched = True
        if touched:
            session.commit()
            print(f"♻️  Refreshed metadata for file_id={file_id} (force={force})")
    except Exception as e:
        session.rollback()
        print(f"❌ Refresh failed for file_id={file_id}: {e}")
    finally:
        session.close()


@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF file with deduplication.
    If file already exists (same hash), return existing file info.
    """
    try:
        # Validate file type
        print(f"🔍 Validating file: {file.filename}")
        if not is_pdf_file(file.filename):
            print(f"❌ File rejected: Not a PDF file")
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        # Read file content
        file_content = await file.read()

        # File size validation removed - allow any size
        print(f"📄 File info: {file.filename}, size: {len(file_content)} bytes")

        # Calculate file hash
        file_hash = calculate_file_hash_from_bytes(file_content)

        # Check for existing file with same hash
        existing_file = db.query(PDFFile).filter(PDFFile.file_hash == file_hash).first()

        if existing_file:
            # Update last accessed time
            existing_file.last_accessed = datetime.utcnow()
            db.commit()

            return FileUploadResponse(
                success=True,
                message="File already exists, opening existing file",
                file_data=PDFFileResponse.from_orm(existing_file),
                is_duplicate=True,
            )

        # Generate unique filename
        unique_filename = generate_unique_filename(file.filename, file_hash)

        # Save file to disk
        file_path = save_uploaded_file(file_content, UPLOAD_DIR, unique_filename)

        # Create database record
        db_file = PDFFile(
            filename=unique_filename,
            original_filename=file.filename,
            file_hash=file_hash,
            file_size=len(file_content),
            file_path=file_path,
            mime_type=get_file_mime_type(file.filename),
        )

        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        # Kick Gemini enrichment after the response is sent. The pdfjs path
        # in the webapp may PATCH /files/{id}/metadata first with its own
        # author/excerpt; the task only fills fields still null at write time.
        if gemini_client.is_configured():
            background_tasks.add_task(
                _enrich_file_metadata_task, db_file.id, file_content
            )

        return FileUploadResponse(
            success=True,
            message="File uploaded successfully",
            file_data=PDFFileResponse.from_orm(db_file),
            is_duplicate=False,
        )

    except HTTPException as http_exc:
        # Re-raise HTTPException (validation errors, etc.) as-is
        print(f"🚨 HTTPException caught: {http_exc.status_code} - {http_exc.detail}")
        raise
    except Exception as e:
        import traceback

        error_msg = str(e)
        error_traceback = traceback.format_exc()
        print(f"❌ Upload error: {error_msg}")
        print(f"❌ Full traceback: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading file: {error_msg if error_msg else 'Unknown error'}",
        )


@app.get("/files", response_model=List[PDFFileResponse])
async def list_files(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all uploaded PDF files with annotation + due counts.

    due_count is computed per file via the FK from StudyCard → Annotation.
    """
    now = datetime.utcnow()
    files = db.query(PDFFile).order_by(PDFFile.last_accessed.desc()).offset(skip).limit(limit).all()

    files_with_counts = []
    for file in files:
        resp = PDFFileResponse.from_orm(file)
        resp.annotation_count = (
            db.query(Annotation).filter(Annotation.file_id == file.id).count()
        )
        resp.due_count = (
            db.query(StudyCard)
            .join(Annotation, StudyCard.annotation_id == Annotation.id)
            .filter(Annotation.file_id == file.id, StudyCard.due <= now)
            .count()
        )
        files_with_counts.append(resp)

    return files_with_counts


@app.get("/files/{file_id}", response_model=PDFFileResponse)
async def get_file(file_id: int, db: Session = Depends(get_db)):
    """Get file metadata by ID."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Update last accessed time
    file.last_accessed = datetime.utcnow()
    db.commit()

    return file


@app.patch("/files/{file_id}/zoom", response_model=PDFFileResponse)
async def update_file_zoom(
    file_id: int, zoom_data: ZoomLevelUpdate, db: Session = Depends(get_db)
):
    """Update the zoom level for a specific file."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Update zoom level
    file.zoom_level = zoom_data.zoom_level
    db.commit()
    db.refresh(file)

    return file


@app.patch("/files/{file_id}/position", response_model=PDFFileResponse)
async def update_read_position(
    file_id: int, position_data: ReadPositionUpdate, db: Session = Depends(get_db)
):
    """Update the last read position for a specific file."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Update read position
    file.last_read_position = position_data.last_read_position
    db.commit()
    db.refresh(file)

    return file


@app.patch("/files/{file_id}/pages", response_model=PDFFileResponse)
async def update_total_pages(
    file_id: int, pages_data: TotalPagesUpdate, db: Session = Depends(get_db)
):
    """Update the total number of pages for a specific file."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Update total pages
    file.total_pages = pages_data.total_pages
    db.commit()
    db.refresh(file)

    return file


@app.patch("/files/{file_id}/metadata", response_model=PDFFileResponse)
async def update_file_metadata(
    file_id: int, meta: PDFFileMetadataUpdate, db: Session = Depends(get_db)
):
    """Partial update of user-visible metadata (author, color_hue, excerpt).

    Called by the webapp after upload, once pdfjs has extracted PDF metadata
    and a first-page excerpt. All fields are optional; only provided ones are set.
    """
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if meta.title is not None:
        file.title = meta.title
    if meta.author is not None:
        file.author = meta.author
    if meta.color_hue is not None:
        file.color_hue = meta.color_hue
    if meta.excerpt is not None:
        file.excerpt = meta.excerpt

    db.commit()
    db.refresh(file)
    return file


@app.post("/library/refresh-metadata", response_model=LibraryRefreshResponse)
async def refresh_library_metadata(
    background_tasks: BackgroundTasks,
    force: bool = False,
    db: Session = Depends(get_db),
):
    """Bulk re-extract metadata for every PDF in the library via Gemini.

    Queues one background task per file on disk. By default (`force=false`)
    only null fields (title / author / excerpt) are filled, so repeated calls
    are cheap and safe. Pass `?force=true` to overwrite existing values.

    Requires GEMINI_API_KEY to be set; returns a 503 otherwise.
    """
    if not gemini_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured — set GEMINI_API_KEY to enable metadata refresh.",
        )

    files = db.query(PDFFile).all()
    queued = 0
    skipped = 0
    for f in files:
        # Skip files whose bytes we can't load.
        if not f.file_path or not os.path.exists(f.file_path):
            skipped += 1
            continue
        # When not forcing, skip rows that already have everything filled.
        if not force and f.title and f.author and f.excerpt:
            skipped += 1
            continue
        background_tasks.add_task(_refresh_file_metadata_task, f.id, force)
        queued += 1

    return LibraryRefreshResponse(
        queued=queued,
        skipped=skipped,
        force=force,
        message=(
            f"Queued {queued} file(s) for Gemini metadata refresh"
            f"{' (force overwrite)' if force else ''}; skipped {skipped}."
        ),
    )


@app.get("/files/{file_id}/download")
async def download_file(file_id: int, request: Request, db: Session = Depends(get_db)):
    """Download file by ID with optimized caching."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if not os.path.exists(file.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Get file modification time for ETag
    file_stat = os.stat(file.file_path)
    file_mtime = file_stat.st_mtime
    etag = f'"{file.file_hash}-{int(file_mtime)}"'

    # Check if client has cached version
    if_none_match = request.headers.get("if-none-match")
    if if_none_match == etag:
        return JSONResponse(status_code=304, content=None)

    # Cache the bytes, but let the browser revalidate via ETag — file_id is
    # reusable after a delete, so `immutable` would serve stale PDFs when SQLite
    # hands the same id to a different upload.
    headers = {
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "ETag": etag,
        "Last-Modified": datetime.fromtimestamp(file_mtime).strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        ),
        "Content-Encoding": "gzip" if file.file_path.endswith(".gz") else None,
    }

    # Remove None values
    headers = {k: v for k, v in headers.items() if v is not None}

    return FileResponse(
        file.file_path,
        media_type=file.mime_type,
        filename=file.original_filename,
        headers=headers,
    )


@app.delete("/files/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_db)):
    """Delete file and its annotations."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete associated annotations
    db.query(Annotation).filter(Annotation.file_id == file_id).delete()

    # Delete file from disk
    if os.path.exists(file.file_path):
        os.remove(file.file_path)

    # Delete from database
    db.delete(file)
    db.commit()

    return {"message": "File deleted successfully"}


# Image Endpoints


@app.post("/images/upload", response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    uuid: str = None,
    db: Session = Depends(get_db)
):
    """
    Upload an image file. Returns the UUID that can be used in [image:UUID] markers.
    If uuid is provided, it will be used; otherwise, a new UUID will be generated.
    """
    try:
        import uuid as uuid_lib
        import imghdr

        # Generate UUID if not provided
        if uuid is None:
            uuid = str(uuid_lib.uuid4())

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        # Validate file size
        if file_size > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image file too large. Maximum size is {MAX_IMAGE_SIZE} bytes"
            )

        # Detect image type
        image_type = imghdr.what(None, h=file_content)
        if image_type is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        mime_type = f"image/{image_type}"

        # Generate filename: uuid.extension
        filename = f"{uuid}.{image_type}"
        file_path = os.path.join(IMAGES_DIR, filename)

        # Save image to disk
        with open(file_path, "wb") as f:
            f.write(file_content)

        # Create database record
        db_image = Image(
            uuid=uuid,
            file_path=file_path,
            mime_type=mime_type,
            file_size=file_size,
        )

        db.add(db_image)
        db.commit()
        db.refresh(db_image)

        print(f"✅ Image uploaded successfully: uuid={uuid}, size={file_size}, type={mime_type}")

        return ImageUploadResponse(
            success=True,
            uuid=uuid,
            message="Image uploaded successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        print(f"❌ Image upload error: {error_msg}")
        print(f"❌ Full traceback: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading image: {error_msg}"
        )


@app.get("/images/{uuid}")
async def get_image(uuid: str, db: Session = Depends(get_db)):
    """Retrieve an image file by UUID."""
    image = db.query(Image).filter(Image.uuid == uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(
        image.file_path,
        media_type=image.mime_type,
        headers={"Cache-Control": "public, max-age=31536000"}  # Cache for 1 year
    )


@app.delete("/images/{uuid}")
async def delete_image(uuid: str, db: Session = Depends(get_db)):
    """Delete an image and its file."""
    image = db.query(Image).filter(Image.uuid == uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete file from disk
    if os.path.exists(image.file_path):
        os.remove(image.file_path)

    # Delete from database
    db.delete(image)
    db.commit()

    return {"message": "Image deleted successfully"}


# Annotation Endpoints


@app.post("/annotations", response_model=AnnotationResponse)
async def create_standalone_annotation(
    annotation: AnnotationCreate,
    db: Session = Depends(get_db)
):
    """Create a standalone annotation (not linked to any PDF file)."""
    try:
        print(f"📝 Creating standalone annotation:")
        print(f"  annotation_id: {annotation.annotation_id}")
        print(f"  question: {annotation.question[:50] if annotation.question else 'None'}...")
        print(f"  answer: {annotation.answer[:50] if annotation.answer else 'None'}...")
        print(f"  source: {annotation.source}")
        print(f"  tag: {annotation.tag}")
        print(f"  deck: {annotation.deck}")

        # Create annotation without file_id
        db_annotation = Annotation(
            file_id=None,
            annotation_id=annotation.annotation_id,
            page_index=annotation.page_index,
            question=annotation.question,
            answer=annotation.answer,
            highlighted_text=annotation.highlighted_text or "",
            position_data=annotation.position_data or "",
            source=annotation.source,
            tag=annotation.tag,
            deck=annotation.deck,
        )

        db.add(db_annotation)
        db.commit()
        db.refresh(db_annotation)

        print(f"✅ Successfully created standalone annotation with ID: {db_annotation.id}")
        return db_annotation

    except Exception as e:
        print(f"❌ Error creating standalone annotation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating standalone annotation: {str(e)}"
        )


@app.get("/annotations", response_model=List[AnnotationResponse])
async def list_all_annotations(
    skip: int = 0,
    limit: int = 500,
    tag: Optional[str] = None,
    source: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """List every annotation — file-linked and standalone — for the NotesScreen browser.

    Denormalizes file_title + file_color_hue onto each row so the UI doesn't need
    a second per-source fetch. `tag` filter matches if the comma-joined tag string
    contains the token. `source` filter takes a file_id (pass nothing to include
    standalone notes too).
    """
    query = db.query(Annotation)
    if source is not None:
        query = query.filter(Annotation.file_id == source)
    if tag:
        # Simple substring match against the comma-joined tag column.
        query = query.filter(Annotation.tag.ilike(f"%{tag}%"))

    rows = (
        query.order_by(Annotation.updated_date.desc()).offset(skip).limit(limit).all()
    )

    # Batch-load the small set of referenced files so we can denormalize.
    file_ids = {r.file_id for r in rows if r.file_id is not None}
    files_by_id = {}
    if file_ids:
        files_by_id = {
            f.id: f
            for f in db.query(PDFFile).filter(PDFFile.id.in_(file_ids)).all()
        }

    out: List[AnnotationResponse] = []
    for row in rows:
        resp = AnnotationResponse.from_orm(row)
        if row.file_id is not None:
            f = files_by_id.get(row.file_id)
            if f is not None:
                from .utils import strip_file_extension
                resp.file_title = strip_file_extension(f.original_filename)
                resp.file_color_hue = f.color_hue
        out.append(resp)
    return out


@app.post("/files/{file_id}/annotations", response_model=AnnotationResponse)
async def create_annotation(
    file_id: int, annotation: AnnotationCreate, db: Session = Depends(get_db)
):
    """Create a new annotation for a file."""
    try:
        # Log the incoming annotation data for debugging
        print(f"📝 Creating annotation for file {file_id}:")
        print(f"  annotation_id: {annotation.annotation_id}")
        print(f"  page_index: {annotation.page_index}")
        print(
            f"  question: {annotation.question[:50] if annotation.question else 'None'}..."
        )
        print(f"  answer: {annotation.answer[:50] if annotation.answer else 'None'}...")
        print(
            f"  highlighted_text: {annotation.highlighted_text[:50] if annotation.highlighted_text else 'None'}..."
        )
        print(
            f"  position_data length: {len(annotation.position_data) if annotation.position_data else 0}"
        )

        # Check if file exists
        file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        # Create annotation
        db_annotation = Annotation(
            file_id=file_id,
            annotation_id=annotation.annotation_id,
            page_index=annotation.page_index,
            question=annotation.question,
            answer=annotation.answer,
            highlighted_text=annotation.highlighted_text,
            position_data=annotation.position_data,
        )

        db.add(db_annotation)
        db.commit()
        db.refresh(db_annotation)

        print(f"✅ Successfully created annotation with ID: {db_annotation.id}")
        return db_annotation

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating annotation: {str(e)}")
        print(f"   Error type: {type(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error creating annotation: {str(e)}"
        )


@app.get("/files/{file_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(
    file_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """Get all annotations for a file."""
    annotations = (
        db.query(Annotation)
        .filter(Annotation.file_id == file_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return annotations


@app.put("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    annotation_update: AnnotationUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing annotation."""
    db_annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not db_annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Update fields if provided
    update_data = annotation_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_annotation, field, value)

    db_annotation.updated_date = datetime.utcnow()
    db.commit()
    db.refresh(db_annotation)

    return db_annotation


@app.delete("/annotations/{annotation_id}")
async def delete_annotation(annotation_id: int, db: Session = Depends(get_db)):
    """Delete an annotation and its associated study card."""
    try:
        db_annotation = (
            db.query(Annotation).filter(Annotation.id == annotation_id).first()
        )
        if not db_annotation:
            raise HTTPException(status_code=404, detail="Annotation not found")

        # Check if there's an associated study card
        study_card = (
            db.query(StudyCard).filter(StudyCard.annotation_id == annotation_id).first()
        )
        has_study_card = study_card is not None

        # Delete associated study card first (if exists)
        if study_card:
            # Delete associated card reviews first
            db.query(CardReview).filter(CardReview.card_id == study_card.id).delete()
            # Delete the study card
            db.delete(study_card)

        # Delete annotation
        db.delete(db_annotation)
        db.commit()

        message = "Annotation deleted successfully"
        if has_study_card:
            message += " (associated study card also deleted)"

        return {"message": message}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error deleting annotation: {str(e)}"
        )


@app.delete("/files/{file_id}/annotations")
async def delete_all_annotations(file_id: int, db: Session = Depends(get_db)):
    """Delete all annotations for a specific file."""
    try:
        # Check if file exists
        file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        # Get all annotations for this file
        annotations = db.query(Annotation).filter(Annotation.file_id == file_id).all()

        if not annotations:
            return {
                "message": "No annotations found for this file",
                "deleted_annotations": 0,
                "deleted_study_cards": 0,
            }

        # Delete associated study cards first
        annotation_ids = [annotation.id for annotation in annotations]
        deleted_study_cards = 0

        if annotation_ids:
            # Delete study cards linked to these annotations
            study_cards = (
                db.query(StudyCard)
                .filter(StudyCard.annotation_id.in_(annotation_ids))
                .all()
            )
            deleted_study_cards = len(study_cards)

            for card in study_cards:
                # Delete associated card reviews first
                db.query(CardReview).filter(CardReview.card_id == card.id).delete()
                # Delete the study card
                db.delete(card)

        # Delete all annotations for this file
        deleted_annotations = len(annotations)
        db.query(Annotation).filter(Annotation.file_id == file_id).delete()

        db.commit()

        return {
            "message": f"Successfully deleted all annotations for file {file_id}",
            "deleted_annotations": deleted_annotations,
            "deleted_study_cards": deleted_study_cards,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error deleting annotations: {str(e)}"
        )


# Spaced Repetition Endpoints


@app.post("/study-cards", response_model=List[StudyCardResponse])
async def create_study_card(annotation_id: int, db: Session = Depends(get_db)):
    """Create one study card per cloze blank in the annotation.

    Returns a list: N cards for an annotation with N `[[word]]` marks, or a
    single-element list for non-cloze annotations. Idempotent — an annotation
    gaining a new blank on edit can call this again to top up missing cards.
    """
    try:
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not annotation:
            raise HTTPException(status_code=404, detail="Annotation not found")

        cards = SpacedRepetitionService.create_study_card(db, annotation_id)
        return cards
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating study card: {str(e)}"
        )


def _card_with_intervals(card: StudyCard) -> StudyCardResponse:
    """Serialize a StudyCard ORM row to StudyCardResponse, computing next_intervals
    so the review UI can render the 4-button FSRS preview without a second call."""
    response = StudyCardResponse.from_orm(card)
    try:
        response.next_intervals = SpacedRepetitionService.compute_next_intervals(card)
    except Exception:
        # Non-fatal — the review UI can still function with an empty preview.
        response.next_intervals = []
    return response


@app.get("/study-cards/due", response_model=DueCardsResponse)
async def get_due_cards(limit: int = 50, file_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get cards that are due for review. Optionally filter by file_id."""
    try:
        cards_data = SpacedRepetitionService.get_due_cards(db, limit, file_id)

        due_cards_response = [_card_with_intervals(c) for c in cards_data["due_cards"]]
        new_cards_response = [_card_with_intervals(c) for c in cards_data["new_cards"]]
        learning_cards_response = [
            _card_with_intervals(c) for c in cards_data["learning_cards"]
        ]

        total_scheduled_today = SpacedRepetitionService.get_cards_scheduled_for_today(db, file_id)
        reviewed_today = SpacedRepetitionService.get_cards_reviewed_today(db, file_id)

        return DueCardsResponse(
            due_cards=due_cards_response,
            new_cards=new_cards_response,
            learning_cards=learning_cards_response,
            total_due=len(cards_data["due_cards"]),
            total_new=len(cards_data["new_cards"]),
            total_learning=len(cards_data["learning_cards"]),
            total_scheduled_today=total_scheduled_today,
            reviewed_today=reviewed_today,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get due cards: {str(e)}"
        )


@app.get("/study-cards/{card_id}/options", response_model=ReviewOptions)
async def get_review_options(card_id: int, db: Session = Depends(get_db)):
    """Get review options for a card."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")

        options = SpacedRepetitionService.get_review_options(card)
        return ReviewOptions(card_id=card_id, options=options)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting review options: {str(e)}"
        )


@app.get("/study-cards/{card_id}/timeline", response_model=TimelineResponse)
async def get_card_timeline(card_id: int, db: Session = Depends(get_db)):
    """Get timeline for a study card showing future review dates based on different quality ratings."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")

        # Get timeline data from the service
        timeline_data = SpacedRepetitionService.get_card_timeline(card)

        # Create timeline response
        timeline = CardTimeline(**timeline_data)

        return TimelineResponse(
            success=True, timeline=timeline, message="Timeline generated successfully"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating timeline: {str(e)}"
        )


@app.get("/study-cards/{card_id}/progression")
async def get_card_progression(
    card_id: int, steps: int = 4, db: Session = Depends(get_db)
):
    """Get progression intervals for a study card assuming user remembers each review correctly."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")

        # Get progression data from the service
        progression_data = SpacedRepetitionService.get_card_progression(card, steps)

        return {
            "success": True,
            "progression": progression_data,
            "message": "Progression generated successfully",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating progression: {str(e)}"
        )


@app.post("/study-cards/{card_id}/review", response_model=CardReviewResult)
async def review_card(
    card_id: int, review_data: CardReviewCreate, db: Session = Depends(get_db)
):
    """Review a card using FSRS algorithm with 4-button rating system."""
    try:
        # Validate rating (1-4: Again, Hard, Good, Easy)
        if review_data.rating < 1 or review_data.rating > 4:
            raise HTTPException(
                status_code=400, detail="Rating must be between 1 and 4 (1=Again, 2=Hard, 3=Good, 4=Easy)"
            )

        result = SpacedRepetitionService.review_card(
            db=db,
            card_id=card_id,
            rating=review_data.rating,
            time_taken=review_data.time_taken,
            session_id=review_data.session_id,
        )

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reviewing card: {str(e)}")


@app.get("/study-cards", response_model=List[StudyCardResponse])
async def get_study_cards(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """Get all study cards."""
    try:
        cards = db.query(StudyCard).offset(skip).limit(limit).all()
        return cards
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting study cards: {str(e)}"
        )


@app.get("/study-cards/{card_id}", response_model=StudyCardResponse)
async def get_study_card(card_id: int, db: Session = Depends(get_db)):
    """Get a specific study card."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")
        return card
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting study card: {str(e)}"
        )


@app.put("/study-cards/{card_id}", response_model=StudyCardResponse)
async def update_study_card(
    card_id: int, card_update: StudyCardUpdate, db: Session = Depends(get_db)
):
    """Update a study card."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")

        # Update fields if provided
        update_data = card_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(card, field, value)

        db.commit()
        db.refresh(card)
        return card
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating study card: {str(e)}"
        )


@app.delete("/study-cards/{card_id}")
async def delete_study_card(card_id: int, db: Session = Depends(get_db)):
    """Delete a study card."""
    try:
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Study card not found")

        # Delete associated reviews
        db.query(CardReview).filter(CardReview.card_id == card_id).delete()

        # Delete the card
        db.delete(card)
        db.commit()

        return {"message": "Study card deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting study card: {str(e)}"
        )


# Review Session Endpoints


@app.post("/review-sessions", response_model=ReviewSessionResponse)
async def create_review_session(
    session_data: ReviewSessionCreate, db: Session = Depends(get_db)
):
    """Create a new review session."""
    try:
        session = SpacedRepetitionService.create_review_session(
            db, session_data.user_id
        )
        return session
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating review session: {str(e)}"
        )


@app.put("/review-sessions/{session_id}/end", response_model=ReviewSessionResponse)
async def end_review_session(session_id: int, db: Session = Depends(get_db)):
    """End a review session."""
    try:
        session = SpacedRepetitionService.end_review_session(db, session_id)
        return session
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error ending review session: {str(e)}"
        )


@app.get("/review-sessions/{session_id}", response_model=ReviewSessionResponse)
async def get_review_session(session_id: int, db: Session = Depends(get_db)):
    """Get a review session."""
    try:
        session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Review session not found")
        return session
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting review session: {str(e)}"
        )


@app.get("/study-stats")
async def get_study_stats(db: Session = Depends(get_db)):
    """Get overall study statistics."""
    try:
        stats = SpacedRepetitionService.get_study_stats(db)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting study stats: {str(e)}"
        )


@app.get("/stats/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """HomeScreen Memory tiles — retention, stability, sessions, streak, cards."""
    try:
        stats = SpacedRepetitionService.get_dashboard_stats(db)
        return DashboardStats(**stats)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting dashboard stats: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
