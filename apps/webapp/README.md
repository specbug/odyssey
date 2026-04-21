# Odyssey Web App

This is the frontend web application for Odyssey, a PDF annotation and spaced repetition learning system.

## What is this about?

This React-based web application provides an intuitive interface for:
- Uploading and viewing PDF documents
- Creating highlights and annotations
- Managing flashcards with spaced repetition
- Tracking learning progress with timeline visualization
- Creating cloze deletion flashcards

## Demo

![Odyssey Demo](demo.gif)

## Local Setup

**1. Start the Backend API (in a separate terminal):**

See the instructions in `apps/api/README.md`.

**2. Start the Frontend Web App:**

```bash
cd apps/webapp
bun install
bun run start
```

The app will open automatically at `http://localhost:3000`. The production
build is `bun run build`; tests run via `bun run test`.

## Credits

This project is inspired by the work of [Andy Matuschak](https://andymatuschak.org/) on [Orbit](https://github.com/andymatuschak/orbit).