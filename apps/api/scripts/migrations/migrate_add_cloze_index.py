"""
Migration script to add cloze_index column to study_cards table
and handle the unique constraint transition.

This migration supports cloze deletion flashcards where multiple study cards
can be created from a single annotation (one per cloze index).

Run this once to update your existing database schema.
"""
import sqlite3
import os

# Path to your database (apps/api/pdf_annotations.db)
DB_PATH = os.path.join(os.path.dirname(__file__), "../..", "pdf_annotations.db")


def migrate():
    """Add cloze_index column to study_cards table if it doesn't exist."""

    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("No migration needed - database will be created with correct schema on first run.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(study_cards)")
        columns = [column[1] for column in cursor.fetchall()]

        if "cloze_index" in columns:
            print("✓ cloze_index column already exists - no migration needed")
            return

        # Add the column (nullable for backward compatibility)
        print("Adding cloze_index column to study_cards table...")
        cursor.execute("ALTER TABLE study_cards ADD COLUMN cloze_index INTEGER DEFAULT NULL")
        conn.commit()
        print("✓ Successfully added cloze_index column")

        # Note: SQLite doesn't support modifying constraints directly
        # The unique constraint on (annotation_id, cloze_index) will be enforced
        # by the updated model definition for new cards
        print("ℹ Note: Existing cards will have cloze_index=NULL (basic cards)")
        print("ℹ New cloze cards will have cloze_index set to their cloze number (1, 2, 3, etc.)")

    except sqlite3.Error as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
