#!/usr/bin/env python3
"""
Test script to check database directly after deletion.
"""

import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import StudyCard, Annotation


def check_database_after_deletion():
    """Check database state after deletion."""

    db = SessionLocal()

    try:
        # Check annotations
        annotations = db.query(Annotation).all()
        print(f"📊 Total annotations in DB: {len(annotations)}")
        for ann in annotations:
            print(f"   Annotation ID: {ann.id}, annotation_id: {ann.annotation_id}")

        # Check study cards
        study_cards = db.query(StudyCard).all()
        print(f"📊 Total study cards in DB: {len(study_cards)}")
        for card in study_cards:
            print(f"   Study card ID: {card.id}, annotation_id: {card.annotation_id}")

        # Check for orphaned study cards
        orphaned_cards = (
            db.query(StudyCard)
            .filter(~StudyCard.annotation_id.in_(db.query(Annotation.id).subquery()))
            .all()
        )

        print(f"📊 Orphaned study cards: {len(orphaned_cards)}")
        for card in orphaned_cards:
            print(
                f"   Orphaned card ID: {card.id}, references annotation_id: {card.annotation_id}"
            )

    except Exception as e:
        print(f"❌ Database check failed: {str(e)}")

    finally:
        db.close()


if __name__ == "__main__":
    check_database_after_deletion()
