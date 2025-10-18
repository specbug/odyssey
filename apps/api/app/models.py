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


class Source(Base):
    """Generic source model for both PDF files and web pages"""
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, default="pdf", index=True)  # 'pdf' or 'webpage'

    # PDF-specific fields (nullable for webpages)
    filename = Column(String, nullable=True, index=True)
    original_filename = Column(String, nullable=True)
    file_hash = Column(String, unique=True, nullable=True, index=True)
    file_size = Column(Integer, nullable=True)
    file_path = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)

    # Web page-specific fields (nullable for PDFs)
    url = Column(String, nullable=True, index=True)
    page_title = Column(String, nullable=True)

    # Common fields
    zoom_level = Column(Float, default=1.2)  # User's preferred zoom level (PDFs) or font size (web)
    last_read_position = Column(Integer, default=0)  # Last read page/scroll position
    total_pages = Column(Integer, nullable=True)  # Total pages (PDF) or null (web)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        if self.source_type == "pdf":
            return f"<Source(type='pdf', filename='{self.filename}')>"
        else:
            return f"<Source(type='webpage', url='{self.url}')>"


# Backwards compatibility alias
PDFFile = Source


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, index=True)  # References Source.id (PDF or webpage)
    annotation_id = Column(String, index=True)  # Client-side ID
    page_index = Column(Integer, nullable=True)  # Page number (PDF) or null (web)
    question = Column(Text)
    answer = Column(Text)
    highlighted_text = Column(Text)
    position_data = Column(Text)  # JSON string for highlight rects (PDF) or text anchors (web)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    updated_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Backwards compatibility property
    @property
    def file_id(self):
        """Alias for source_id to maintain backwards compatibility"""
        return self.source_id

    def __repr__(self):
        return f"<Annotation(source_id={self.source_id}, page={self.page_index})>"


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
