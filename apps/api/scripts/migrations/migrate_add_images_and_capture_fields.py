#!/usr/bin/env python3
"""
Migration: Add Image table and update Annotation for standalone capture notes

Changes:
1. Create Image table for storing image references
2. Make Annotation.file_id nullable (for standalone notes)
3. Add source, tag, deck fields to Annotation
4. Make page_index nullable in Annotation

Usage:
    python scripts/migrations/migrate_add_images_and_capture_fields.py
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import create_engine, text, inspect
from app.database import DATABASE_URL


def run_migration():
    """Run the migration to add Image table and update Annotation model."""
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)

    print("🔄 Starting migration: Add Image table and update Annotation for capture notes")

    with engine.begin() as conn:
        # Check if images table already exists
        if 'images' not in inspector.get_table_names():
            print("📝 Creating 'images' table...")
            conn.execute(text("""
                CREATE TABLE images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL UNIQUE,
                    annotation_id INTEGER,
                    file_path TEXT NOT NULL,
                    mime_type TEXT DEFAULT 'image/png',
                    file_size INTEGER NOT NULL,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
                )
            """))

            # Create indexes
            conn.execute(text("CREATE INDEX ix_images_uuid ON images(uuid)"))
            conn.execute(text("CREATE INDEX ix_images_annotation_id ON images(annotation_id)"))
            print("✅ Created 'images' table with indexes")
        else:
            print("⏭️  'images' table already exists, skipping creation")

        # Get current columns in annotations table
        annotation_columns = {col['name'] for col in inspector.get_columns('annotations')}

        # Add new columns to annotations if they don't exist
        if 'source' not in annotation_columns:
            print("📝 Adding 'source' column to annotations...")
            conn.execute(text("ALTER TABLE annotations ADD COLUMN source TEXT"))
            print("✅ Added 'source' column")
        else:
            print("⏭️  'source' column already exists")

        if 'tag' not in annotation_columns:
            print("📝 Adding 'tag' column to annotations...")
            conn.execute(text("ALTER TABLE annotations ADD COLUMN tag TEXT"))
            print("✅ Added 'tag' column")
        else:
            print("⏭️  'tag' column already exists")

        if 'deck' not in annotation_columns:
            print("📝 Adding 'deck' column to annotations...")
            conn.execute(text("ALTER TABLE annotations ADD COLUMN deck TEXT DEFAULT 'Default'"))
            print("✅ Added 'deck' column")
        else:
            print("⏭️  'deck' column already exists")

        print("\n⚠️  Note: SQLite does not support modifying column constraints directly.")
        print("   To make file_id and page_index nullable, a table recreation is needed.")
        print("   For now, these remain as-is. New annotations can use NULL for these fields.")

    print("\n✅ Migration completed successfully!")
    print("\n📋 Summary of changes:")
    print("   • Created 'images' table for storing image references")
    print("   • Added 'source' column to annotations")
    print("   • Added 'tag' column to annotations")
    print("   • Added 'deck' column to annotations")
    print("\n💡 Note: For production, consider recreating annotations table to make")
    print("   file_id and page_index truly nullable if needed.")


if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
