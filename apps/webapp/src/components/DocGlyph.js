import React from 'react';
import Starburst from './Starburst';
import { docColor } from '../utils/hue';

// Per-doc tapered mark — small starburst tinted by the doc's hue,
// with a tinted square wash underneath. `doc` is in design shape:
//   { hue: number, cards?: number }
export default function DocGlyph({ doc, size = 40 }) {
  const cards = Math.min(8, Math.max(1, Math.floor((doc.cards || 0) / 8)));
  const prompts = Array.from({ length: cards || 3 }, (_, i) => ({ days: 3 + i * 5, state: 'review' }));

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        background: docColor(doc.hue, 'wash'),
        border: '1px solid var(--rule)',
        borderRadius: 'var(--rad)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Starburst
          prompts={prompts}
          size={size * 0.7}
          innerRadius={size * 0.08}
          color={docColor(doc.hue, 'ink')}
          thickness={0.7}
          maxLength={0.9}
        />
      </div>
    </div>
  );
}
