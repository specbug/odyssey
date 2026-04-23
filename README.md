# Odyssey

**A PDF reader where highlights become flashcards**

Most spaced repetition systems ask you to write cards separately from your reading, then orphan them in a deck with no trace of context. Odyssey keeps the loop closed: you read, you annotate, and the annotation *is* the card. Review sessions link back to the exact page and paragraph the card came from.

## How it works

Highlight a passage → a sticky note appears in the margin. Write a note, add a cloze deletion (`[[like this]]`), or leave it as a recall prompt. The backend creates an [FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)-scheduled study card. The review queue surfaces cards at scientifically optimal intervals. Grading (Again / Hard / Good / Easy) feeds back into the scheduler.

A few specifics:

- **Cloze syntax is `[[word]]` only** — clean, predictable, no Anki legacy cruft. Multiple blanks in one annotation are revealed and graded together in a single FSRS pass.
- **Cards never leave context.** The review screen shows the prompt; tapping through shows the source page.
- **Images in annotations** are stored by UUID and referenced inline — paste a diagram into a note, it shows up in the card.
- **File deduplication** via Blake3 hash — uploading the same PDF twice is a no-op.

## Architecture

Monorepo with three apps, one backend:

| App | Stack |
|---|---|
| `apps/api` | FastAPI · SQLite · FSRS |
| `apps/webapp` | React 19 · react-pdf · KaTeX |
| `apps/mac` | SwiftUI · macOS 14+ |

The web app and native Mac app both speak to the same local FastAPI backend over HTTP. No cloud, no account, no sync — your PDFs and review history stay on your machine.

## Run it

```bash
cp .env.example .env
podman compose up -d --build
```

Web UI → `http://localhost:3000` · API → `http://localhost:8000`

For the native Mac app: `swift run` inside `apps/mac/OdysseyMacApp/`.

Local development without containers: see `apps/api/README.md` and `apps/webapp/README.md`.

## Credits

Inspired by [Andy Matuschak](https://andymatuschak.org/)'s [Orbit](https://github.com/andymatuschak/orbit) and the mnemonic medium. FSRS algorithm via [open-spaced-repetition](https://github.com/open-spaced-repetition).
