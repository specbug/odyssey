import React from 'react';
import Starburst from './Starburst';

// Per-doc tapered mark — small starburst tinted by the doc's hue,
// with a tinted square wash underneath. `doc` is in design shape:
//   { hue: number, cards?: number, completed?: boolean }
//
// Completed docs invert to a sealed-stamp variant: solid ink tile with the
// starburst rendered in paper. Grayscale — no accent, per DESIGN.md.
export default function DocGlyph({ doc, size = 40 }) {
  const cards = Math.min(8, Math.max(1, Math.floor((doc.cards || 0) / 8)));
  const prompts = Array.from({ length: cards || 3 }, (_, i) => ({ days: 3 + i * 5, state: 'review' }));
  const hue = Number.isFinite(doc.hue) ? doc.hue : 220;
  const completed = !!doc.completed;

  const bg = completed
    ? 'var(--ink)'
    : `oklch(90% 0.02 ${hue}/0.4)`;
  const burstColor = completed
    ? 'var(--paper)'
    : `oklch(50% 0.08 ${hue})`;
  const border = completed ? 'var(--ink)' : 'var(--rule)';

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--rad)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Starburst
          prompts={prompts}
          size={size * 0.7}
          innerRadius={size * 0.08}
          color={burstColor}
          thickness={0.7}
          maxLength={0.9}
        />
      </div>
      {completed && (
        <svg
          aria-hidden
          width={Math.max(10, size * 0.28)}
          height={Math.max(10, size * 0.28)}
          viewBox="0 0 12 12"
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            background: 'var(--paper)',
            borderRadius: '50%',
            padding: 1,
            border: '1px solid var(--ink)',
          }}
        >
          <path d="M2.5 6.2 L5 8.6 L9.5 3.6" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}
