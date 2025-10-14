"""
Spaced Repetition Logic using FSRS (Free Spaced Repetition Scheduler) Algorithm

This module provides a clean implementation of the FSRS algorithm for optimal
spaced repetition scheduling with 4-button review system.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from fsrs import FSRS, Card, Rating

from .models import StudyCard, CardReview, ReviewSession, Annotation
from .schemas import StudyCardResponse, CardReviewCreate, CardReviewResult


class SpacedRepetitionService:
    """Service class for handling FSRS spaced repetition logic."""

    # Initialize FSRS scheduler with default parameters (0.9 retention rate)
    scheduler = FSRS()

    # Rating labels for user interface
    RATING_LABELS = {
        Rating.Again: "Forgot",
        Rating.Hard: "Hard",
        Rating.Good: "Good",
        Rating.Easy: "Easy",
    }

    @staticmethod
    def _fsrs_card_to_study_card(fsrs_card: Card, study_card: StudyCard) -> None:
        """Update StudyCard database model from FSRS Card object."""
        study_card.difficulty = fsrs_card.difficulty
        study_card.stability = fsrs_card.stability
        study_card.elapsed_days = fsrs_card.elapsed_days
        study_card.scheduled_days = fsrs_card.scheduled_days
        study_card.reps = fsrs_card.reps
        study_card.lapses = fsrs_card.lapses
        study_card.state = fsrs_card.state.name
        study_card.last_review = datetime.utcnow()  # Track in database, not in FSRS Card
        study_card.due = fsrs_card.due

    @staticmethod
    def _study_card_to_fsrs_card(study_card: StudyCard) -> Card:
        """Convert StudyCard database model to FSRS Card object."""
        from fsrs import State

        # Map string state to FSRS State enum
        state_map = {
            "New": State.New,
            "Learning": State.Learning,
            "Review": State.Review,
            "Relearning": State.Relearning,
        }

        # Create card and set attributes
        card = Card()
        card.difficulty = study_card.difficulty
        card.stability = study_card.stability
        card.elapsed_days = study_card.elapsed_days
        card.scheduled_days = study_card.scheduled_days
        card.reps = study_card.reps
        card.lapses = study_card.lapses
        card.state = state_map.get(study_card.state, State.New)
        card.due = study_card.due if study_card.due else datetime.utcnow()

        # Set last_review if the card has been reviewed before
        if study_card.last_review:
            card.last_review = study_card.last_review

        return card

    @staticmethod
    def get_card_timeline(card: StudyCard) -> Dict:
        """
        Calculate timeline for a study card showing future review dates based on different ratings.

        Args:
            card: The study card to calculate timeline for

        Returns:
            Dictionary containing timeline data for each rating (Again, Hard, Good, Easy)
        """
        current_time = datetime.utcnow()
        timeline_points = []

        # Get current card state
        current_state = card.state

        # Convert to FSRS card
        fsrs_card = SpacedRepetitionService._study_card_to_fsrs_card(card)

        # Calculate timeline for each rating
        for rating in [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]:
            # Get scheduling info from FSRS
            scheduling_info = SpacedRepetitionService.scheduler.repeat(fsrs_card, current_time)
            scheduled_card = scheduling_info[rating].card

            # Calculate interval information
            interval_days = scheduled_card.scheduled_days
            next_due = scheduled_card.due

            # Format interval text
            if interval_days == 0:
                interval_text = "< 1 day"
            elif interval_days == 1:
                interval_text = "1 day"
            elif interval_days < 30:
                interval_text = f"{interval_days} days"
            elif interval_days < 365:
                months = interval_days // 30
                remaining_days = interval_days % 30
                if remaining_days == 0:
                    interval_text = f"{months} mo"
                else:
                    interval_text = f"{months} mo {remaining_days} d"
            else:
                years = interval_days // 365
                remaining_days = interval_days % 365
                if remaining_days == 0:
                    interval_text = f"{years} yr"
                else:
                    interval_text = f"{years} yr {remaining_days} d"

            # Create timeline point
            timeline_point = {
                "rating": rating.value,
                "rating_label": SpacedRepetitionService.RATING_LABELS[rating],
                "next_review_date": next_due,
                "interval_days": interval_days,
                "interval_text": interval_text,
                "card_state": scheduled_card.state.name,
                "difficulty_after": scheduled_card.difficulty,
                "stability_after": scheduled_card.stability,
            }

            timeline_points.append(timeline_point)

        # Create timeline response
        timeline_data = {
            "card_id": card.id,
            "current_state": current_state,
            "current_difficulty": card.difficulty,
            "current_stability": card.stability,
            "current_scheduled_days": card.scheduled_days,
            "next_review_date": card.due,
            "timeline_points": timeline_points,
            "generated_at": current_time,
        }

        return timeline_data

    @staticmethod
    def get_card_progression(card: StudyCard, steps: int = 4) -> Dict:
        """
        Calculate future progression intervals assuming user rates Good each time.

        Args:
            card: The study card to calculate progression for
            steps: Number of future intervals to calculate (default 4)

        Returns:
            Dictionary containing progression intervals
        """
        current_time = datetime.utcnow()
        progression_intervals = []

        # Convert to FSRS card for simulation
        fsrs_card = SpacedRepetitionService._study_card_to_fsrs_card(card)
        simulation_time = current_time

        for step in range(steps):
            # Simulate a Good review
            scheduling_info = SpacedRepetitionService.scheduler.repeat(fsrs_card, simulation_time)
            fsrs_card = scheduling_info[Rating.Good].card

            # Calculate interval information
            interval_days = fsrs_card.scheduled_days
            next_due = fsrs_card.due

            # Format interval text
            if interval_days < 7:
                interval_text = f"{interval_days}d"
            elif interval_days < 30:
                weeks = interval_days // 7
                remaining_days = interval_days % 7
                if remaining_days == 0:
                    interval_text = f"{weeks}w"
                else:
                    interval_text = f"{weeks}w{remaining_days}d"
            elif interval_days < 365:
                months = interval_days // 30
                remaining_days = interval_days % 30
                if remaining_days == 0:
                    interval_text = f"{months}mo"
                else:
                    interval_text = f"{months}mo{remaining_days}d"
            else:
                years = interval_days // 365
                remaining_days = interval_days % 365
                if remaining_days == 0:
                    interval_text = f"{years}y"
                else:
                    interval_text = f"{years}y{remaining_days}d"

            progression_intervals.append(
                {
                    "step": step + 1,
                    "interval_text": interval_text,
                    "interval_days": interval_days,
                    "next_review_date": next_due,
                    "card_state": fsrs_card.state.name,
                    "difficulty": fsrs_card.difficulty,
                    "stability": fsrs_card.stability,
                }
            )

            # Move simulation time forward
            simulation_time = next_due

        return {
            "card_id": card.id,
            "current_state": card.state,
            "progression_intervals": progression_intervals,
            "generated_at": current_time,
        }

    @staticmethod
    def create_study_card(db: Session, annotation_id: int) -> StudyCard:
        """Create a new study card from an annotation using FSRS.

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

        # Create new FSRS card (starts in New state)
        fsrs_card = Card()
        now = datetime.utcnow()

        # Create new study card with FSRS initialization
        try:
            study_card = StudyCard(
                annotation_id=annotation_id,
                difficulty=fsrs_card.difficulty,
                stability=fsrs_card.stability,
                elapsed_days=fsrs_card.elapsed_days,
                scheduled_days=fsrs_card.scheduled_days,
                reps=fsrs_card.reps,
                lapses=fsrs_card.lapses,
                state=fsrs_card.state.name,
                last_review=None,
                due=now,  # New cards are available immediately
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
        """Get cards that are due for review, properly categorized by FSRS state."""
        now = datetime.utcnow()

        # Get all cards that are due for review
        all_due_cards = (
            db.query(StudyCard)
            .filter(StudyCard.due <= now)
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

        # Categorize cards by FSRS state
        new_cards = [card for card in all_due_cards if card.state == "New"]
        learning_cards = [
            card for card in all_due_cards
            if card.state in ["Learning", "Relearning"]
        ]
        review_cards = [
            card for card in all_due_cards if card.state == "Review"
        ]

        return {
            "due_cards": review_cards,  # Review state cards
            "new_cards": new_cards,  # New cards
            "learning_cards": learning_cards,  # Learning/Relearning cards
        }

    @staticmethod
    def review_card(
        db: Session,
        card_id: int,
        rating: int,
        time_taken: Optional[int] = None,
        session_id: Optional[int] = None,
    ) -> CardReviewResult:
        """Review a card using FSRS algorithm with 4-button rating system.

        Args:
            db: Database session
            card_id: ID of the card to review
            rating: Rating from 1-4 (Again=1, Hard=2, Good=3, Easy=4)
            time_taken: Optional time taken in seconds
            session_id: Optional review session ID
        """
        # Get the card first
        card = db.query(StudyCard).filter(StudyCard.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        # Try to load annotation relationship if it exists
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
                pass

        # Convert rating (1-4) to FSRS Rating enum
        rating_map = {
            1: Rating.Again,
            2: Rating.Hard,
            3: Rating.Good,
            4: Rating.Easy,
        }

        if rating not in rating_map:
            raise ValueError(f"Invalid rating: {rating}. Must be 1-4 (Again, Hard, Good, Easy)")

        fsrs_rating = rating_map[rating]

        # Store pre-review state
        state_before = card.state
        difficulty_before = card.difficulty
        stability_before = card.stability

        # Convert to FSRS card and perform review
        fsrs_card = SpacedRepetitionService._study_card_to_fsrs_card(card)
        now = datetime.utcnow()

        # Get scheduling info from FSRS
        scheduling_info = SpacedRepetitionService.scheduler.repeat(fsrs_card, now)
        scheduled_card_info = scheduling_info[fsrs_rating]

        # Update card with new FSRS state
        SpacedRepetitionService._fsrs_card_to_study_card(scheduled_card_info.card, card)

        # Create review record
        review_record = CardReview(
            card_id=card_id,
            session_id=session_id,
            rating=rating,
            time_taken=time_taken,
            state_before=state_before,
            difficulty_before=difficulty_before,
            stability_before=stability_before,
            state_after=card.state,
            difficulty_after=card.difficulty,
            stability_after=card.stability,
            scheduled_days_after=card.scheduled_days,
        )

        db.add(review_record)
        db.commit()
        db.refresh(card)
        db.refresh(review_record)

        # Generate result message
        message = SpacedRepetitionService._generate_review_message(card, rating)

        return CardReviewResult(
            card=StudyCardResponse.from_orm(card),
            review=review_record,
            next_review_date=card.due,
            message=message,
        )

    @staticmethod
    def _generate_review_message(card: StudyCard, rating: int) -> str:
        """Generate appropriate message based on review outcome."""
        interval_days = card.scheduled_days

        # Format interval for message
        if interval_days == 0:
            interval_str = "less than 1 day"
        elif interval_days == 1:
            interval_str = "1 day"
        elif interval_days < 30:
            interval_str = f"{interval_days} days"
        elif interval_days < 365:
            months = interval_days // 30
            interval_str = f"about {months} month{'s' if months > 1 else ''}"
        else:
            years = interval_days // 365
            interval_str = f"about {years} year{'s' if years > 1 else ''}"

        rating_messages = {
            1: f"Keep practicing! This card will return in {interval_str}.",
            2: f"Getting there. Next review in {interval_str}.",
            3: f"Good! Next review in {interval_str}.",
            4: f"Excellent! Next review in {interval_str}.",
        }

        return rating_messages.get(rating, f"Next review in {interval_str}.")

    @staticmethod
    def get_review_options(card: StudyCard) -> List[Dict]:
        """Get preview of review options for a card showing FSRS scheduling."""
        fsrs_card = SpacedRepetitionService._study_card_to_fsrs_card(card)
        now = datetime.utcnow()

        # Get scheduling info from FSRS for all ratings
        scheduling_info = SpacedRepetitionService.scheduler.repeat(fsrs_card, now)

        options = []
        rating_info = [
            (1, Rating.Again, "Forgot", "I completely forgot"),
            (2, Rating.Hard, "Hard", "I remembered with difficulty"),
            (3, Rating.Good, "Good", "I remembered normally"),
            (4, Rating.Easy, "Easy", "I remembered instantly"),
        ]

        for rating_val, fsrs_rating, short_desc, long_desc in rating_info:
            scheduled_card = scheduling_info[fsrs_rating].card
            interval_days = scheduled_card.scheduled_days

            # Format interval text
            if interval_days == 0:
                interval_text = "< 1 day"
            elif interval_days == 1:
                interval_text = "1 day"
            else:
                interval_text = f"{interval_days} days"

            options.append({
                "rating": rating_val,
                "short_description": short_desc,
                "long_description": long_desc,
                "next_interval_text": interval_text,
            })

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
        # In FSRS, rating 1 (Again) means incorrect, 2-4 mean correct with varying difficulty
        session.correct_answers = sum(1 for r in reviews if r.rating >= 2)
        session.incorrect_answers = sum(1 for r in reviews if r.rating == 1)
        session.session_end = datetime.utcnow()

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_study_stats(db: Session) -> Dict:
        """Get overall study statistics."""
        total_cards = db.query(StudyCard).count()
        new_cards = db.query(StudyCard).filter(StudyCard.state == "New").count()
        learning_cards = (
            db.query(StudyCard)
            .filter(StudyCard.state.in_(["Learning", "Relearning"]))
            .count()
        )
        review_cards = (
            db.query(StudyCard).filter(StudyCard.state == "Review").count()
        )

        # Cards due today
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)
        due_today = (
            db.query(StudyCard)
            .filter(
                StudyCard.due >= datetime.combine(today, datetime.min.time()),
                StudyCard.due < datetime.combine(tomorrow, datetime.min.time()),
            )
            .count()
        )

        return {
            "total_cards": total_cards,
            "new_cards": new_cards,
            "learning_cards": learning_cards,
            "review_cards": review_cards,
            "due_today": due_today,
        }
