#!/usr/bin/env python3
"""
FSRS Migration Script

This script migrates existing StudyCards from the old SM-2 system to the new FSRS system.
Since we're treating all existing cards as "starting fresh", this is a simple reset.

Usage:
    python fsrs_migration.py
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from app.database import SessionLocal
from app.models import StudyCard
from fsrs import Card


def migrate_study_cards():
    """Migrate all existing study cards to FSRS format."""
    db = SessionLocal()

    try:
        print("🔄 Starting FSRS Migration...")
        print("=" * 60)

        # Get all existing cards
        cards = db.query(StudyCard).all()
        total_cards = len(cards)

        if total_cards == 0:
            print("✅ No cards to migrate. Database is ready for FSRS!")
            return

        print(f"📊 Found {total_cards} study cards to migrate")
        print()

        migrated = 0
        errors = 0

        for card in cards:
            try:
                # Create a fresh FSRS card (New state)
                fsrs_card = Card()
                now = datetime.utcnow()

                # Reset to FSRS initial values
                card.difficulty = fsrs_card.difficulty
                card.stability = fsrs_card.stability
                card.elapsed_days = fsrs_card.elapsed_days
                card.scheduled_days = fsrs_card.scheduled_days
                card.reps = fsrs_card.reps
                card.lapses = fsrs_card.lapses
                card.state = fsrs_card.state.name
                card.last_review = None
                card.due = now  # Make all cards available immediately

                migrated += 1

                if migrated % 10 == 0:
                    print(f"   Migrated {migrated}/{total_cards} cards...")

            except Exception as e:
                print(f"   ❌ Error migrating card {card.id}: {str(e)}")
                errors += 1

        # Commit all changes
        db.commit()

        print()
        print("=" * 60)
        print("✅ Migration Complete!")
        print(f"   • Successfully migrated: {migrated} cards")
        print(f"   • Errors: {errors} cards")
        print(f"   • All cards reset to 'New' state with FSRS")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_study_cards()
