from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean
from sqlalchemy.sql import func
from .database import Base


class PDFFile(Base):
    __tablename__ = "pdf_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    original_filename = Column(String)
    file_hash = Column(String, unique=True, index=True)
    file_size = Column(Integer)
    file_path = Column(String)
    mime_type = Column(String)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<PDFFile(filename='{self.filename}', hash='{self.file_hash}')>"


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, index=True)  # References PDFFile.id
    annotation_id = Column(String, index=True)  # Client-side ID
    page_index = Column(Integer)
    question = Column(Text)
    answer = Column(Text)
    highlighted_text = Column(Text)
    position_data = Column(Text)  # JSON string for highlight rects
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    updated_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<Annotation(file_id={self.file_id}, page={self.page_index})>"
