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


# Spaced Repetition Schemas


class StudyCardBase(BaseModel):
    annotation_id: int
    easiness: float = 2.5
    interval: int = 1
    repetitions: int = 0
    is_new: bool = True
    is_learning: bool = False
    is_graduated: bool = False


class StudyCardCreate(StudyCardBase):
    pass


class StudyCardUpdate(BaseModel):
    easiness: Optional[float] = None
    interval: Optional[int] = None
    repetitions: Optional[int] = None
    is_new: Optional[bool] = None
    is_learning: Optional[bool] = None
    is_graduated: Optional[bool] = None
    last_review_date: Optional[datetime] = None
    next_review_date: Optional[datetime] = None


class StudyCardResponse(StudyCardBase):
    id: int
    annotation_id: Optional[int] = None  # Allow None for cards without annotations
    easiness: float = 2.5
    interval: int = 1
    repetitions: int = 0
    is_new: bool = True
    is_learning: bool = False
    is_graduated: bool = False
    created_date: datetime
    last_review_date: Optional[datetime] = None
    next_review_date: Optional[datetime] = None
    annotation: Optional[AnnotationResponse] = None

    @validator("interval", pre=True)
    def convert_interval_to_int(cls, v):
        """Convert float interval to int."""
        if isinstance(v, float):
            return int(round(v))
        return v

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
    quality: int = Field(..., ge=0, le=5, description="SM-2 quality rating (0-5)")
    time_taken: Optional[int] = None  # Time in seconds


class CardReviewCreate(CardReviewBase):
    session_id: Optional[int] = None


class CardReviewResponse(CardReviewBase):
    id: int
    session_id: Optional[int] = None
    review_date: datetime
    easiness_before: Optional[float] = None
    interval_before: Optional[int] = None
    repetitions_before: Optional[int] = None
    easiness_after: Optional[float] = None
    interval_after: Optional[int] = None
    repetitions_after: Optional[int] = None

    class Config:
        from_attributes = True


class CardReviewResult(BaseModel):
    """Result of reviewing a card with SM-2 algorithm."""

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
    """Options for reviewing a card based on SM-2 algorithm."""

    card_id: int
    options: List[dict]  # List of quality options with preview data


# Timeline Schemas


class TimelinePoint(BaseModel):
    """A single point in the timeline showing when a card will appear next."""

    quality: int = Field(..., ge=0, le=5, description="SM-2 quality rating (0-5)")
    quality_label: str = Field(
        ...,
        description="Human-readable label for the quality (e.g., 'Wrong', 'Good', 'Easy')",
    )
    next_review_date: datetime = Field(
        ..., description="When the card will appear next"
    )
    interval_days: Optional[int] = Field(
        None, description="Interval in days (None for learning cards in minutes)"
    )
    interval_minutes: Optional[int] = Field(
        None, description="Interval in minutes (for learning cards)"
    )
    interval_text: str = Field(
        ..., description="Human-readable interval text (e.g., '1 min', '4 days')"
    )
    card_state: str = Field(
        ..., description="Card state after review (new, learning, graduated)"
    )
    easiness_after: float = Field(..., description="Easiness factor after review")
    repetitions_after: int = Field(
        ..., description="Number of repetitions after review"
    )


class CardTimeline(BaseModel):
    """Timeline for a study card showing future review dates based on different quality ratings."""

    card_id: int
    current_state: str = Field(
        ..., description="Current card state (new, learning, graduated)"
    )
    current_interval: int = Field(..., description="Current interval")
    current_easiness: float = Field(..., description="Current easiness factor")
    current_repetitions: int = Field(..., description="Current number of repetitions")
    next_review_date: Optional[datetime] = Field(
        None, description="Current next review date"
    )
    timeline_points: List[TimelinePoint] = Field(
        ..., description="Timeline points for each quality rating"
    )
    generated_at: datetime = Field(..., description="When this timeline was generated")


class TimelineResponse(BaseModel):
    """Response containing the timeline for a study card."""

    success: bool = True
    timeline: CardTimeline
    message: Optional[str] = None
