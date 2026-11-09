# Odyssey API

The FastAPI server behind Odyssey. It stores PDFs and notes, turns notes into
cards, schedules them with [FSRS](https://github.com/open-spaced-repetition),
and builds the review queue. The web app and the macOS app both use it.

## Run

Python 3.11.

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

The server listens on <http://localhost:8000>. Interactive API docs are at
<http://localhost:8000/docs>.

## Test

```bash
pip install -r requirements-dev.txt
python -m pytest
```

Tests run against a throwaway SQLite database and a fake LLM. They need no
network access or API key. `scripts/tests/` holds older scripts that need a
live server; pytest skips them.

## Configuration

Set through environment variables. All are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `0.0.0.0`, `8000` | Where the server listens |
| `RELOAD` | `true` | Reload on code changes |
| `DATABASE_URL` | SQLite file in this directory | SQLAlchemy database URL |
| `UPLOAD_DIR` | `./uploads` | Where PDFs are stored |
| `MAX_FILE_SIZE` | 50 MB | Largest PDF accepted |
| `MAX_IMAGE_SIZE` | 10 MB | Largest image accepted |
| `CORS_ORIGINS` | | Extra allowed origins, comma-separated |
| `META_API_KEY` | | Turns on metadata extraction and note linking |
| `META_MODEL` | `muse-spark-1.3-contributor` | Model for both |
| `META_LINK_MODEL` | `META_MODEL` | Model for note linking only |
| `LINKER_ENABLED` | `true` | `false` turns off note linking |
| `HEALTHCHECKS_URL` | | Pinged every 60 s, for uptime alerts |

With `META_API_KEY` set, PDF text and note text are sent to the Meta Model
API. The root [README](../../README.md#optional-metadata-and-note-links)
explains what is sent and the privacy trade-off of each tier.

## Layout

| Module | What it does |
| --- | --- |
| `app/main.py` | REST endpoints |
| `app/models.py` | SQLAlchemy models |
| `app/schemas.py` | Request and response schemas |
| `app/spaced_repetition.py` | FSRS scheduling and card creation, one card per cloze blank |
| `app/review_queue.py` | Which cards a review session holds, and in what order |
| `app/meta_ai.py` | Meta Model API client |
| `app/linker.py` | Background worker that links related notes |
| `app/heartbeat.py` | Optional uptime heartbeat |

[`CLAUDE.md`](../../CLAUDE.md) at the repository root describes each of
these in depth.
