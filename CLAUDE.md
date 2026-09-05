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
- **Gemini metadata enrichment** (optional): `app/gemini.py` pulls `title` / `author` / `excerpt` from an uploaded PDF when `GEMINI_API_KEY` is set

Key backend modules:
- `app/main.py`: FastAPI application with all REST endpoints
- `app/models.py`: SQLAlchemy database models (PDFFile, Annotation, StudyCard, CardReview, ReviewSession, Image)
- `app/spaced_repetition.py`: FSRS algorithm implementation via `SpacedRepetitionService` class
- `app/schemas.py`: Pydantic schemas for request/response validation
- `app/database.py`: Database session management
- `app/utils.py`: File handling utilities (hashing, validation, storage)
- `app/gemini.py`: Thin Gemini REST client — `extract_pdf_metadata(bytes)`, no-op without `GEMINI_API_KEY`

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
- **Routing**: state-based, persisted in `localStorage` keys `odyssey:route` /
  `odyssey:docId`, and mirrored onto the browser history stack by
  `hooks/useRouteHistory.js` so Back / Forward work. A refresh on the
  chrome-less routes (`pdf` / `review`, which hide the rail) deliberately
  lands on `home` instead of restoring — refreshing is the user's way out of
  a stuck screen. `library` / `notes` keep the rail, so they stay restored.

Layout (`src/`):
- `App.js` — shell + routing
- `screens/{Home,Library,Notes,Pdf,Review}Screen.js`
- `components/{Icons,Starburst,DocGlyph,Metric,Rail,StickyNote,InlineCaptureDrawer}.js`
- `components/ErrorBoundary.js` — catches a screen that throws mid-render and
  offers a way home, so a crash can't blank the shell
- `hooks/useTimeHue.js` — sets `--accent-h` from hour of day
- `hooks/useRouteHistory.js` — mirrors the route onto the browser history stack
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

`PDFFile` carries design-layer metadata — `title`, `author`, `color_hue`
(0–360), `excerpt` — populated on upload by `LibraryScreen` via pdfjs and/or
by the Gemini background task (see below). All nullable so an upload never
fails if extraction does. Precedence: user / pdfjs values win — the Gemini
task only fills fields still `NULL` at write time. `PDFFileResponse.display_name`
prefers `title`, falling back to the filename stem.

### Gemini metadata enrichment

Opt-in via `GEMINI_API_KEY` env var. When set, `POST /upload` queues a
FastAPI `BackgroundTasks` entry (`_enrich_file_metadata_task` in `main.py`)
that sends the PDF inline to `gemini-2.5-flash` (configurable via
`GEMINI_MODEL`, free-tier eligible) and persists `{title, author, excerpt}`.
The task runs *after* the upload response is returned — uploads are never
blocked on the LLM call.

Before sending, `app/gemini.py:_prepare_payload` slices the PDF to the
first `PAGE_SLICE_LIMIT` (10) pages with pypdf and pulls the PDF info dict
(`/Title`, `/Author`, `/Producer`, …). The slice goes as `inlineData`, the
info dict is appended to the prompt as a hint (authoring tools often
populate junk there, so Gemini is told the title page wins). This keeps
per-call payloads in the low hundreds of KB even for 25 MB books, and the
14 MB inline-cap check is now a safety net for scan-heavy first-10-page
slices rather than a routine gate. If pypdf can't parse a PDF, we fall
back to sending the full file.

Bulk backfill: `POST /library/refresh-metadata[?force=true]` iterates all
PDFs on disk, queueing one task per file. Default mode fills only nulls;
`force=true` overwrites. Returns 503 if `GEMINI_API_KEY` isn't set. The
refresh only writes `title` / `author` / `excerpt` on `PDFFile` — it does
not touch annotations, `StudyCard` FSRS state, `CardReview` history, or
any reading-state fields, so running it on a populated library is safe.

The module (`app/gemini.py`) is fully defensive — `is_configured()` is
False without a key and callers treat `extract_pdf_metadata` returning
`None` as "no enrichment available." API keys are scrubbed from all error
log output before `print`.

**Deployment:** `GEMINI_API_KEY` (and optional `GEMINI_MODEL`) live in the
root `.env` file alongside `CLOUDFLARE_TUNNEL_TOKEN` — `compose.yml` reads
them via `${GEMINI_API_KEY:-}` and passes them into the `api` service.
`.env` is gitignored. The canonical value is in 1Password; copy it with
`op read "op://<vault>/<item>/<field>" >> .env` or paste manually, then
`podman compose up -d api` to recreate the container with the new env.
Leaving the key empty is a valid state — the backend degrades to no-op.

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
- `GEMINI_API_KEY`: Optional. Enables automatic PDF metadata extraction
  (title / author / excerpt) on upload and via `/library/refresh-metadata`.
  Unset → integration is a no-op, uploads behave exactly as before.
- `GEMINI_MODEL`: Override the Gemini model (default: `gemini-2.5-flash`).
- `HEALTHCHECKS_URL`: Optional. If set, `app/heartbeat.py` pings this URL
  every 60s from a FastAPI lifespan task. Unset → no-op. See
  "Reliability & Hosting" below.

## Reliability & Hosting

Odyssey runs 24/7 on a Mac mini (M4, macOS 26 Tahoe) behind a Cloudflare
Tunnel. The stack is podman compose (`api` + `web` + `cloudflared`)
managed by a host-level LaunchAgent. The goal is *autonomous recovery
from every single-node failure mode* — everything short of the mini
being dead.

### Host configuration (one-time, already applied)

