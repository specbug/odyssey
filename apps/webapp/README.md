# Odyssey Web App

The frontend web application for Odyssey, a PDF annotation and spaced repetition learning system.

## Demo

![Odyssey Demo](demo.gif)

## Overview

This React-based web application provides an intuitive interface for:
- Uploading and viewing PDF documents
- Creating highlights and annotations
- Managing flashcards with spaced repetition
- Tracking learning progress with timeline visualization
- Creating cloze deletion flashcards

## Tech Stack

- **React 19**: UI framework
- **react-pdf**: PDF rendering and text extraction
- **KaTeX**: Math formula rendering in annotations
- **FSRS**: Client-side spaced repetition scheduling
- **react-scripts**: Build tooling (Create React App)

## Quick Start

**1. Start the Backend API (in a separate terminal):**

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend will be running at `http://localhost:8000`

**2. Start the Frontend Web App:**

```bash
cd apps/webapp
npm install
npm start
```

The app will open automatically at `http://localhost:3000`

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Python 3.11+
- Backend API running (see `../api/README.md`)

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm start
```

The app will open at `http://localhost:3000` with hot reloading enabled.

The development server is configured to proxy API requests to `http://localhost:8000`.

### Building

Create a production build:

```bash
npm run build
```

The optimized build will be in the `build/` directory, ready for deployment.

### Testing

Run the test suite:

```bash
npm test
```

Launches the test runner in interactive watch mode.

## Project Structure

```
webapp/
├── public/             # Static assets
│   ├── fonts/         # Self-hosted fonts
│   └── index.html     # HTML template
├── src/
│   ├── App.js         # Main application component
│   ├── App.css        # Global styles
│   ├── api.js         # API client for backend communication
│   ├── colorUtils.js  # Color utilities for highlights
│   ├── clozeUtils.js  # Cloze deletion utilities
│   ├── HomePage.js    # Home page component
│   ├── HeaderInfo.js  # Header component
│   ├── LoadingBar.js  # Loading indicator
│   ├── AsteriskProgressBar.js  # Progress visualization
│   ├── fonts/         # Font files
│   └── index.js       # Entry point
└── package.json       # Dependencies and scripts
```

## Features

### PDF Viewing
- High-quality PDF rendering with react-pdf
- Zoom controls and page navigation
- Text selection and extraction

### Annotations
- Highlight text with custom colors
- Add questions and answers to highlights
- Create cloze deletions from selected text
- Persistent annotation storage

### Spaced Repetition
- FSRS algorithm for optimal review scheduling
- Review queue with due cards
- Performance tracking (again/hard/good/easy ratings)
- Timeline visualization of review history

### UI/UX
- Responsive design
- Keyboard shortcuts for efficient workflow
- Progress indicators
- Self-hosted fonts for performance

## Configuration

The app uses environment variables for configuration. Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:8000
```

For production, set:
```env
REACT_APP_API_URL=https://your-api-domain.com
```

## API Integration

The frontend communicates with the backend API through `src/api.js`. Key endpoints:

- `POST /upload` - Upload PDF files
- `GET /files` - List uploaded files
- `POST /files/{id}/annotations` - Create annotations
- `GET /files/{id}/annotations` - Fetch annotations
- Spaced repetition endpoints for review scheduling

See `../api/README.md` for complete API documentation.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Note: PDF.js (used by react-pdf) requires modern browser features including Web Workers and Canvas API.

## Performance Considerations

- PDFs are cached by the browser
- Self-hosted fonts eliminate external requests
- React virtualization for long lists
- Lazy loading of PDF pages

## Troubleshooting

### PDF not rendering
- Ensure the backend API is running and accessible
- Check browser console for CORS errors
- Verify the PDF file is not corrupted

### Annotations not saving
- Verify backend API connection
- Check network tab for failed requests
- Ensure file has been successfully uploaded

### Slow performance with large PDFs
- Consider splitting large documents
- Check browser memory usage
- Disable browser extensions that may interfere

## Development Tips

### Hot Reload
Changes to JS/CSS files trigger automatic reloading.

### Debugging
Use React DevTools browser extension for component inspection.

### API Mocking
For development without backend, modify `src/api.js` to return mock data.

## Contributing

When contributing to the frontend:

1. Follow existing code style (check with ESLint)
2. Test changes across browsers
3. Update this README for new features
4. Ensure builds complete without warnings

## Future Enhancements

- Progressive Web App (PWA) support
- Offline mode with IndexedDB
- Collaborative annotations
- Export functionality (Anki, Markdown)
- Dark mode theme
