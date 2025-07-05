"""
Spaced Repetition Logic using Modified SM-2 Algorithm with Immediate Feedback
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from supermemo2 import first_review, review

from .models import StudyCard, CardReview, ReviewSession, Annotation
from .schemas import StudyCardResponse, CardReviewCreate, CardReviewResult


class SpacedRepetitionService:
    """Service class for handling spaced repetition logic with immediate feedback."""

    # Learning intervals for failed cards (in minutes)
    LEARNING_INTERVALS = [1, 10, 1440]  # 1 min, 10 min, 1 day

    @staticmethod
    def create_study_card(db: Session, annotation_id: int) -> StudyCard:
        """Create a new study card from an annotation.

        Due to 1:1 constraint, each annotation can have exactly one study card.
        If a study card already exists for this annotation, returns the existing one.
        """
        # Validate that annotation exists
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not annotation:
            raise ValueError(f"Annotation with ID {annotation_id} not found")

        # Check if study card already exists for this annotation
        existing_card = (
            db.query(StudyCard).filter(StudyCard.annotation_id == annotation_id).first()
        )

        if existing_card:
            return existing_card

        # Create new study card with required annotation_id
        try:
            study_card = StudyCard(
                annotation_id=annotation_id,  # Now required (NOT NULL)
                easiness=2.5,
                interval=1,
                repetitions=0,
                is_new=True,
                is_learning=False,
                is_graduated=False,
                next_review_date=datetime.utcnow(),  # New cards available immediately
                learning_step=0,  # Track which learning step we're on
            )

            db.add(study_card)
            db.commit()
            db.refresh(study_card)

            return study_card

        except Exception as e:
            db.rollback()
            # Check if it's a constraint violation (another card was created concurrently)
            existing_card = (
                db.query(StudyCard)
                .filter(StudyCard.annotation_id == annotation_id)
                .first()
            )
            if existing_card:
                return existing_card
            else:
                raise ValueError(
                    f"Failed to create study card for annotation {annotation_id}: {str(e)}"
                )

    @staticmethod
    def get_due_cards(db: Session, limit: int = 50) -> Dict[str, List[StudyCard]]:
        """Get cards that are due for review, properly categorized."""
        now = datetime.utcnow()

        # Get all cards that are due for review (including those without annotations)
        all_due_cards = (
            db.query(StudyCard)
            .filter(StudyCard.next_review_date <= now)
            .limit(limit)
            .all()
        )

        # Load annotations for cards that have them
        for card in all_due_cards:
            if card.annotation_id:
                try:
                    annotation = (
                        db.query(Annotation)
                        .filter(Annotation.id == card.annotation_id)
                        .first()
                    )
                    if annotation:
                        card.annotation = annotation
                except Exception:
                    # If annotation loading fails, continue without it
                    pass

        # Categorize cards
        new_cards = [card for card in all_due_cards if card.is_new]
        learning_cards = [
            card for card in all_due_cards if not card.is_new and card.is_learning
        ]
        due_cards = [
            card for card in all_due_cards if not card.is_new and not card.is_learning
        ]

        return {
            "due_cards": due_cards,
            "new_cards": new_cards,
            "learning_cards": learning_cards,
        }

    @staticmethod
    def review_card(
        db: Session,
        card_id: int,
        quality: int,
        time_taken: Optional[int] = None,
        session_id: Optional[int] = None,
    ) -> CardReviewResult:
        """Review a card using modified SM-2 algorithm with immediate feedback."""
        # Get the card first
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        # Try to load annotation relationship if it exists
        if card.annotation_id:
            try:
                # Load the annotation relationship
                annotation = (
                    db.query(Annotation)
                    .filter(Annotation.id == card.annotation_id)
                    .first()
                )
                if annotation:
                    card.annotation = annotation
            except Exception:
                # If annotation loading fails, continue without it
                pass

        # Store pre-review state
        easiness_before = card.easiness
        interval_before = card.interval
        repetitions_before = card.repetitions
        was_new = card.is_new
        was_learning = card.is_learning

        # Update last review date
        card.last_review_date = datetime.utcnow()

        # Handle review based on quality
        if quality >= 3:  # Successful review (3-5)
            SpacedRepetitionService._handle_successful_review(card, quality)
        else:  # Failed review (0-2)
            SpacedRepetitionService._handle_failed_review(card, quality)

        # Create review record
        review_record = CardReview(
            card_id=card_id,
            session_id=session_id,
            quality=quality,
            time_taken=time_taken,
            easiness_before=easiness_before,
            interval_before=interval_before,
            repetitions_before=repetitions_before,
            easiness_after=card.easiness,
            interval_after=card.interval,
            repetitions_after=card.repetitions,
        )

        db.add(review_record)
        db.commit()
        db.refresh(card)
        db.refresh(review_record)

        # Generate result message
        message = SpacedRepetitionService._generate_review_message(card, quality)

        return CardReviewResult(
            card=StudyCardResponse.from_orm(card),
            review=review_record,
            next_review_date=card.next_review_date,
            message=message,
        )

    @staticmethod
    def _handle_successful_review(card: StudyCard, quality: int):
        """Handle successful review (quality >= 3)."""
        if card.is_new:
            # First successful review of a new card
            card.is_new = False
            card.is_learning = True
            card.is_graduated = False
            card.learning_step = 0
            card.repetitions = 1
            card.interval = 1  # Start with 1 day
            card.next_review_date = datetime.utcnow() + timedelta(days=1)
        elif card.is_learning:
            # Successful review of a learning card
            if quality >= 4:  # Easy - graduate the card
                card.is_learning = False
                card.is_graduated = True
                card.learning_step = 0
                # Use SM-2 for the first graduated interval
                card.repetitions = 2
                card.interval = 4  # Standard SM-2 second interval
                card.next_review_date = datetime.utcnow() + timedelta(days=4)
            else:  # Good - continue learning
                card.learning_step += 1
                if card.learning_step >= len(
                    SpacedRepetitionService.LEARNING_INTERVALS
                ):
                    # Graduate after completing all learning steps
                    card.is_learning = False
                    card.is_graduated = True
                    card.learning_step = 0
                    card.repetitions = 2
                    card.interval = 4
                    card.next_review_date = datetime.utcnow() + timedelta(days=4)
                else:
                    # Continue with next learning step
                    interval_minutes = SpacedRepetitionService.LEARNING_INTERVALS[
                        card.learning_step
                    ]
                    card.next_review_date = datetime.utcnow() + timedelta(
                        minutes=interval_minutes
                    )
        else:
            # Graduated card - use SM-2 algorithm
            result = review(
                quality=quality,
                easiness=card.easiness,
                interval=card.interval,
                repetitions=card.repetitions,
                review_datetime=datetime.utcnow(),
            )

            card.easiness = result["easiness"]
            card.interval = result["interval"]
            card.repetitions = result["repetitions"]

            # Convert string datetime to datetime object if needed
            if isinstance(result["review_datetime"], str):
                # Parse ISO format datetime string manually
                from datetime import datetime as dt

                card.next_review_date = dt.fromisoformat(
                    result["review_datetime"].replace("Z", "+00:00")
                )
            else:
                card.next_review_date = result["review_datetime"]

    @staticmethod
    def _handle_failed_review(card: StudyCard, quality: int):
        """Handle failed review (quality < 3)."""
        # All failed cards go to learning state
        card.is_new = False
        card.is_learning = True
        card.is_graduated = False
        card.learning_step = 0
        card.repetitions = 0

        # Reset interval to first learning step - store as minutes for learning cards
        card.interval = SpacedRepetitionService.LEARNING_INTERVALS[
            0
        ]  # Store as minutes
        card.next_review_date = datetime.utcnow() + timedelta(
            minutes=SpacedRepetitionService.LEARNING_INTERVALS[0]
        )

        # Reduce easiness for supermemo2 algorithm
        if card.easiness > 1.3:
            card.easiness = max(1.3, card.easiness - 0.2)

    @staticmethod
    def _generate_review_message(card: StudyCard, quality: int) -> str:
        """Generate appropriate message based on review outcome."""
        if quality >= 4:
            if card.is_graduated:
                return f"Excellent! Next review in {card.interval} days."
            else:
                interval_minutes = (
                    SpacedRepetitionService.LEARNING_INTERVALS[card.learning_step]
                    if card.learning_step
                    < len(SpacedRepetitionService.LEARNING_INTERVALS)
                    else 1440
                )
                if interval_minutes < 60:
                    return f"Great! Next review in {interval_minutes} minutes."
                elif interval_minutes < 1440:
                    return f"Great! Next review in {interval_minutes // 60} hours."
                else:
                    return f"Great! Next review in {interval_minutes // 1440} days."
        elif quality >= 3:
            if card.is_graduated:
                return f"Good! Next review in {card.interval} days."
            else:
                interval_minutes = (
                    SpacedRepetitionService.LEARNING_INTERVALS[card.learning_step]
                    if card.learning_step
                    < len(SpacedRepetitionService.LEARNING_INTERVALS)
                    else 1440
                )
                if interval_minutes < 60:
                    return f"Good! Next review in {interval_minutes} minutes."
                elif interval_minutes < 1440:
                    return f"Good! Next review in {interval_minutes // 60} hours."
                else:
                    return f"Good! Next review in {interval_minutes // 1440} days."
        else:
            return "Keep practicing! This card will reappear in 1 minute."

    @staticmethod
    def get_review_options(card: StudyCard) -> List[Dict]:
        """Get preview of review options for a card."""
        options = []

        # Simplified quality options for UI
        quality_options = [
            (1, "Wrong", "I got it wrong", "1 min"),
            (
                4,
                "Remembered",
                "I got it right",
                "4 days" if card.is_graduated else "1 day",
            ),
        ]

        return [
            {
                "quality": quality,
                "short_description": short_desc,
                "long_description": long_desc,
                "next_interval_text": interval_text,
            }
            for quality, short_desc, long_desc, interval_text in quality_options
        ]

    @staticmethod
    def create_review_session(
        db: Session, user_id: Optional[str] = None
    ) -> ReviewSession:
        """Create a new review session."""
        session = ReviewSession(user_id=user_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def end_review_session(db: Session, session_id: int) -> ReviewSession:
        """End a review session and update statistics."""
        session = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
        if not session:
            raise ValueError("Session not found")

        # Update session statistics
        reviews = db.query(CardReview).filter(CardReview.session_id == session_id).all()
        session.cards_reviewed = len(reviews)
        session.correct_answers = sum(1 for r in reviews if r.quality >= 3)
        session.incorrect_answers = sum(1 for r in reviews if r.quality < 3)
        session.session_end = datetime.utcnow()

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_study_stats(db: Session) -> Dict:
        """Get overall study statistics."""
        total_cards = db.query(StudyCard).count()
        new_cards = db.query(StudyCard).filter(StudyCard.is_new == True).count()
        learning_cards = (
            db.query(StudyCard).filter(StudyCard.is_learning == True).count()
        )
        graduated_cards = (
            db.query(StudyCard).filter(StudyCard.is_graduated == True).count()
        )

        # Cards due today
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)
        due_today = (
            db.query(StudyCard)
            .filter(
                StudyCard.next_review_date
                >= datetime.combine(today, datetime.min.time()),
                StudyCard.next_review_date
                < datetime.combine(tomorrow, datetime.min.time()),
                StudyCard.is_new == False,
            )
            .count()
        )

        return {
            "total_cards": total_cards,
            "new_cards": new_cards,
            "learning_cards": learning_cards,
            "graduated_cards": graduated_cards,
            "due_today": due_today,
        }
