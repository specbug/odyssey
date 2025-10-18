import React from 'react';
import katex from 'katex';

function NotesList({ notes, onEdit, onDelete }) {
  function renderLatex(text) {
    if (!text) return '';

    // Simple LaTeX rendering
    const latexPattern = /\$\$(.*?)\$\$|\$(.*?)\$/g;
    const html = text.replace(latexPattern, (match, display, inline) => {
      try {
        const tex = display || inline;
        return katex.renderToString(tex, {
          displayMode: !!display,
          throwOnError: false,
        });
      } catch (e) {
        return match;
      }
    });

    return html;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  }

  if (notes.length === 0) {
    return (
      <div className="notes-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No notes yet</p>
        <p className="hint">Select text on the page to create your first note</p>
      </div>
    );
  }

  return (
    <div className="notes-list">
      {notes.map((note) => (
        <div key={note.id} className="note-card">
          {note.highlighted_text && (
            <div className="note-highlight">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              "{note.highlighted_text.substring(0, 100)}
              {note.highlighted_text.length > 100 ? '...' : ''}"
            </div>
          )}

          <div className="note-content">
            <div
              className="note-question"
              dangerouslySetInnerHTML={{ __html: renderLatex(note.question) }}
            />
            {note.answer && (
              <div
                className="note-answer"
                dangerouslySetInnerHTML={{ __html: renderLatex(note.answer) }}
              />
            )}
          </div>

          <div className="note-meta">
            <span className="note-date">{formatDate(note.created_date)}</span>
            <div className="note-actions">
              <button
                className="btn-icon"
                onClick={() => onEdit(note)}
                title="Edit"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="btn-icon btn-danger"
                onClick={() => onDelete(note.id)}
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotesList;
