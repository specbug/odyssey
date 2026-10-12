import { SWATCHES, swatchFor, docColor, hashToHue } from './hue';

test('arbitrary hues snap to the nearest swatch, wrapping at 360', () => {
  expect(swatchFor(28).name).toBe('red');
  expect(swatchFor(225).name).toBe('cyan');
  expect(swatchFor(359).name).toBe('pink');
  expect(swatchFor(12).name).toBe('red'); // 13° from red, 20° from pink
  expect(swatchFor(-10).name).toBe('pink');
  expect(swatchFor(null)).toBeNull();
});

test('every swatch hue maps to itself', () => {
  SWATCHES.forEach((s) => expect(swatchFor(s.h)).toBe(s));
});

test('hash fallback always lands exactly on a swatch', () => {
  ['00000000', 'deadbeef', 'ffffffff', 'a1b2c3d4'].forEach((h) => {
    expect(SWATCHES.map((s) => s.h)).toContain(hashToHue(h));
  });
  expect(hashToHue(null)).toBe(SWATCHES[7].h);
});

test('missing hue is grayscale', () => {
  expect(docColor(null)).toBe('var(--ink-4)');
  expect(docColor(undefined, 'wash')).toBe('var(--paper-2)');
  expect(docColor(92)).toBe('oklch(0.800 0.120 92)');
});
