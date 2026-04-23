# Odyssey

A PDF reader with spaced repetition built in. Highlights become FSRS-scheduled review cards that link back to the page they came from.

My learning workflow used to be scattered across three apps: PDFs in Preview, notes in Notion, flashcards in Anki. Cards would sit in a deck three months later with no memory of the paper they came from. Odyssey puts it in one place — you annotate inside the PDF, the annotation *is* the card, and reviews jump you back to the source whenever a prompt feels abstract.

## What you get out of it

- **One step from reading to reviewing.** Select text, type a note, done. No deck management, no separate card-writing session later.
- **Cloze in plain text.** Wrap any word in `[[double brackets]]` to turn it into a fill-in-the-blank. Multiple blanks on one card reveal and grade together.
- **Rich notes.** Paste images or diagrams straight into a note and they show up in the review prompt. Math renders as LaTeX.
- **Context survives.** Every review links back to the source page, so cards never end up orphaned from the paper they came from.
- **FSRS, not SM-2.** Modern scheduler — typically fewer reviews for the same retention than Anki.
- **Local-first.** PDFs, annotations, and review history live on your machine. No account, no sync.

Web app and native macOS app share the same local backend, so you can read on one and review on the other.

## Run it

```bash
cp .env.example .env
podman compose up -d --build
```

Web UI at `http://localhost:3000`, API at `http://localhost:8000`. For the native Mac app: `swift run` inside `apps/mac/OdysseyMacApp/`.

Local dev without containers: see `apps/api/README.md` and `apps/webapp/README.md`.

## Credits

Inspired by [Andy Matuschak](https://andymatuschak.org/)'s [Orbit](https://github.com/andymatuschak/orbit) and the mnemonic medium. FSRS by [open-spaced-repetition](https://github.com/open-spaced-repetition).
