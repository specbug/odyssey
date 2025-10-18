# Odyssey API

This is the FastAPI backend for the Odyssey PDF annotation and spaced repetition learning system.

## Features

- **File Upload with Deduplication**: Upload PDF files with Blake3 hash-based deduplication.
- **Annotation Management**: Create, read, update, and delete annotations.
- **Spaced Repetition**: FSRS algorithm implementation for optimal review scheduling.
- **Cloze Deletions**: Support for fill-in-the-blank flashcards.
- **Timeline API**: Review history and progress tracking.

## Local Setup

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

The API will be available at `http://localhost:8000`. You can find the API documentation at `http://localhost:8000/docs`.

## Credits

This project is inspired by the work of [Andy Matuschak](https://andymatuschak.org/) on [Orbit](https://github.com/andymatuschak/orbit).