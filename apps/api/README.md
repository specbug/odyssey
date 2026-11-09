# Odyssey API

The FastAPI server behind both Odyssey clients. It stores PDFs and notes in
SQLite, makes cards from notes, schedules them with
[FSRS](https://github.com/open-spaced-repetition), and decides what each
review session contains.

## Run

Python 3.11.

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

The server listens on <http://localhost:8000>. Every endpoint is documented,
and callable, at <http://localhost:8000/docs>.

## Test

```bash
pip install -r requirements-dev.txt
python -m pytest
```

The suite runs against a throwaway SQLite database, with a fake
HTTP server in place of the Meta API and a scripted fake in place of the
language model. It needs no network or key. `scripts/tests/` holds older
scripts that expect a live server; `pytest.ini` excludes them.

## How a note becomes a card

`POST /study-cards?annotation_id=…` makes one card for each `[[blank]]` in a
note, or one card for a note without blanks. The call is idempotent: run it
again after an edit adds a blank, and only the new card is created.

`GET /study-cards/due` builds the session. `app/review_queue.py` orders it
most-overdue first, then removes what would spoil the session: a second card
from the same note, siblings of a card reviewed in the last 12 hours, and
linked notes closer than three positions to each other. The library's due
count runs the same selection, so the number on a document matches the queue
it opens.

## Configuration

All variables are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `0.0.0.0`, `8000` | Listen address |
| `RELOAD` | `true` | Restart on code changes |
| `DATABASE_URL` | `sqlite:///./pdf_annotations.db` | SQLAlchemy database URL |
| `UPLOAD_DIR` | `./uploads` | Where PDFs are stored |
| `MAX_FILE_SIZE` | 50 MB | Largest PDF accepted |
| `MAX_IMAGE_SIZE` | 10 MB | Largest image accepted |
| `CORS_ORIGINS` | | Extra allowed origins, comma-separated |
| `META_API_KEY` | | Enables metadata extraction and linked notes |
| `META_MODEL` | `muse-spark-1.3-contributor` | Model for both |
| `META_LINK_MODEL` | value of `META_MODEL` | Model for linked notes only |
| `LINKER_ENABLED` | `true` | `false` turns linked notes off |
| `HEALTHCHECKS_URL` | | Pinged every 60 seconds for uptime alerts |

With `META_API_KEY` set, PDF and note text leave the server. The root
[README](../../README.md#privacy) says what is sent, and what each pricing
tier lets Meta do with it.

## Modules

| Module | Responsibility |
| --- | --- |
| `app/main.py` | REST endpoints, and the idempotent schema migrations run at startup |
| `app/models.py` | SQLAlchemy models |
| `app/schemas.py` | Request and response schemas |
| `app/spaced_repetition.py` | FSRS scheduling; card creation, one card per blank |
| `app/review_queue.py` | Which cards a session holds, and in what order |
| `app/meta_ai.py` | Meta Model API client; a no-op without a key |
| `app/linker.py` | Background worker that links related notes |
| `app/heartbeat.py` | Uptime heartbeat |

[`CLAUDE.md`](../../CLAUDE.md) at the repository root describes each in
depth, including the linker's prompts and failure handling.
