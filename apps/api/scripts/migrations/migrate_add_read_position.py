"""
Migration script to add last_read_position column to pdf_files table.
Run this once to update your existing database schema.
"""
import sqlite3
import os

# Path to your database (apps/api/pdf_annotations.db)
DB_PATH = os.path.join(os.path.dirname(__file__), "../..", "pdf_annotations.db")

def migrate():
    """Add last_read_position column to pdf_files table if it doesn't exist."""

    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("No migration needed - database will be created with correct schema on first run.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(pdf_files)")
        columns = [column[1] for column in cursor.fetchall()]

        if "last_read_position" in columns:
            print("✓ last_read_position column already exists - no migration needed")
            return

        # Add the column with default value
        print("Adding last_read_position column to pdf_files table...")
        cursor.execute("ALTER TABLE pdf_files ADD COLUMN last_read_position REAL DEFAULT 0.0")
        conn.commit()
        print("✓ Successfully added last_read_position column with default value 0.0")

    except sqlite3.Error as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
