# Odyssey

A PDF reader with spaced repetition built in.

Highlights in a PDF become FSRS-scheduled review cards. Cloze deletions turn passages into fill-in-the-blank flashcards. Each review links back to the page the card came from, keeping cards in context rather than stranded in a separate app.

Available as a web app and a native macOS app.

## Run it

```bash
cp .env.example .env
podman compose up -d --build
```

Web UI at `http://localhost:3000`, API at `http://localhost:8000`. For the native Mac app, `swift run` inside `apps/mac/OdysseyMacApp/`.

Local development without containers: see `apps/api/README.md` and `apps/webapp/README.md`.

## Credits

Inspired by [Andy Matuschak](https://andymatuschak.org/)'s [Orbit](https://github.com/andymatuschak/orbit).
