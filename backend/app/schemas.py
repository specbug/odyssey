from pydantic import BaseModel, computed_field, Field, validator
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
    zoom_level: float = 1.2
    last_read_position: int = 0
    total_pages: Optional[int] = None
    upload_date: datetime
    last_accessed: datetime
    annotation_count: Optional[int] = 0

    @computed_field
    @property
    def display_name(self) -> str:
        """Return the original filename without the .pdf extension for display purposes."""
        from .utils import strip_file_extension

        return strip_file_extension(self.original_filename)

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


class ZoomLevelUpdate(BaseModel):
    zoom_level: float = Field(..., ge=0.5, le=3.0, description="Zoom level between 0.5 and 3.0")


class ReadPositionUpdate(BaseModel):
    last_read_position: int = Field(..., ge=0, description="Last read page index (0-based)")


class TotalPagesUpdate(BaseModel):
    total_pages: int = Field(..., ge=1, description="Total number of pages in the PDF")


# Spaced Repetition Schemas (FSRS)


class StudyCardBase(BaseModel):
    annotation_id: int
    difficulty: float = 0.0
    stability: float = 0.0
    state: str = "New"


class StudyCardCreate(StudyCardBase):
    pass


class StudyCardUpdate(BaseModel):
    difficulty: Optional[float] = None
    stability: Optional[float] = None
    elapsed_days: Optional[int] = None
    scheduled_days: Optional[int] = None
    reps: Optional[int] = None
    lapses: Optional[int] = None
    state: Optional[str] = None
    last_review: Optional[datetime] = None
    due: Optional[datetime] = None


class StudyCardResponse(StudyCardBase):
    id: int
    annotation_id: Optional[int] = None  # Allow None for cards without annotations
    difficulty: float = 0.0
    stability: float = 0.0
    elapsed_days: int = 0
    scheduled_days: int = 0
    reps: int = 0
    lapses: int = 0
    state: str = "New"
    last_review: Optional[datetime] = None
    created_date: datetime
    due: Optional[datetime] = None
    annotation: Optional[AnnotationResponse] = None

    # Backward compatibility property
    @property
    def next_review_date(self):
        """Alias for 'due' to maintain backward compatibility."""
        return self.due

    class Config:
        from_attributes = True


class ReviewSessionBase(BaseModel):
    user_id: Optional[str] = None
    cards_reviewed: int = 0
    correct_answers: int = 0
    incorrect_answers: int = 0


class ReviewSessionCreate(ReviewSessionBase):
    pass


class ReviewSessionUpdate(BaseModel):
    session_end: Optional[datetime] = None
    cards_reviewed: Optional[int] = None
    correct_answers: Optional[int] = None
    incorrect_answers: Optional[int] = None


class ReviewSessionResponse(ReviewSessionBase):
    id: int
    session_start: datetime
    session_end: Optional[datetime] = None

    class Config:
        from_attributes = True


class CardReviewBase(BaseModel):
    card_id: int
    rating: int = Field(..., ge=1, le=4, description="FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy)")
    time_taken: Optional[int] = None  # Time in seconds


class CardReviewCreate(CardReviewBase):
    session_id: Optional[int] = None


class CardReviewResponse(CardReviewBase):
    id: int
    session_id: Optional[int] = None
    review_date: datetime
    state_before: Optional[str] = None
    difficulty_before: Optional[float] = None
    stability_before: Optional[float] = None
    state_after: Optional[str] = None
    difficulty_after: Optional[float] = None
    stability_after: Optional[float] = None
    scheduled_days_after: Optional[int] = None

    class Config:
        from_attributes = True


class CardReviewResult(BaseModel):
    """Result of reviewing a card with FSRS algorithm."""

    card: StudyCardResponse
    review: CardReviewResponse
    next_review_date: datetime
    message: str


class DueCardsResponse(BaseModel):
    """Response for getting due cards."""

    due_cards: List[StudyCardResponse]
    new_cards: List[StudyCardResponse]
    learning_cards: List[StudyCardResponse]
    total_due: int
    total_new: int
    total_learning: int


class ReviewOptions(BaseModel):
    """Options for reviewing a card based on FSRS algorithm."""

    card_id: int
    options: List[dict]  # List of rating options with preview data


# Timeline Schemas


class TimelinePoint(BaseModel):
    """A single point in the timeline showing when a card will appear next."""

    rating: int = Field(..., ge=1, le=4, description="FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy)")
    rating_label: str = Field(
        ...,
        description="Human-readable label for the rating (e.g., 'Forgot', 'Hard', 'Good', 'Easy')",
    )
    next_review_date: datetime = Field(
        ..., description="When the card will appear next"
    )
    interval_days: int = Field(
        ..., description="Interval in days"
    )
    interval_text: str = Field(
        ..., description="Human-readable interval text (e.g., '1 day', '4 days')"
    )
    card_state: str = Field(
        ..., description="Card state after review (New, Learning, Review, Relearning)"
    )
    difficulty_after: float = Field(..., description="FSRS difficulty after review")
    stability_after: float = Field(
        ..., description="FSRS stability after review"
    )


class CardTimeline(BaseModel):
    """Timeline for a study card showing future review dates based on different ratings."""

    card_id: int
    current_state: str = Field(
        ..., description="Current card state (New, Learning, Review, Relearning)"
    )
    current_difficulty: float = Field(..., description="Current FSRS difficulty")
    current_stability: float = Field(..., description="Current FSRS stability")
    current_scheduled_days: int = Field(..., description="Current scheduled days")
    next_review_date: Optional[datetime] = Field(
        None, description="Current next review date"
    )
    timeline_points: List[TimelinePoint] = Field(
        ..., description="Timeline points for each rating (4 options)"
    )
    generated_at: datetime = Field(..., description="When this timeline was generated")


class TimelineResponse(BaseModel):
    """Response containing the timeline for a study card."""

    success: bool = True
    timeline: CardTimeline
    message: Optional[str] = None
