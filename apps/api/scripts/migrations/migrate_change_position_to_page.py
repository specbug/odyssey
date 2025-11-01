"""
Migration script to change last_read_position from Float (percentage) to Integer (page index).
Run this once to update your existing database schema.

Note: This will reset all saved reading positions to page 0, since we can't reliably
convert percentages to page numbers without knowing the total number of pages per file.
"""
import sqlite3
import os

# Path to your database (apps/api/pdf_annotations.db)
DB_PATH = os.path.join(os.path.dirname(__file__), "../..", "pdf_annotations.db")

def migrate():
    """Change last_read_position from Float to Integer and reset all values to 0."""

    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("No migration needed - database will be created with correct schema on first run.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check current column type
        cursor.execute("PRAGMA table_info(pdf_files)")
        columns = {column[1]: column[2] for column in cursor.fetchall()}

        if "last_read_position" not in columns:
            print("✗ last_read_position column doesn't exist - cannot migrate")
            return

        current_type = columns["last_read_position"]

        if current_type == "INTEGER":
            print("✓ last_read_position is already INTEGER - no migration needed")
            return

        print(f"Current type: {current_type}")
        print("Converting last_read_position from Float to Integer...")

        # SQLite doesn't support ALTER COLUMN TYPE directly, so we need to:
        # 1. Create new column
        # 2. Copy data (converting to page 0 for all)
        # 3. Drop old column
        # 4. Rename new column

        # Create temporary column
        cursor.execute("ALTER TABLE pdf_files ADD COLUMN last_read_page INTEGER DEFAULT 0")
        print("✓ Created temporary column last_read_page")

        # Set all values to 0 (reset reading positions)
        cursor.execute("UPDATE pdf_files SET last_read_page = 0")
        print("✓ Reset all reading positions to page 0")

        # Drop old column (SQLite 3.35.0+ supports this, for older versions we'd need to recreate table)
        try:
            cursor.execute("ALTER TABLE pdf_files DROP COLUMN last_read_position")
            print("✓ Dropped old column last_read_position")
        except sqlite3.OperationalError as e:
            if "no such column" in str(e).lower():
                print("⚠ Old column already dropped")
            else:
                # Older SQLite version doesn't support DROP COLUMN
                print("⚠ SQLite version doesn't support DROP COLUMN, keeping both columns")
                print("  (The old column will be ignored by the application)")

        # Rename new column to original name
        try:
            cursor.execute("ALTER TABLE pdf_files RENAME COLUMN last_read_page TO last_read_position")
            print("✓ Renamed column to last_read_position")
        except sqlite3.OperationalError as e:
            print(f"⚠ Could not rename column: {e}")
            print("  Using last_read_page instead - update models.py accordingly")

        conn.commit()
        print("✓ Successfully migrated last_read_position to INTEGER (page index)")
        print("  All reading positions have been reset to page 0")

    except sqlite3.Error as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
