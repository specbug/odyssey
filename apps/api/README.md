# Odyssey API

FastAPI backend for the Odyssey PDF annotation and spaced repetition learning system.

## Quick Start

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Server runs at `http://localhost:8000` (API docs at `http://localhost:8000/docs`)

## Features

- **File Upload with Deduplication**: Upload PDF files with Blake3 hash-based deduplication
- **Metadata Storage**: Store file metadata in SQLite database using SQLAlchemy ORM
- **Annotation Management**: Create, read, update, and delete annotations with highlight positioning
- **Spaced Repetition**: FSRS algorithm implementation for optimal review scheduling
- **Cloze Deletions**: Support for fill-in-the-blank flashcards
- **Timeline API**: Review history and progress tracking
- **File Management**: List, download, and delete uploaded files
- **CORS Support**: Configured for frontend integration

## Tech Stack

- **FastAPI**: Modern, fast web framework for Python
- **SQLAlchemy**: SQL toolkit and ORM
- **SQLite**: Lightweight database (PostgreSQL recommended for production)
- **Blake3**: Fast, secure hashing algorithm
- **Pydantic**: Data validation using Python type hints
- **FSRS**: Spaced repetition scheduling algorithm
- **Uvicorn**: ASGI server

## Installation

1. **Navigate to the API directory**:
```bash
cd apps/api
```

2. **Create a virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Set up environment variables** (optional):
```bash
cp .env.example .env
# Edit .env with your configuration
```

Default configuration works out of the box with SQLite.

5. **Run the application**:
```bash
python run.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- **Interactive API docs**: `http://localhost:8000/docs`
- **Alternative docs**: `http://localhost:8000/redoc`

## Project Structure

```
api/
├── app/                    # Main application code
│   ├── main.py            # FastAPI app and routes
│   ├── models.py          # SQLAlchemy database models
│   ├── schemas.py         # Pydantic schemas
│   ├── database.py        # Database configuration
│   ├── utils.py           # Utility functions
│   └── spaced_repetition.py  # FSRS algorithm implementation
├── scripts/               # Utility scripts
│   ├── migrations/        # Database migration scripts
│   └── tests/            # Test and verification scripts
├── requirements.txt       # Python dependencies
└── run.py                # Application entry point
```

## API Endpoints

### File Management

- `POST /upload` - Upload a PDF file (with deduplication)
- `GET /files` - List all uploaded files
- `GET /files/{file_id}` - Get file metadata
- `GET /files/{file_id}/download` - Download file
- `DELETE /files/{file_id}` - Delete file and its annotations

### Annotation Management

- `POST /files/{file_id}/annotations` - Create annotation with Q&A
- `GET /files/{file_id}/annotations` - Get all annotations for a file
- `PUT /annotations/{annotation_id}` - Update annotation
- `DELETE /annotations/{annotation_id}` - Delete annotation

### Spaced Repetition

- `POST /annotations/{annotation_id}/review` - Record a review with rating
- `GET /annotations/due` - Get annotations due for review
- `GET /annotations/{annotation_id}/schedule` - Get review schedule info

### Timeline & Progress

- `GET /timeline` - Get review history and progress data

### Utility

- `GET /` - Root endpoint
- `GET /health` - Health check

## Configuration

Environment variables (`.env` file):

```env
DATABASE_URL=sqlite:///./pdf_annotations.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50000000  # 50MB
ALLOWED_EXTENSIONS=pdf
HOST=0.0.0.0
PORT=8000
RELOAD=true
```

## File Deduplication

The system uses Blake3 hashing to detect duplicate files:
1. Calculate Blake3 hash of uploaded file
2. Check if hash exists in database
3. If exists, return existing file info
4. If not, save file and create new database record

## Database Schema

### PDFFile
- `id`: Primary key
- `filename`: Unique filename (hash-based)
- `original_filename`: Original uploaded filename
- `file_hash`: Blake3 hash for deduplication
- `file_size`: File size in bytes
- `file_path`: Path to stored file
- `mime_type`: MIME type
- `upload_date`: Upload timestamp
- `last_accessed`: Last access timestamp

### Annotation
- `id`: Primary key
- `file_id`: Foreign key to PDFFile
- `annotation_id`: Client-side annotation ID
- `page_index`: Page number (0-indexed)
- `question`: Question text
- `answer`: Answer text
- `highlighted_text`: Selected text
- `position_data`: JSON string with highlight rectangles
- `is_cloze`: Boolean indicating if this is a cloze deletion
- `cloze_index`: Index for cloze ordering
- `created_date`: Creation timestamp
- `updated_date`: Last update timestamp

### Spaced Repetition (FSRS)
- `review_log`: Review history with timestamps and ratings
- `fsrs_card`: Card state (difficulty, stability, due date, state)
- Integrated with annotation model for seamless scheduling

## Development

### Running in Development Mode

```bash
python run.py
```

### Database Migrations

For production, consider using Alembic for database migrations:

```bash
# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### Testing

Test scripts are available in `scripts/tests/`:

```bash
# Run API tests
python scripts/tests/test_api.py

# Test spaced repetition
python scripts/tests/test_spaced_repetition.py

# Verify FSRS integration
python scripts/tests/test_fsrs_integration.py
```

For unit testing framework:
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Database Migrations

Historical migration scripts are in `scripts/migrations/`:
- `migrate_to_fsrs_schema.py` - Initial FSRS schema
- `migrate_add_cloze_index.py` - Add cloze deletion support
- Additional schema migrations

These are for reference; new installations get the latest schema automatically.

## Production Deployment

1. **Set production environment variables**
2. **Use production database** (PostgreSQL recommended)
3. **Configure reverse proxy** (nginx)
4. **Use production ASGI server** (gunicorn + uvicorn)

Example production command:
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Security Considerations

- File type validation (PDF only)
- File size limits
- Path traversal protection
- CORS configuration
- Input validation with Pydantic
- SQL injection protection with SQLAlchemy

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include descriptive messages for debugging. 