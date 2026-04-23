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
    zoom_level = Column(Float, default=1.2)
    last_read_position = Column(Integer, default=0)
    total_pages = Column(Integer, nullable=True)
    # Design metadata — filled by the webapp after upload via pdfjs.getMetadata
    # and a first-page text scrape. All nullable; display layer falls back.
    author = Column(String, nullable=True)
    color_hue = Column(Integer, nullable=True)  # 0-360; derived from file_hash if null
    excerpt = Column(Text, nullable=True)       # ~200-char opening passage
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<PDFFile(filename='{self.filename}', hash='{self.file_hash}')>"


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, nullable=True, index=True)  # References PDFFile.id (optional for standalone notes)
    annotation_id = Column(String, index=True)  # Client-side ID
    page_index = Column(Integer, nullable=True)  # Optional for standalone notes
    question = Column(Text)
    answer = Column(Text)
    highlighted_text = Column(Text, nullable=True)
    position_data = Column(Text, nullable=True)  # JSON string for highlight rects
    source = Column(String, nullable=True)  # Source URL or reference
    tag = Column(String, nullable=True)  # Tag for categorization
    deck = Column(String, default="Default")  # Deck name for organization
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    updated_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<Annotation(file_id={self.file_id}, page={self.page_index})>"


class Image(Base):
    """Image storage for annotations.

    Images are stored as separate files on disk with references in the database.
    Each image has a UUID that corresponds to [image:UUID] markers in annotation text.
    """
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True, nullable=False)  # UUID used in [image:UUID] markers
    annotation_id = Column(
        Integer,
        ForeignKey("annotations.id", ondelete="CASCADE"),
        nullable=True,  # Nullable to allow orphaned images during creation
        index=True,
    )
    file_path = Column(String, nullable=False)  # Path to image file on disk
    mime_type = Column(String, default="image/png")  # MIME type (e.g., image/png, image/jpeg)
    file_size = Column(Integer, nullable=False)  # File size in bytes
    created_date = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    annotation = relationship("Annotation", backref="images")

    def __repr__(self):
        return f"<Image(uuid={self.uuid}, annotation_id={self.annotation_id})>"


class StudyCard(Base):
    """A card that can be studied using FSRS spaced repetition.

    One StudyCard per cloze blank: an annotation containing N `[[word]]` marks
    produces N cards (cloze_index = 0..N-1). Non-cloze annotations get exactly
    one card with cloze_index = 0. At review, the target blank is hidden and
    the other blanks are shown, so each cloze is graded on its own FSRS track.
    CASCADE on delete — removing the annotation removes all of its cards.
    """

    __tablename__ = "study_cards"
    __table_args__ = (
        UniqueConstraint('annotation_id', 'cloze_index', name='uq_study_card_annotation_cloze'),
    )

    id = Column(Integer, primary_key=True, index=True)
    annotation_id = Column(
        Integer,
        ForeignKey("annotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 0-indexed position of the [[word]] this card targets within the annotation.
    # Always 0 for non-cloze annotations.
    cloze_index = Column(Integer, nullable=False, default=0)

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
