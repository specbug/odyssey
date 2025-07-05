from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Float,
    Boolean,
    ForeignKey,
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
    """A card that can be studied using spaced repetition.

    Each study card has a 1:1 relationship with an annotation.
    When an annotation is deleted, its study card is automatically deleted (CASCADE).
    """

    __tablename__ = "study_cards"

    id = Column(Integer, primary_key=True, index=True)
    annotation_id = Column(
        Integer,
        ForeignKey("annotations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # SM-2 Algorithm fields
    easiness = Column(Float, default=2.5)  # Easiness factor (default 2.5)
    interval = Column(Integer, default=1)  # Days until next review
    repetitions = Column(Integer, default=0)  # Number of successful repetitions

    # Card state
    is_new = Column(Boolean, default=True)  # True if card hasn't been reviewed
    is_learning = Column(Boolean, default=False)  # True if card is in learning phase
    is_graduated = Column(
        Boolean, default=False
    )  # True if card has graduated from learning
    learning_step = Column(
        Integer, default=0
    )  # Track which learning step for failed cards

    # Timestamps
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    last_review_date = Column(DateTime(timezone=True))
    next_review_date = Column(DateTime(timezone=True))

    # Relationships
    annotation = relationship("Annotation", backref="study_card")  # Changed to singular
    reviews = relationship(
        "CardReview",
        back_populates="card",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self):
        return f"<StudyCard(id={self.id}, annotation_id={self.annotation_id}, interval={self.interval})>"


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
    """Individual card review with SM-2 algorithm data."""

    __tablename__ = "card_reviews"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(
        Integer, ForeignKey("study_cards.id", ondelete="CASCADE"), index=True
    )
    session_id = Column(
        Integer, ForeignKey("review_sessions.id", ondelete="CASCADE"), index=True
    )

    # Review data
    quality = Column(Integer)  # 0-5 quality rating from SM-2
    review_date = Column(DateTime(timezone=True), server_default=func.now())

    # SM-2 algorithm state before review
    easiness_before = Column(Float)
    interval_before = Column(Integer)
    repetitions_before = Column(Integer)

    # SM-2 algorithm state after review
    easiness_after = Column(Float)
    interval_after = Column(Integer)
    repetitions_after = Column(Integer)

    # Time tracking
    time_taken = Column(Integer)  # Time taken in seconds

    # Relationships
    card = relationship("StudyCard", back_populates="reviews")
    session = relationship("ReviewSession", back_populates="reviews")

    def __repr__(self):
        return f"<CardReview(id={self.id}, card_id={self.card_id}, quality={self.quality})>"
