// Document colour. Each doc gets one of twelve named swatches — the same
// system Orbit uses for source context — hand-tuned in OKLCH so they sit at
// even weight on paper: yellow lighter, blue deeper, brown low-chroma. A
// fixed set means two docs read as the same colour only when they share a
// swatch, never because their hues happened to land 6° apart.
//
// `PDFFile.color_hue` stays a 0–360 number. New docs are given a swatch's
// exact hue; older rows hold arbitrary hues and snap to the nearest swatch
// at render, so nothing needs migrating.

export const SWATCHES = [
  { name: 'red', h: 25, l: 0.64, c: 0.14 },
  { name: 'orange', h: 50, l: 0.68, c: 0.13 },
  { name: 'brown', h: 68, l: 0.62, c: 0.08 },
  { name: 'yellow', h: 92, l: 0.8, c: 0.12 },
  { name: 'lime', h: 125, l: 0.74, c: 0.12 },
  { name: 'green', h: 150, l: 0.66, c: 0.11 },
  { name: 'turquoise', h: 190, l: 0.7, c: 0.08 },
  { name: 'cyan', h: 222, l: 0.68, c: 0.09 },
  { name: 'blue', h: 255, l: 0.62, c: 0.11 },
  { name: 'violet', h: 288, l: 0.62, c: 0.12 },
  { name: 'purple', h: 318, l: 0.62, c: 0.12 },
  { name: 'pink', h: 352, l: 0.66, c: 0.13 },
];

const arc = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

export function swatchFor(hue) {
  if (!Number.isFinite(hue)) return null;
  const h = ((hue % 360) + 360) % 360;
  return SWATCHES.reduce((best, s) => (arc(s.h, h) < arc(best.h, h) ? s : best));
}

// role: 'dot'  — the source mark (dots, graph nodes)
//       'ink'  — strokes drawn on a wash (DocGlyph's starburst)
//       'wash' — the tinted square behind a DocGlyph
// A missing hue (standalone notes) falls back to grayscale.
export function docColor(hue, role = 'dot') {
  const s = swatchFor(hue);
  if (!s) return role === 'wash' ? 'var(--paper-2)' : 'var(--ink-4)';
  const f = (n) => n.toFixed(3);
  if (role === 'ink') return `oklch(${f(s.l - 0.12)} ${f(s.c * 0.75)} ${s.h})`;
  if (role === 'wash') return `oklch(${f(Math.min(0.94, s.l + 0.26))} ${f(s.c * 0.25)} ${s.h} / 0.5)`;
  return `oklch(${f(s.l)} ${f(s.c)} ${s.h})`;
}

// Stable swatch hue from a Blake3 hex hash, for docs whose color_hue is null.
export function hashToHue(hash) {
  if (!hash || typeof hash !== 'string') return SWATCHES[7].h;
  const n = parseInt(hash.slice(0, 8), 16);
  if (!Number.isFinite(n)) return SWATCHES[7].h;
  return SWATCHES[n % SWATCHES.length].h;
}
