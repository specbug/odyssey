from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class PDFFileBase(BaseModel):
    filename: str
    original_filename: str
    file_size: int
    mime_type: str


class PDFFileCreate(PDFFileBase):
    file_hash: str
    file_path: str


class PDFFileResponse(PDFFileBase):
    id: int
    file_hash: str
    upload_date: datetime
    last_accessed: datetime
    annotation_count: Optional[int] = 0

    class Config:
        from_attributes = True


class AnnotationBase(BaseModel):
    annotation_id: str
    page_index: int
    question: str
    answer: str
    highlighted_text: str
    position_data: str


class AnnotationCreate(AnnotationBase):
    pass  # file_id is passed as path parameter, not in request body


class AnnotationUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    highlighted_text: Optional[str] = None
    position_data: Optional[str] = None


class AnnotationResponse(AnnotationBase):
    id: int
    file_id: int
    created_date: datetime
    updated_date: datetime

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    success: bool
    message: str
    file_data: Optional[PDFFileResponse] = None
    is_duplicate: bool = False
