import React from 'react';

// Cloze deletion uses [[word]] marks. A single annotation can hold multiple marks;
// the review UI reveals them all at once and grades as a single card.

export const CLOZE_RE = /\[\[([^\]]+)\]\]/g;

export function hasCloze(text) {
  if (!text) return false;
  CLOZE_RE.lastIndex = 0;
  return CLOZE_RE.test(text);
}

export function extractAnswers(text) {
  if (!text) return [];
  const out = [];
  let m;
  CLOZE_RE.lastIndex = 0;
  while ((m = CLOZE_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function stripCloze(text) {
  if (!text) return '';
  return text.replace(CLOZE_RE, (_, inner) => inner);
}

// HTML string: renders cloze with answers visible but distinguished (pill-shaped
// blanks with dashed border, design's NotesScreen style). Used in note previews.
export function renderClozeInline(text) {
  if (!text) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc(text).replace(
    /\[\[([^\]]+)\]\]/g,
    (_, inner) =>
      `<span style="display:inline-block;padding:0 10px;margin:0 2px;background:color-mix(in oklab, var(--accent) 12%, var(--paper));border:1px dashed color-mix(in oklab, var(--accent) 45%, var(--rule));border-radius:999px;color:var(--ink-2);">${inner}</span>`
  );
}

// React node: the review surface. All [[x]] marks reveal/hide together.
// When hidden, each cloze is a paper-colored pill of dots; when revealed,
// it becomes an accent pill with the answer.
export function renderClozeReveal(text, revealed) {
  if (!text) return null;
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((p, i) => {
    if (p.startsWith('[[') && p.endsWith(']]')) {
      const word = p.slice(2, -2);
      return revealed ? (
        <span
          key={i}
          style={{
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            padding: '0 6px',
            borderRadius: 2,
            color: 'var(--accent-deep)',
            fontWeight: 500,
          }}
        >
          {word}
        </span>
      ) : (
        <span
          key={i}
          style={{
            display: 'inline-block',
            background: 'var(--paper-3)',
            color: 'var(--paper-3)',
            borderRadius: 2,
            padding: '0 6px',
            minWidth: Math.max(40, word.length * 10),
            letterSpacing: '0.1em',
          }}
        >
          {'·'.repeat(word.length)}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
