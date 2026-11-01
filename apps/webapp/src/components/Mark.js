import React from 'react';

// The Odyssey logo: a cloze. Square brackets in ink around one orange blank,
// the same geometry as public/logo.svg. The brackets take the current ink, so
// the mark follows light and dark; the blank is the logo's orange (--mark).
export default function Mark({ size = 28, title = 'Odyssey' }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title}>
      <g fill="var(--ink)">
        <rect x="12" y="14" width="10" height="72"/>
        <rect x="12" y="14" width="24" height="10"/>
        <rect x="12" y="76" width="24" height="10"/>
        <rect x="78" y="14" width="10" height="72"/>
        <rect x="64" y="14" width="24" height="10"/>
        <rect x="64" y="76" width="24" height="10"/>
      </g>
      <rect x="36" y="64" width="28" height="10" fill="var(--mark)"/>
    </svg>
  );
}
