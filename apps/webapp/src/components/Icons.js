import React from 'react';

// Restrained 20×20 line icons, 1.4 stroke. Ported from the design zip.
// `color` prop accepts any CSS value and maps to currentColor via `style={{color}}`.
const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

const svg = (path, vb = '0 0 20 20') => ({ color, size = 20, ...rest }) => (
  <svg viewBox={vb} width={size} height={size} {...sw} style={{ color, ...(rest.style || {}) }} {...rest}>
    {path}
  </svg>
);

export const Ic = {
  Home:   svg(<path d="M3 9l7-6 7 6v8a1 1 0 0 1-1 1h-4v-6h-4v6H4a1 1 0 0 1-1-1V9z"/>),
  Book:   svg(<><path d="M4 3h8a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3V3z"/><path d="M15 17H7a3 3 0 0 0-3-3"/></>),
  Note:   svg(<><path d="M4 3h9l3 3v11H4z"/><path d="M7 8h6M7 11h6M7 14h4"/></>),
  Review: svg(<><circle cx="10" cy="10" r="7"/><path d="M10 5v5l3 2"/></>),
  Gear:   svg(<><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4M15.7 15.7l-1.4-1.4M5.7 5.7L4.3 4.3"/></>),
  Search: svg(<><circle cx="9" cy="9" r="5.5"/><path d="M13.5 13.5L17 17"/></>),
  Plus:   svg(<path d="M10 4v12M4 10h12"/>),
  Close:  svg(<path d="M5 5l10 10M15 5L5 15"/>),
  Right:  svg(<path d="M7 4l6 6-6 6"/>),
  Left:   svg(<path d="M13 4l-6 6 6 6"/>),
  Eye:    svg(<><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.5"/></>),
  Highlight: svg(<><path d="M3 17l1-3 8-8 3 3-8 8-3 1z"/><path d="M11 5l3 3"/></>),
  Upload: svg(<><path d="M10 14V4M6 8l4-4 4 4"/><path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"/></>),
  Dots:   svg(<><circle cx="4" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none"/></>),
  Sun:    svg(<><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4M15.7 15.7l-1.4-1.4M5.7 5.7L4.3 4.3"/></>),
  Trash:  svg(<><path d="M4 6h12M8 6V4h4v2M5.5 6l1 10h7l1-10M9 9v5M11 9v5"/></>),
};

export default Ic;
