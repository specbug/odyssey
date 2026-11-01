import React from 'react';

// A one-shot flicker around the theme button when the theme changes: the
// logo's own 15 spikes (public/logo.svg: same angles, same length and width
// variation), scaled to shards that flick outward and fade in about half a
// second, in the logo's orange. Purely ornamental, so it is hidden from
// assistive tech, ignores the pointer, and does not render at all under
// prefers-reduced-motion (see .theme-burst in base.css).
//
// Each spike: [angle°, outer radius, tip width, base width] from logo.svg.
const SPIKES = [
  [0, 47.8, 11.8, 6.1], [24, 39.6, 6.2, 9.1], [48, 45.8, 7.9, 9.9],
  [72, 46.7, 6.1, 5.6], [96, 48.7, 10.3, 6.4], [120, 42.2, 6.2, 6.4],
  [144, 49.4, 5.5, 8.4], [168, 45.6, 5.9, 6.6], [192, 39.9, 6.3, 8.9],
  [216, 50.1, 6.7, 5.9], [240, 41.7, 6.1, 10.5], [264, 44.8, 4.4, 6.0],
  [288, 40.3, 5.1, 11.0], [312, 51.3, 10.7, 9.0], [336, 47.9, 4.4, 8.3],
];
// Per-spike strength and lag, fixed so the flicker is irregular but stable.
const STRENGTH = [1, 0.5, 0.85, 0.4, 0.95, 0.6, 1, 0.45, 0.8, 0.5, 0.9, 0.65, 1, 0.55, 0.75];
const LAG = [0, 30, 10, 45, 5, 25, 15, 40, 0, 35, 20, 50, 10, 30, 5];

const S = 0.27; // logo units → px around a 20px icon

// A trapezoid pointing up from the origin, as in the logo: base at 0, tip at -len.
function shard(len, tip, base) {
  const b = (base * S) / 2;
  const t = (tip * S) / 2;
  return `M ${-b} 0 L ${-t} ${-len} L ${t} ${-len} L ${b} 0 Z`;
}

export default function ThemeBurst({ turn = 0 }) {
  // Each burst starts a little rotated from the last, so repeats don't match.
  const offset = (turn * 9) % 24;
  return (
    <svg className="theme-burst" viewBox="-28 -28 56 56" aria-hidden="true">
      {SPIKES.map(([a, r, tip, base], i) => {
        const len = 2.5 + ((r - 39) / 13) * 4.5;
        return (
          <path
            key={a}
            d={shard(len, tip, base)}
            style={{
              '--a': `${a + offset}deg`,
              '--o': STRENGTH[i],
              animationDelay: `${LAG[i]}ms`,
            }}
          />
        );
      })}
    </svg>
  );
}
