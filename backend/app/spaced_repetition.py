"""
Spaced Repetition Logic using SM-2 Algorithm
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from supermemo2 import first_review, review

from .models import StudyCard, CardReview, ReviewSession, Annotation
from .schemas import StudyCardResponse, CardReviewCreate, CardReviewResult


class SpacedRepetitionService:
    """Service class for handling spaced repetition logic."""

    @staticmethod
    def create_study_card(db: Session, annotation_id: int) -> StudyCard:
        """Create a new study card from an annotation."""
        # Check if study card already exists for this annotation
        existing_card = (
            db.query(StudyCard).filter(StudyCard.annotation_id == annotation_id).first()
        )

        if existing_card:
            return existing_card

        # Create new study card
        study_card = StudyCard(
            annotation_id=annotation_id,
            easiness=2.5,
            interval=1,
            repetitions=0,
            is_new=True,
            is_learning=False,
            is_graduated=False,
            next_review_date=datetime.utcnow() + timedelta(days=1),
        )

        db.add(study_card)
        db.commit()
        db.refresh(study_card)

        return study_card

    @staticmethod
    def get_due_cards(db: Session, limit: int = 50) -> Dict[str, List[StudyCard]]:
        """Get cards that are due for review."""
        now = datetime.utcnow()

        # Get cards that are due for review (not new) with annotation relationship loaded
        due_cards = (
            db.query(StudyCard)
            .join(Annotation, StudyCard.annotation_id == Annotation.id)
            .filter(StudyCard.next_review_date <= now, StudyCard.is_new == False)
            .limit(limit)
            .all()
        )

        # Get new cards with annotation relationship loaded
        new_cards = (
            db.query(StudyCard)
            .join(Annotation, StudyCard.annotation_id == Annotation.id)
            .filter(StudyCard.is_new == True)
            .limit(limit)
            .all()
        )

        return {"due_cards": due_cards, "new_cards": new_cards}

    @staticmethod
    def review_card(
        db: Session,
        card_id: int,
        quality: int,
        time_taken: Optional[int] = None,
        session_id: Optional[int] = None,
    ) -> CardReviewResult:
        """Review a card using SM-2 algorithm."""
        # Get the card
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        # Store pre-review state
        easiness_before = card.easiness
        interval_before = card.interval
        repetitions_before = card.repetitions

        # Calculate new values using SM-2
        if card.is_new:
            # First review
            result = first_review(quality, datetime.utcnow())
        else:
            # Subsequent reviews
            result = review(
                quality=quality,
                easiness=card.easiness,
                interval=card.interval,
                repetitions=card.repetitions,
                review_datetime=datetime.utcnow(),
            )

        # Update card with new values
        card.easiness = result["easiness"]
        card.interval = result["interval"]
        card.repetitions = result["repetitions"]
        card.last_review_date = datetime.utcnow()

        # Convert string datetime to datetime object if needed
        if isinstance(result["review_datetime"], str):
            from dateutil.parser import parse

            card.next_review_date = parse(result["review_datetime"])
        else:
            card.next_review_date = result["review_datetime"]

        # Update card state
        card.is_new = False
        if quality >= 3:
            card.is_learning = False
            card.is_graduated = True
        else:
            card.is_learning = True
            card.is_graduated = False

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
        if quality >= 4:
            message = f"Great! Next review in {card.interval} days."
        elif quality >= 3:
            message = f"Good! Next review in {card.interval} days."
        else:
            message = f"Keep practicing! Next review in {card.interval} days."

        return CardReviewResult(
            card=StudyCardResponse.from_orm(card),
            review=review_record,
            next_review_date=card.next_review_date,
            message=message,
        )

    @staticmethod
    def get_review_options(card: StudyCard) -> List[Dict]:
        """Get preview of review options for a card."""
        options = []

        # Quality ratings and their descriptions
        quality_options = [
            (0, "Complete blackout", "I had no idea"),
            (1, "Incorrect but recognized", "I remembered something but got it wrong"),
            (
                2,
                "Incorrect but familiar",
                "The answer seemed familiar but I got it wrong",
            ),
            (3, "Correct with difficulty", "I got it right but struggled"),
            (4, "Correct with hesitation", "I got it right after thinking"),
            (5, "Perfect recall", "I knew it immediately"),
        ]

        for quality, short_desc, long_desc in quality_options:
            # Calculate what would happen with this quality
            if card.is_new:
                result = first_review(quality, datetime.utcnow())
            else:
                result = review(
                    quality=quality,
                    easiness=card.easiness,
                    interval=card.interval,
                    repetitions=card.repetitions,
                    review_datetime=datetime.utcnow(),
                )

            options.append(
                {
                    "quality": quality,
                    "short_description": short_desc,
                    "long_description": long_desc,
                    "next_interval": result["interval"],
                    "next_review_date": result["review_datetime"],
                    "new_easiness": result["easiness"],
                }
            )

        return options

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
