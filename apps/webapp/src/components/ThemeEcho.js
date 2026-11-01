import React from 'react';

// A one-shot flicker around the theme button when the theme changes, drawn
// from the logo: two pairs of brackets spring outward from the icon, one
// after the other, so for a moment they read as [[ ]], while the logo's
// orange blank flashes under the icon. About half a second. Ornamental: hidden
// from assistive tech, ignores the pointer, and not rendered under
// prefers-reduced-motion (see .theme-echo in base.css).

// One bracket pair hugging a 20px icon: stems at ±13, 18 tall, 4px arms,
// 1.5px strokes, the weights of the rail's line icons.
function Pair({ className }) {
  return (
    <g className={className}>
      <g className="echo-l">
        <rect x="-13.75" y="-9" width="1.5" height="18"/>
        <rect x="-13.75" y="-9" width="4" height="1.5"/>
        <rect x="-13.75" y="7.5" width="4" height="1.5"/>
      </g>
      <g className="echo-r">
        <rect x="12.25" y="-9" width="1.5" height="18"/>
        <rect x="9.75" y="-9" width="4" height="1.5"/>
        <rect x="9.75" y="7.5" width="4" height="1.5"/>
      </g>
    </g>
  );
}

export default function ThemeEcho() {
  return (
    <svg className="theme-echo" viewBox="-28 -28 56 56" aria-hidden="true">
      <Pair className="echo-1"/>
      <Pair className="echo-2"/>
      <rect className="echo-blank" x="-4" y="12" width="8" height="2"/>
    </svg>
  );
}
