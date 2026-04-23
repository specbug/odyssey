import React from 'react';
import { renderRich } from '../utils/render';

// Collapsed sticky-note marker shown in the right rail next to a highlight.
// Body + answer render through renderRich so inline/block math, inline/fenced
// code, image markers, and cloze pills all display (and not as raw text).
export default function StickyNote({ note, onOpen, active = false, style }) {
  const bodyText = note.prompt || note.excerpt || '';
  const clozeMode = note.type === 'cloze' ? 'inline' : 'none';

  // Active state — shown when the user clicks the linked highlight on the PDF.
  // Signal is carried by a few quiet moves, not a visual explosion:
  //   1. the always-accent left rule deepens (--accent → --accent-deep) and
  //      thickens by one pixel — the stripe is the brand anchor, so it earns
  //      its small emphasis.
  //   2. a thin accent ring wraps the card via `outline` (outline doesn't
  //      change layout and doesn't interact with mix-blend-mode).
  //   3. the backdrop steps from paper to paper-2.
  // No transform, no glow, no outer drop shadow. Reading is a ritual; loudness
  // breaks it.
  //
  // Style note: every side uses its own per-side shorthand (borderTop,
  // borderLeft, …) rather than a `border` mega-shorthand plus longhand
  // overrides. Mixing shorthand+longhand in an inline style object was
  // causing React's diff on active→inactive to leave the left border with
  // the wrong colour — ending up rule-grey instead of accent. Per-side
  // shorthands resolve cleanly because each property has exactly one
  // declaration site.
  const activeStyles = active
    ? {
        background: 'var(--paper-2)',
        borderLeft: '4px solid var(--accent-deep, var(--accent))',
        outline: '1px solid color-mix(in oklab, var(--accent) 50%, transparent)',
        outlineOffset: '-1px',
      }
    : {};

  return (
    <button
      onClick={onOpen}
      data-active={active || undefined}
      style={{
        background: 'var(--paper)',
        borderTop: '1px solid var(--rule)',
        borderRight: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
        borderLeft: '3px solid var(--accent)',
        padding: '12px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
        borderRadius: 'var(--rad)',
        transition: 'background 220ms cubic-bezier(.2,.7,.2,1), border-color 220ms cubic-bezier(.2,.7,.2,1)',
        width: '100%',
        display: 'block',
        ...activeStyles,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.background = 'var(--paper-2)';
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.background = 'var(--paper)';
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
          fontFamily: 'var(--sans)',
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
            fontFamily: 'var(--sans)',
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
