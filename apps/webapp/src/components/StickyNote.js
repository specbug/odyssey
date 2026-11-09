import React from 'react';
import { renderRich } from '../utils/render';
import { TYPE_LABEL } from '../utils/format';

// A note in the reader's margin, level with its highlight. It is a card (the
// person made it and can open it), so: sheet, rule, a 2px edge in the
// document's ink (from the reader), its type as a word. It rests below full
// strength so the page leads, and comes up on hover, focus, or when its
// highlight is selected.
export default function StickyNote({ note, onOpen, active = false, style }) {
  const body = note.prompt || note.excerpt || '';
  return (
    <button
      className="card sticky"
      data-active={active || undefined}
      onClick={onOpen}
      style={style}
    >
      <span className="card-type sticky-type">{TYPE_LABEL[note.type] || 'Note'}</span>
      <span className="sticky-body">
        {renderRich(body, { cloze: note.type === 'cloze' ? 'inline' : 'none' })}
      </span>
      {note.answer && (
        <span className="sticky-answer">{renderRich(note.answer)}</span>
      )}
    </button>
  );
}
