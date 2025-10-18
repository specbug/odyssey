# Odyssey

Odyssey is an intelligent PDF annotation and spaced repetition learning system that helps you retain knowledge from documents through active recall and scientifically-optimized review scheduling.

## Features

- **PDF Annotation**: Highlight and annotate PDF documents with an intuitive interface
- **Spaced Repetition**: FSRS-powered review scheduling for optimal knowledge retention
- **Cloze Deletions**: Create fill-in-the-blank flashcards directly from highlighted text
- **Timeline View**: Visual timeline of your learning progress and review history
- **Smart Deduplication**: Automatic detection and handling of duplicate files

## Repository Structure

This is a monorepo containing multiple applications:

```
odyssey/
├── apps/
│   ├── webapp/          # React frontend application
│   └── api/             # FastAPI backend server
├── .ai-dev/             # AI development documentation
└── README.md            # This file
```

### Apps

- **webapp**: React-based web application with PDF rendering and annotation UI
- **api**: FastAPI backend providing PDF storage, annotation management, and spaced repetition algorithms

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Python 3.11+
- Git

### Running Locally

**Terminal 1 - Start Backend API:**

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend runs at `http://localhost:8000` (API docs at `/docs`)

**Terminal 2 - Start Frontend:**

```bash
cd apps/webapp
npm install
npm start
```

Frontend opens automatically at `http://localhost:3000`

### Development Workflow

1. Start the backend API server (runs on port 8000) in one terminal
2. Start the frontend development server (runs on port 3000) in another terminal
3. The frontend automatically proxies API requests to the backend
4. Both servers support hot reloading for rapid development

## Building for Production

### Frontend

```bash
cd apps/webapp
npm run build
```

Build artifacts will be in `apps/webapp/build/`

### Backend

The backend runs as-is in production. For production deployment:

```bash
cd apps/api
pip install -r requirements.txt
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Tech Stack

### Frontend
- React 19
- react-pdf for PDF rendering
- KaTeX for math rendering
- FSRS client-side scheduling

### Backend
- FastAPI
- SQLAlchemy with SQLite
- Blake3 for file hashing
- FSRS for spaced repetition algorithms

## Documentation

- Frontend setup and development: [apps/webapp/README.md](apps/webapp/README.md)
- Backend API documentation: [apps/api/README.md](apps/api/README.md)
- AI development notes: `.ai-dev/` directory

## Contributing

Contributions are welcome! Please ensure:

1. Code follows existing style conventions
2. Tests pass (when test suite is available)
3. API changes are backward compatible or properly versioned
4. Documentation is updated for new features

## License

[Add license information]

## Roadmap

Future applications planned for this monorepo:
- Browser extension for web-based PDF annotation
- Native desktop applications (Electron/Tauri)
- Mobile applications (React Native)

## Support

For issues and questions, please use the GitHub issue tracker.
