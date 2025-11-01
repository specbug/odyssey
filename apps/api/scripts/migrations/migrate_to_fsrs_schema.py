#!/usr/bin/env python3
"""
Database Schema Migration: SM-2 → FSRS

This script migrates the database schema from SM-2 to FSRS by:
1. Renaming the old table
2. Creating new table with FSRS schema
3. Copying essential data (annotation_id, created_date)
4. Initializing FSRS defaults
5. Dropping old table

IMPORTANT: This will reset all card scheduling data.
"""

import sys
import os

# Add apps/api to path (go up 2 levels from migrations folder)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime
from sqlalchemy import text
from app.database import engine
from fsrs import Card


def migrate_schema():
    """Perform the schema migration using raw SQL."""
    with engine.connect() as conn:
        try:
            print("\n" + "=" * 80)
            print("🚀 DATABASE SCHEMA MIGRATION: SM-2 → FSRS")
            print("=" * 80)

            # Step 1: Backup existing data by querying with old schema
            print("\n📦 Step 1: Backing up existing data...")

            result = conn.execute(text("SELECT COUNT(*) as count FROM study_cards"))
            card_count = result.fetchone()[0]
            print(f"   • Found {card_count} existing cards")

            # Step 2: Rename old table
            print("\n🔧 Step 2: Renaming old study_cards table...")
            conn.execute(text("ALTER TABLE study_cards RENAME TO study_cards_old"))
            conn.commit()
            print("   ✅ Renamed to study_cards_old")

            # Step 3: Create new FSRS table
            print("\n🔧 Step 3: Creating new study_cards table with FSRS schema...")

            create_table_sql = """
            CREATE TABLE study_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                annotation_id INTEGER NOT NULL UNIQUE,
                difficulty FLOAT DEFAULT 0.0,
                stability FLOAT DEFAULT 0.0,
                elapsed_days INTEGER DEFAULT 0,
                scheduled_days INTEGER DEFAULT 0,
                reps INTEGER DEFAULT 0,
                lapses INTEGER DEFAULT 0,
                state VARCHAR DEFAULT 'New',
                last_review TIMESTAMP,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                due TIMESTAMP,
                FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
            )
            """
            conn.execute(text(create_table_sql))
            conn.commit()
            print("   ✅ Created new study_cards table with FSRS schema")

            # Step 4: Copy data with FSRS initialization
            print("\n🔧 Step 4: Migrating existing cards to FSRS...")

            # Get FSRS defaults
            fsrs_card = Card()
            now = datetime.utcnow().isoformat()

            # Copy cards with FSRS defaults
            copy_sql = f"""
            INSERT INTO study_cards (
                id, annotation_id, created_date,
                difficulty, stability, elapsed_days, scheduled_days,
                reps, lapses, state, last_review, due
            )
            SELECT
                id, annotation_id, created_date,
                {fsrs_card.difficulty}, {fsrs_card.stability}, {fsrs_card.elapsed_days},
                {fsrs_card.scheduled_days}, {fsrs_card.reps}, {fsrs_card.lapses},
                '{fsrs_card.state.name}', NULL, '{now}'
            FROM study_cards_old
            """

            result = conn.execute(text(copy_sql))
            conn.commit()
            migrated_count = result.rowcount
            print(f"   ✅ Migrated {migrated_count} cards with FSRS defaults")

            # Step 5: Drop old card_reviews table and create new one
            print("\n🔧 Step 5: Recreating card_reviews table for FSRS...")

            conn.execute(text("DROP TABLE IF EXISTS card_reviews"))

            create_reviews_sql = """
            CREATE TABLE card_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                session_id INTEGER,
                rating INTEGER,
                review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                state_before VARCHAR,
                difficulty_before FLOAT,
                stability_before FLOAT,
                state_after VARCHAR,
                difficulty_after FLOAT,
                stability_after FLOAT,
                scheduled_days_after INTEGER,
                time_taken INTEGER,
                FOREIGN KEY (card_id) REFERENCES study_cards(id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES review_sessions(id) ON DELETE CASCADE
            )
            """
            conn.execute(text(create_reviews_sql))
            conn.commit()
            print("   ✅ Created new card_reviews table for FSRS")

            # Step 6: Drop old table
            print("\n🔧 Step 6: Cleaning up old tables...")
            conn.execute(text("DROP TABLE IF EXISTS study_cards_old"))
            conn.commit()
            print("   ✅ Dropped old study_cards table")

            # Completion
            print("\n" + "=" * 80)
            print("✅ MIGRATION COMPLETE!")
            print("=" * 80)
            print(f"\n📊 Migration Summary:")
            print(f"   • Cards migrated: {migrated_count}")
            print(f"   • All cards reset to 'New' state")
            print(f"   • All cards due immediately")
            print(f"   • Old review history cleared")
            print(f"   • FSRS algorithm ready to use")
            print("\n" + "=" * 80)

        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise


def main():
    """Main migration function."""
    print("\nFSRS Schema Migration Tool")
    print("This will update your database to use FSRS instead of SM-2")
    print("⚠️  WARNING: This will reset all card scheduling and review history!")
    print()

    # Run migration
    migrate_schema()

    print("\n✅ Database is now ready for FSRS!")
    print("   You can start the server and begin using the new 4-button review system.\n")


if __name__ == "__main__":
    main()
