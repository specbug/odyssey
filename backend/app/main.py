from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime
from dotenv import load_dotenv

from .database import SessionLocal, engine, get_db
from .models import Base, PDFFile, Annotation
from .schemas import (
    PDFFileResponse,
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    FileUploadResponse,
)
from .utils import (
    calculate_file_hash_from_bytes,
    is_pdf_file,
    get_file_mime_type,
    generate_unique_filename,
    save_uploaded_file,
    validate_file_size,
    ensure_upload_dir,
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
        if not is_pdf_file(file.filename):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        # Read file content
        file_content = await file.read()

        # Validate file size
        if not validate_file_size(len(file_content), MAX_FILE_SIZE):
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE} bytes",
            )

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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@app.get("/files", response_model=List[PDFFileResponse])
async def list_files(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all uploaded PDF files."""
    files = db.query(PDFFile).offset(skip).limit(limit).all()
    return files


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


@app.get("/files/{file_id}/download")
async def download_file(file_id: int, db: Session = Depends(get_db)):
    """Download file by ID."""
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if not os.path.exists(file.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        file.file_path, media_type=file.mime_type, filename=file.original_filename
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
    """Delete an annotation."""
    db_annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not db_annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    db.delete(db_annotation)
    db.commit()

    return {"message": "Annotation deleted successfully"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
