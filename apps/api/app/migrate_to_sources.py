"""
Database migration script: PDFFile → Source model
This migrates the database to support both PDF files and web pages.

Steps:
1. Rename pdf_files table to sources
2. Add source_type, url, page_title columns
3. Make PDF-specific fields nullable
4. Update foreign key in annotations table
5. Set source_type='pdf' for all existing records
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "pdf_annotations.db"


def run_migration():
    """Run the database migration"""
    print(f"Starting migration on database: {DB_PATH}")

    if not DB_PATH.exists():
        print(f"ERROR: Database not found at {DB_PATH}")
        return False

    # Create backup
    backup_path = str(DB_PATH) + ".backup"
    import shutil
    shutil.copy2(DB_PATH, backup_path)
    print(f"✓ Created backup at: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if migration already ran by checking if pdf_files table still exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pdf_files'")
        if not cursor.fetchone():
            print("Migration already completed (pdf_files table doesn't exist)")
            return True

        print("\n=== Step 1: Ensure sources table exists ===")
        # Check if sources table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE sources (
                    id INTEGER PRIMARY KEY,
                    source_type TEXT NOT NULL DEFAULT 'pdf',
                    filename TEXT,
                    original_filename TEXT,
                    file_hash TEXT,
                    file_size INTEGER,
                    file_path TEXT,
                    mime_type TEXT,
                    url TEXT,
                    page_title TEXT,
                    zoom_level REAL DEFAULT 1.2,
                    last_read_position INTEGER DEFAULT 0,
                    total_pages INTEGER,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ Created sources table")

            # Create indexes
            cursor.execute("CREATE INDEX ix_sources_id ON sources (id)")
            cursor.execute("CREATE INDEX ix_sources_filename ON sources (filename)")
            cursor.execute("CREATE INDEX ix_sources_file_hash ON sources (file_hash)")
            cursor.execute("CREATE UNIQUE INDEX ix_sources_file_hash_unique ON sources (file_hash)")
            cursor.execute("CREATE INDEX ix_sources_url ON sources (url)")
            print("✓ Created indexes on sources table")
        else:
            print("✓ Sources table already exists")

        print("\n=== Step 2: Copy data from pdf_files to sources ===")
        cursor.execute("""
            INSERT INTO sources (
                id, source_type, filename, original_filename, file_hash,
                file_size, file_path, mime_type, zoom_level,
                last_read_position, total_pages, upload_date, last_accessed
            )
            SELECT
                id, 'pdf', filename, original_filename, file_hash,
                file_size, file_path, mime_type, zoom_level,
                last_read_position, total_pages, upload_date, last_accessed
            FROM pdf_files
        """)
        rows_copied = cursor.rowcount
        print(f"✓ Copied {rows_copied} rows from pdf_files to sources")

        print("\n=== Step 3: Create new annotations table with source_id ===")
        cursor.execute("""
            CREATE TABLE annotations_new (
                id INTEGER PRIMARY KEY,
                source_id INTEGER,
                annotation_id TEXT,
                page_index INTEGER,
                question TEXT,
                answer TEXT,
                highlighted_text TEXT,
                position_data TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✓ Created new annotations table")

        # Create indexes
        cursor.execute("CREATE INDEX ix_annotations_new_id ON annotations_new (id)")
        cursor.execute("CREATE INDEX ix_annotations_new_source_id ON annotations_new (source_id)")
        cursor.execute("CREATE INDEX ix_annotations_new_annotation_id ON annotations_new (annotation_id)")
        print("✓ Created indexes on new annotations table")

        print("\n=== Step 4: Copy annotations data (file_id → source_id) ===")
        cursor.execute("""
            INSERT INTO annotations_new (
                id, source_id, annotation_id, page_index, question,
                answer, highlighted_text, position_data, created_date, updated_date
            )
            SELECT
                id, file_id, annotation_id, page_index, question,
                answer, highlighted_text, position_data, created_date, updated_date
            FROM annotations
        """)
        annotations_copied = cursor.rowcount
        print(f"✓ Copied {annotations_copied} annotations")

        print("\n=== Step 5: Drop old tables and rename new ones ===")
        cursor.execute("DROP TABLE annotations")
        cursor.execute("ALTER TABLE annotations_new RENAME TO annotations")
        print("✓ Replaced annotations table")

        cursor.execute("DROP TABLE pdf_files")
        print("✓ Dropped pdf_files table")

        # Commit changes
        conn.commit()
        print("\n=== Migration completed successfully! ===")
        print(f"- {rows_copied} PDF sources migrated")
        print(f"- {annotations_copied} annotations updated")
        print(f"- Backup saved to: {backup_path}")

        return True

    except Exception as e:
        conn.rollback()
        print(f"\n✗ ERROR during migration: {e}")
        print(f"Database has been rolled back. Backup available at: {backup_path}")
        return False

    finally:
        conn.close()


if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)
