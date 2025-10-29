# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Odyssey is an intelligent PDF annotation and spaced repetition learning system built with a FastAPI backend, React web frontend, and native macOS app. The system uses the FSRS (Free Spaced Repetition Scheduler) algorithm for optimal knowledge retention through scientifically-optimized review scheduling.

## Architecture

### Monorepo Structure

The project is organized as a monorepo with three main applications:

- **apps/api**: FastAPI backend (Python)
- **apps/webapp**: React web frontend (JavaScript)
- **apps/mac**: Native macOS app (Swift/SwiftUI)

### Backend (apps/api)

The FastAPI backend implements:

- **File Management**: Blake3 hash-based deduplication for PDF uploads
- **Annotation System**: Create/read/update/delete annotations with support for standalone notes (not linked to PDFs)
- **FSRS Spaced Repetition**: Core scheduling algorithm in `app/spaced_repetition.py`
- **Image Storage**: UUID-based image storage with `[image:UUID]` markers in annotation text
- **Database**: SQLAlchemy ORM with SQLite (models in `app/models.py`)

Key backend modules:
- `app/main.py`: FastAPI application with all REST endpoints
- `app/models.py`: SQLAlchemy database models (PDFFile, Annotation, StudyCard, CardReview, ReviewSession, Image)
- `app/spaced_repetition.py`: FSRS algorithm implementation via `SpacedRepetitionService` class
- `app/schemas.py`: Pydantic schemas for request/response validation
- `app/database.py`: Database session management
- `app/utils.py`: File handling utilities (hashing, validation, storage)

### Frontend (apps/webapp)

React-based SPA with:

- **PDF Rendering**: react-pdf with virtualized page rendering (react-window)
- **Annotation UI**: Highlight creation, cloze deletion support
- **LaTeX Rendering**: KaTeX integration for math expressions
- **Review Modal**: Spaced repetition review interface with FSRS timeline visualization
- **Color Coding**: Dynamic highlight colors based on review performance

Main components in `apps/webapp/src/`:
- `App.js`: Main PDF viewer and annotation interface
- `HomePage.js`: File management and home screen
- `ReviewModal.js`: Spaced repetition review UI
- `api.js`: Backend API client
- `clozeUtils.js`: Cloze deletion parsing/rendering utilities
- `colorUtils.js`: Color generation for highlights based on FSRS state

### Native Mac App (apps/mac)

SwiftUI-based native macOS application (requires macOS 14+) with:

- **Browse View**: File and annotation browsing
- **Study View**: Native spaced repetition review interface
- **Capture View**: Quick capture with image support
- **LaTeX Support**: Native LaTeX rendering
- **Design System**: Custom button styles and design tokens

Key Swift modules in `Sources/OdysseyMacApp/`:
- `App/`: App state and main entry point
- `Services/Backend.swift`: API client communicating with FastAPI backend
- `Views/`: SwiftUI views (BrowseView, StudyView, CaptureView, etc.)
- `ViewModels/`: MVVM view models (BrowseViewModel, StudyViewModel)
- `Models/APIModels.swift`: Codable models matching backend API schemas

## Development Commands

### Backend API

```bash
# Setup
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run
python run.py
# API available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Web Frontend

```bash
# Setup & Run
cd apps/webapp
npm install
npm start
# Opens at http://localhost:3000

# Build for production
npm run build

# Run tests
npm test
```

### Native Mac App

```bash
cd apps/mac/OdysseyMacApp

# Build
swift build

# Run
swift run OdysseyMacApp

# Test
swift test
```

## Key Technical Details

### FSRS Algorithm

The spaced repetition system uses FSRS (not Anki's SM-2). Key concepts:

- **4-button rating system**: Again (1), Hard (2), Good (3), Easy (4)
- **Card states**: New, Learning, Review, Relearning
- **FSRS parameters**: Difficulty, Stability, Scheduled Days, Elapsed Days
- **Timeline visualization**: Shows future review dates for each rating option

All FSRS logic is centralized in `apps/api/app/spaced_repetition.py` via the `SpacedRepetitionService` class.

### Cloze Deletions

The system supports multiple cloze deletion formats:
- `{{c1::text}}` - Standard Anki-style cloze
- `[text]` - Bracket-style cloze (converted to c1)
- Multiple cloze indices per card (c1, c2, c3, etc.)

Each cloze index creates a separate StudyCard linked to the same Annotation.

### Image Storage

Images are stored separately from annotation text:
1. Upload image via `/images/upload` → returns UUID
2. Reference in annotation text as `[image:UUID]`
3. Frontend/Mac app resolves UUID to image URL via `/images/{uuid}`

### File Deduplication

PDF files are deduplicated using Blake3 hashing:
- Same file uploaded twice returns existing file record
- Hash is calculated from file content, not filename
- Unique filenames generated as `{original_stem}_{hash_prefix}.pdf`

### Database Schema

Key relationships:
- `PDFFile` 1→many `Annotation` (nullable file_id for standalone notes)
- `Annotation` 1→many `StudyCard` (one per cloze index)
- `StudyCard` 1→many `CardReview`
- `ReviewSession` 1→many `CardReview`
- `Annotation` 1→many `Image` (via `[image:UUID]` references)

CASCADE deletion: Deleting annotation deletes all associated study cards and reviews.

## API Communication

Both web and native Mac apps communicate with the same FastAPI backend:
- Default backend URL: `http://localhost:8000`
- CORS enabled for `http://localhost:3000` (web app)
- Mac app uses `Backend` service class with configurable `APIEnvironment`

All API endpoints are documented in OpenAPI format at `/docs` when the backend is running.

## Testing

- Backend: No test suite currently (TODO)
- Web frontend: Jest/React Testing Library (`npm test`)
- Mac app: XCTest (`swift test`)

## Environment Variables

Backend (apps/api):
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `RELOAD`: Auto-reload on code changes (default: true)
- `UPLOAD_DIR`: Upload directory path (default: ./uploads)
- `MAX_FILE_SIZE`: Max PDF file size in bytes (default: 50MB)
- `MAX_IMAGE_SIZE`: Max image file size in bytes (default: 10MB)

## Current Feature Branch

Branch: `feature/native-mac-app` - Development of native macOS application.
