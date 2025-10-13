from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Request
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
from .models import Base, PDFFile, Annotation, StudyCard, CardReview, ReviewSession
from .schemas import (
    PDFFileResponse,
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    FileUploadResponse,
    ZoomLevelUpdate,
    ReadPositionUpdate,
    TotalPagesUpdate,
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
)
from .spaced_repetition import SpacedRepetitionService
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

app = FastAPI(
    title="PDF Annotation API",
    description="Backend API for PDF annotation and note-taking",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "50000000"))  # 50MB

# Ensure upload directory exists
ensure_upload_dir(UPLOAD_DIR)


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
            
            # Skip compression for file downloads to avoid streaming issues
            path = scope.get("path", "")
            if path and "/download" in path:
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


@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    """List all uploaded PDF files with annotation counts."""
    files = db.query(PDFFile).offset(skip).limit(limit).all()

    # Add annotation count to each file
    files_with_counts = []
    for file in files:
        file_dict = PDFFileResponse.from_orm(file).dict()
        annotation_count = (
            db.query(Annotation).filter(Annotation.file_id == file.id).count()
        )
        file_dict["annotation_count"] = annotation_count
        files_with_counts.append(file_dict)

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

    # Create response with aggressive caching headers
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",  # 1 year cache
        "ETag": etag,
        "Last-Modified": datetime.fromtimestamp(file_mtime).strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        ),
        "Expires": (datetime.now() + timedelta(days=365)).strftime(
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


@app.post("/study-cards", response_model=StudyCardResponse)
async def create_study_card(annotation_id: int, db: Session = Depends(get_db)):
    """Create a study card from an annotation."""
    try:
        # Check if annotation exists
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not annotation:
            raise HTTPException(status_code=404, detail="Annotation not found")

        study_card = SpacedRepetitionService.create_study_card(db, annotation_id)
        return study_card
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating study card: {str(e)}"
        )


@app.get("/study-cards/due", response_model=DueCardsResponse)
async def get_due_cards(limit: int = 50, db: Session = Depends(get_db)):
    """Get cards that are due for review."""
    try:
        cards_data = SpacedRepetitionService.get_due_cards(db, limit)

        # Convert StudyCard objects to StudyCardResponse objects
        due_cards_response = [
            StudyCardResponse.from_orm(card) for card in cards_data["due_cards"]
        ]
        new_cards_response = [
            StudyCardResponse.from_orm(card) for card in cards_data["new_cards"]
        ]
        learning_cards_response = [
            StudyCardResponse.from_orm(card) for card in cards_data["learning_cards"]
        ]

        return DueCardsResponse(
            due_cards=due_cards_response,
            new_cards=new_cards_response,
            learning_cards=learning_cards_response,
            total_due=len(cards_data["due_cards"]),
            total_new=len(cards_data["new_cards"]),
            total_learning=len(cards_data["learning_cards"]),
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
    """Review a card using SM-2 algorithm."""
    try:
        # Validate quality rating
        if review_data.quality < 0 or review_data.quality > 5:
            raise HTTPException(
                status_code=400, detail="Quality rating must be between 0 and 5"
            )

        result = SpacedRepetitionService.review_card(
            db=db,
            card_id=card_id,
            quality=review_data.quality,
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
