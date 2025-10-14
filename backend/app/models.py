from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Float,
    Boolean,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
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
    zoom_level = Column(Float, default=1.2)  # User's preferred zoom level for this file
    last_read_position = Column(Integer, default=0)  # Last read page index (0-based)
    total_pages = Column(Integer, nullable=True)  # Total number of pages in PDF
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


class StudyCard(Base):
    """A card that can be studied using FSRS spaced repetition.

    For basic cards: 1:1 relationship with an annotation.
    For cloze cards: Multiple cards per annotation (one per cloze index).
    When an annotation is deleted, its study cards are automatically deleted (CASCADE).

    Uses FSRS (Free Spaced Repetition Scheduler) algorithm for optimal scheduling.
    """

    __tablename__ = "study_cards"
    __table_args__ = (
        UniqueConstraint('annotation_id', 'cloze_index', name='uq_annotation_cloze'),
    )

    id = Column(Integer, primary_key=True, index=True)
    annotation_id = Column(
        Integer,
        ForeignKey("annotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cloze_index = Column(Integer, nullable=True, default=None)  # For cloze deletions (c1, c2, etc.)

    # FSRS Algorithm fields
    difficulty = Column(Float, default=0.0)  # FSRS difficulty parameter (0-10)
    stability = Column(Float, default=0.0)  # Memory stability in days
    elapsed_days = Column(Integer, default=0)  # Days since last review
    scheduled_days = Column(Integer, default=0)  # Days scheduled for this review
    reps = Column(Integer, default=0)  # Total number of reviews
    lapses = Column(Integer, default=0)  # Number of times forgotten
    state = Column(String, default="New")  # New, Learning, Review, or Relearning
    last_review = Column(DateTime(timezone=True))  # Last review timestamp

    # Timestamps
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    due = Column(DateTime(timezone=True))  # When the card is due for review

    # For backward compatibility with frontend
    @property
    def next_review_date(self):
        """Alias for 'due' to maintain backward compatibility."""
        return self.due

    # Relationships
    annotation = relationship("Annotation", backref="study_card")
    reviews = relationship(
        "CardReview",
        back_populates="card",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self):
        return f"<StudyCard(id={self.id}, annotation_id={self.annotation_id}, state={self.state}, due={self.due})>"


class ReviewSession(Base):
    """A review session containing multiple card reviews."""

    __tablename__ = "review_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)  # For future user support
    session_start = Column(DateTime(timezone=True), server_default=func.now())
    session_end = Column(DateTime(timezone=True))
    cards_reviewed = Column(Integer, default=0)

    # Session statistics
    correct_answers = Column(Integer, default=0)
    incorrect_answers = Column(Integer, default=0)

    # Relationships
    reviews = relationship("CardReview", back_populates="session")

    def __repr__(self):
        return f"<ReviewSession(id={self.id}, cards_reviewed={self.cards_reviewed})>"


class CardReview(Base):
    """Individual card review with FSRS algorithm data."""

    __tablename__ = "card_reviews"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(
        Integer, ForeignKey("study_cards.id", ondelete="CASCADE"), index=True
    )
    session_id = Column(
        Integer, ForeignKey("review_sessions.id", ondelete="CASCADE"), index=True
    )

    # Review data
    rating = Column(Integer)  # 1-4 rating: Again(1), Hard(2), Good(3), Easy(4)
    review_date = Column(DateTime(timezone=True), server_default=func.now())

    # FSRS algorithm state before review
    state_before = Column(String)  # New, Learning, Review, or Relearning
    difficulty_before = Column(Float)
    stability_before = Column(Float)

    # FSRS algorithm state after review
    state_after = Column(String)
    difficulty_after = Column(Float)
    stability_after = Column(Float)
    scheduled_days_after = Column(Integer)  # Days until next review

    # Time tracking
    time_taken = Column(Integer)  # Time taken in seconds

    # Relationships
    card = relationship("StudyCard", back_populates="reviews")
    session = relationship("ReviewSession", back_populates="reviews")

    def __repr__(self):
        return f"<CardReview(id={self.id}, card_id={self.card_id}, rating={self.rating})>"