- **FileVault: off.** Required for auto-login + unattended boot. Apple
  Silicon still hardware-encrypts the SSD and Activation Lock still
  protects against theft — FV only added pre-boot password gating, which
  on a Wi-Fi-only mini would mean "walk over to unlock after every
  reboot" since Tahoe's pre-boot SSH unlock is Ethernet-only.
- **Auto-login: on** for `rishitv`. Without this, LaunchAgents don't
  fire on boot.
- **Remote Login: on.** Post-boot SSH for management.
- **Podman Desktop is NOT in Login Items.** Leaving it in caused a
  severe race on every boot — Podman Desktop and our watchdog both
  tried to start/manage the podman machine at login, and `podman
  machine start` invoked by one party would SIGTERM the other party's
  `gvproxy` (`"gvproxy exiting: signal caught"` in `$TMPDIR/podman/gvproxy.log`).
  The stack looked up for seconds, then collapsed. If you want the
  Podman Desktop GUI, open it manually when needed; do not re-add it
  to Login Items. (Check: System Settings → General → Login Items.)
- **`scripts/harden-mac-server.sh`** — one-shot idempotent tuning script,
  run with `sudo`. Applies: `pmset` never-sleep settings, auto-reboot on
  kernel panic, disables auto-install of macOS point releases (keeps
  Rapid Security Responses on), disables local Time Machine snapshots,
  disables App Nap for the server user, schedules a weekly clean reboot
  at Monday 04:00.

  Caveat: on macOS 26 the point-release toggle does **not** reliably take
  from `defaults write` — the mini auto-installed 26.6.2 and rebooted
  itself on 2026-09-04 despite the script having been run. The script now
  reads that key back and warns when it failed; clearing it for real means
  turning off "Install macOS updates" by hand in System Settings →
  General → Software Update → Automatic Updates.

### Process supervision

Two layers, every layer self-heals:

1. **compose `restart: always`** — podman auto-restarts any crashed
   container.
2. **compose healthcheck on `api`** — curls `/health` every 30s; 3
   consecutive failures mark the container unhealthy and restart it.
   `apps/api/Dockerfile` installs `curl` for this check.
3. **hostd**, the host framework in `../hostd` (`framework/hostd`,
   contract in its `SPEC.md`). Odyssey declares itself in `deploy.yml` at
   this repo root and carries no hosting machinery of its own. hostd's
   `in.sixeleven.hostd-watch` agent runs every 2 min: starts the podman
   machine if down, runs `podman compose up -d` if the stack is down,
   probes `/health` and restarts `odyssey_api_1` after 3 consecutive
   failures. `in.sixeleven.hostd-deploy` runs every 5 min and rebuilds
   this stack when `origin/main` moves.

   This replaced `scripts/start.sh` and `scripts/odyssey.plist`, which
   were one of three near-identical copies of the same watchdog. They had
   drifted: fixes made here (the lock re-check, the SIGPIPE fix) were
   never propagated to the other two. The hard-won details from that
   script survive in hostd and are documented in `SPEC.md`:

   - `AbandonProcessGroup=true` in the plist. `podman machine start`
     spawns vfkit (the VM) as a child; without this key launchd reaps the
     whole process group when the script exits, killing vfkit within
     seconds and collapsing the stack it just brought up. This was a
     silent stack-collapse-on-boot bug that took a long time to find.
   - The readiness gate is `podman ps` (which hits the socket), not
     `podman machine inspect`. Inspect reports `"State": "running"`
     several seconds before SSH to the VM is usable on a loaded mini.
   - `compose up` is wrapped in a kill-timeout so a wedged podman-compose
     cannot hold the app lock forever.
   - Only one process starts the podman machine now, so the concurrent
     `machine start` race (two starts SIGTERM each other's gvproxy) is
     structurally impossible rather than merely avoided by a lock.

4. **External heartbeat** — `app/heartbeat.py` pings `HEALTHCHECKS_URL`
   from inside the api container every 60s. Silence → Healthchecks.io
   alerts. Detects outages an HTTP probe can't (ISP down, Mac off, full
   process hang) because it comes *from* the service.
5. **External HTTP probe** — UptimeRobot hits
   `https://odyssey.sixeleven.in/api/health` every 60s (note: nginx
   proxies `/api/*` to `api:8000/*` stripping the prefix, so this lands
   on FastAPI's `/health`). The hostname is behind Cloudflare Access —
   UptimeRobot authenticates using a service token via
   `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers so the
   probe doesn't bounce off the Access login. Detects "tunnel is up but
   upstream is broken" that a push heartbeat can't.

### Recovery runbook

**Alert fires (Healthchecks.io silent or UptimeRobot red):**

1. SSH in: `ssh rishitv@<mac-lan-ip>`.
2. `tail -50 ~/Library/Logs/in.sixeleven.hostd-watch.log`: did the
   watchdog see anything? `hostd status` summarises all apps at once.
3. `podman ps` — are containers up?
4. `launchctl kickstart -k "gui/$(id -u)/in.sixeleven.hostd-watch"` to
   force the watchdog to run now.
5. Last resort: `sudo shutdown -r now`. With FV off + auto-login, the
   Mac comes back up, session starts, LaunchAgent fires, stack boots
   within ~90s of reboot.

**Changing how this app is hosted:**

Edit `deploy.yml` in this repo (health target, deploy branch, backup jobs)
and commit. hostd reads it from `HEAD` on its next tick; there is nothing
to copy anywhere. Framework changes live in `../hostd/framework/hostd`.

### What the scheduled weekly reboot does

`pmset repeat restart M 04:00:00` (applied by `harden-mac-server.sh`) —
Mac reboots every Monday at 4am. Flushes kernel/memory cruft and
exercises the recovery path so it doesn't silently break. Services are
down for ~90s.

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
