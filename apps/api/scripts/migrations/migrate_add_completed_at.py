"""
Migration script to add completed_at column to pdf_files table.
Run this script to update the database schema.
"""

import sqlite3
import os


def migrate_database():
    db_path = os.path.join(os.path.dirname(__file__), "../..", "pdf_annotations.db")

    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False

    print(f"📂 Found database at: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(pdf_files)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'completed_at' in columns:
            print("✅ Column 'completed_at' already exists, skipping migration")
            conn.close()
            return True

        print("🔧 Adding 'completed_at' column to pdf_files table...")
        cursor.execute("""
            ALTER TABLE pdf_files
            ADD COLUMN completed_at DATETIME
        """)

        conn.commit()
        print("✅ Migration completed successfully!")
        print("   Added column: completed_at (DATETIME, nullable)")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("  Database Migration: Add completed_at Column")
    print("=" * 50)
    print()

    success = migrate_database()

    print()
    if success:
        print("🎉 Migration completed! Your database is up to date.")
    else:
        print("⚠️  Migration failed. Please check the error above.")
    print()
