# Odyssey

I built Odyssey because reading is mostly passive. A month later, most of what I'd read was gone.

It's a PDF reader where highlighting is the act of remembering. I mark up a passage, wrap part of it in a cloze deletion, and it enters a review queue scheduled by FSRS. When a card comes up, I'm taken back to the page it came from. Reviews stay tethered to their source, not stranded as context-free flashcards in a separate app.

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
