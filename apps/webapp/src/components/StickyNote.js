import React from 'react';
import { renderRich } from '../utils/render';

// A note in the reader's margin, level with its highlight. It is a card (the
// person made it and can open it), so: sheet, rule, note-colour edge. Just
// the content, no type label; it rests below full strength so the page leads,
// and comes up to full on hover, focus, or when its highlight is selected.
export default function StickyNote({ note, onOpen, active = false, style }) {
  const body = note.prompt || note.excerpt || '';
  return (
    <button
      className="card sticky"
      data-active={active || undefined}
      onClick={onOpen}
      style={style}
    >
      <span className="sticky-body">
        {renderRich(body, { cloze: note.type === 'cloze' ? 'inline' : 'none' })}
      </span>
      {note.answer && (
        <span className="sticky-answer">{renderRich(note.answer)}</span>
      )}
    </button>
  );
}
