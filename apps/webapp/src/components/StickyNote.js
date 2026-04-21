import React from 'react';
import { renderRich } from '../utils/render';

// Collapsed sticky-note marker shown in the right rail next to a highlight.
// Body + answer render through renderRich so inline/block math, inline/fenced
// code, image markers, and cloze pills all display (and not as raw text).
export default function StickyNote({ note, onOpen, style }) {
  const bodyText = note.prompt || note.excerpt || '';
  const clozeMode = note.type === 'cloze' ? 'inline' : 'none';

  return (
    <button
      onClick={onOpen}
      style={{
        background: 'color-mix(in oklab, var(--accent) 10%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--rule))',
        borderLeftWidth: 3,
        padding: '12px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
        borderRadius: 'var(--rad)',
        transition: 'transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        width: '100%',
        display: 'block',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(-4px)';
        e.currentTarget.style.boxShadow = '0 6px 20px -8px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          className="mono-sm"
          style={{ color: 'var(--accent-deep, var(--ink-3))', letterSpacing: '0.08em' }}
        >
          {(note.type || 'note').toUpperCase()}
        </span>
        <span style={{ flex: 1 }}/>
        {(note.tags || []).slice(0, 2).map((t) => (
          <span key={t} className="mono-sm" style={{ color: 'var(--ink-4)', fontSize: 10 }}>
            #{t}
          </span>
        ))}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: 'var(--ink)',
          fontFamily: 'var(--serif)',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {renderRich(bodyText, { cloze: clozeMode })}
      </div>
      {note.answer && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px dashed var(--rule)',
            fontSize: 12,
            color: 'var(--ink-3)',
            fontFamily: 'var(--serif)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderRich(note.answer)}
        </div>
      )}
    </button>
  );
}
