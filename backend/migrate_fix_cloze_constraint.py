"""
Migration script to fix the unique constraint on study_cards table.

This removes the UNIQUE constraint from annotation_id alone and adds a
composite UNIQUE constraint on (annotation_id, cloze_index) to support
multiple cloze cards per annotation.

Since SQLite doesn't support modifying constraints, we recreate the table.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "pdf_annotations.db")


def migrate():
    """Recreate study_cards table with correct constraints for cloze support."""

    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Starting migration to fix cloze constraints...")

        # 1. Create new table with correct schema
        print("Creating new study_cards table with correct constraints...")
        cursor.execute("""
            CREATE TABLE study_cards_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                annotation_id INTEGER NOT NULL,
                cloze_index INTEGER DEFAULT NULL,
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
                FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE,
                UNIQUE (annotation_id, cloze_index)
            )
        """)

        # 2. Copy data from old table to new table
        print("Copying existing data...")
        cursor.execute("""
            INSERT INTO study_cards_new
                (id, annotation_id, cloze_index, difficulty, stability, elapsed_days,
                 scheduled_days, reps, lapses, state, last_review, created_date, due)
            SELECT
                id, annotation_id, cloze_index, difficulty, stability, elapsed_days,
                scheduled_days, reps, lapses, state, last_review, created_date, due
            FROM study_cards
        """)

        # 3. Drop old table
        print("Dropping old table...")
        cursor.execute("DROP TABLE study_cards")

        # 4. Rename new table
        print("Renaming new table...")
        cursor.execute("ALTER TABLE study_cards_new RENAME TO study_cards")

        # 5. Recreate indices
        print("Recreating indices...")
        cursor.execute("CREATE INDEX ix_study_cards_annotation_id ON study_cards (annotation_id)")

        conn.commit()
        print("✓ Successfully migrated study_cards table!")
        print("✓ New constraint: UNIQUE(annotation_id, cloze_index)")
        print("ℹ Multiple cards per annotation are now supported for cloze deletions")

    except sqlite3.Error as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
