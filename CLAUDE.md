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

React 19 SPA built with Create React App. Rams-variant redesign — quiet,
typographic, warm-bone. **Read `apps/webapp/DESIGN.md` before making any
visual change** — it's the contract for fonts, accent usage, layout rhythm,
and motion.

Capabilities:
- **PDF rendering**: react-pdf + react-window, per-page sticky-note rail
- **Annotation**: selection → "Add note" bubble → inline capture drawer (cloze / recall / note)
- **Cloze syntax**: `[[word]]` only; one `StudyCard` **per blank** — an annotation with N blanks produces N cards, each graded independently with the other blanks visible
- **Review**: centered prompt, SPACE to reveal, 1–4 to grade, starburst tick progress
- **LaTeX + images**: KaTeX via `utils/render.js`; images via `[image:UUID]` markers + `/images/*`
- **Routing**: state-based, persisted in `localStorage` keys `odyssey:route` / `odyssey:docId`

Layout (`src/`):
- `App.js` — shell + routing
- `screens/{Home,Library,Notes,Pdf,Review}Screen.js`
- `components/{Icons,Starburst,DocGlyph,Metric,Rail,StickyNote,InlineCaptureDrawer}.js`
- `hooks/useTimeHue.js` — sets `--accent-h` from hour of day
- `utils/{cloze,hue,format,render}.js`
- `data/adapters.js` — API shape → design shape
- `styles/{tokens,base,pdf}.css` — CSS vars + global rules
- `fonts/` — R Sans / R Mono (bundled via webpack)

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
bun install
bun run start
# Opens at http://localhost:3000/odyssey (note: /odyssey basepath from package.json homepage)

# Build for production
bun run build

# Run tests
bun run test
```

Use bun, not npm — the Dockerfile and README are both on bun, and the
project's lockfile is `bun.lock`.

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

Current syntax is **`[[word]]` only** — the old Anki `{{c1::...}}` has been
retired. An annotation with N `[[x]]` marks produces N `StudyCard`s
(`cloze_index = 0..N-1`), each on its own FSRS track. At review, only the
target blank is hidden; the other blanks render with their answers visible,
so the grader focuses on one cloze at a time.

Parsing / rendering helpers live in `apps/webapp/src/utils/cloze.js`:
- `hasCloze(text)` — detects any `[[...]]`
- `extractAnswers(text)` — returns each answer in order
- `renderClozeInline(text)` — HTML string, pill-shaped blanks with answer visible (used in StickyNote / NotesScreen previews)
- `renderClozeReveal(text, revealed)` — JSX variant; note ReviewScreen instead
  uses `utils/render.js:renderRich(text, { cloze: 'reveal', revealed, activeIndex })`
  so only the blank at `activeIndex` hides.

Backend side is `app/spaced_repetition.py:create_study_card` — idempotent;
returns a list of cards, one per blank. Topping up after an edit that adds a
new `[[x]]` is safe to call again.

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
- `PDFFile` 1→many `Annotation` (nullable `file_id` for standalone notes)
- `Annotation` 1→many `StudyCard` (one card per blank; unique on `(annotation_id, cloze_index)`)
- `StudyCard` 1→many `CardReview`
- `ReviewSession` 1→many `CardReview`
- `Annotation` 1→many `Image` (via `[image:UUID]` references)

CASCADE deletion: deleting annotation deletes its study card and reviews.

`PDFFile` carries design-layer metadata — `author`, `color_hue` (0–360),
`excerpt` — populated on upload by `LibraryScreen` via pdfjs. All nullable
so an upload never fails if extraction does.

## API Communication

Both web and native Mac apps communicate with the same FastAPI backend:
- Default backend URL: `http://localhost:8000`
- CORS enabled for `http://localhost:3000` (web app)
- Mac app uses `Backend` service class with configurable `APIEnvironment`

All API endpoints are documented in OpenAPI format at `/docs` when the backend is running.

## Testing

- Backend: no test suite yet (TODO). Smoke-test via `curl` against
  `/health`, `/stats/dashboard`, `/annotations`, `/files` after any schema
  or endpoint change.
- Web frontend: Jest / RTL via `bun run test`. No tests currently under
  `src/` — the old `App.test.js` was removed with the redesign.
- Mac app: XCTest (`swift test`).

## Environment Variables

Backend (apps/api):
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `RELOAD`: Auto-reload on code changes (default: true)
- `UPLOAD_DIR`: Upload directory path (default: ./uploads)
- `MAX_FILE_SIZE`: Max PDF file size in bytes (default: 50MB)
- `MAX_IMAGE_SIZE`: Max image file size in bytes (default: 10MB)

## Design Discipline (webapp)

The webapp follows a strict visual contract. **The full guide is
`apps/webapp/DESIGN.md` — read it before changing anything the user can see.**

One-paragraph summary so you don't reach for bad defaults:

> Quiet paper, rare accent, information-dense glyphs — reading as ritual.
> R Sans for UI + prose, R Mono for metadata / numerics / dates, Editorial
> Serif for card bodies + empty-state italics. Accent color only appears in
> review + active highlights + sticky-note left borders — everything else is
> grayscale. Hue shifts by time of day via `--accent-h`. Motion is
> `cubic-bezier(.2,.7,.2,1)` at 160–520ms depending on scale. 8px grid, 0
> radius, 1px dividers. Cloze syntax is `[[word]]`.

Quick pitfall list for future sessions:
- Bare `<button>` leaks the browser's UA font — global `font-family: inherit`
  in `src/styles/base.css` handles this; don't override it.
- SQLite reuses rowids after a delete; never mark `/files/{id}/download`
  as `Cache-Control: immutable`. The frontend also cache-busts with
  `?v=<file_hash>`.
- The sticky-note rail is **per-page** (inside react-window's
  `PageRenderer`) — don't try to lift it outside the virtualizer.
- Preserve the text-anchor → normalized_rects → pixel_rects fallback chain
  in `resolveAnnotationLocation`. Each method has subtle callers.

## Current Feature Branch

Branch: `redesign-rams` — full webapp redesign (PR open).
