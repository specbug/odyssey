# Odyssey

Odyssey is an intelligent PDF annotation and spaced repetition learning system that helps you retain knowledge from documents through active recall and scientifically-optimized review scheduling.

## Features

- **PDF Annotation**: Highlight and annotate PDF documents with an intuitive interface
- **Spaced Repetition**: FSRS-powered review scheduling for optimal knowledge retention
- **Cloze Deletions**: Create fill-in-the-blank flashcards directly from highlighted text
- **Timeline View**: Visual timeline of your learning progress and review history
- **Smart Deduplication**: Automatic detection and handling of duplicate files

## Local Setup

### Prerequisites

- Node.js 16+ and npm
- Python 3.11+
- Git

### Running Locally

**1. Start Backend API:**

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

**2. Start Frontend:**

```bash
cd apps/webapp
npm install
npm start
```

The frontend will open at `http://localhost:3000` and the backend will run at `http://localhost:8000`.

## Credits

This project is inspired by the work of [Andy Matuschak](https://andymatuschak.org/) on [Orbit](https://github.com/andymatuschak/orbit).