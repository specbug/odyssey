import { DOC_INKS, ROLE_INKS, inkProps, inkStyle } from './inks';

// WCAG relative luminance and contrast, to hold every text tone to 4.5:1.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// The worst grounds text sits on: the warm paper (--ground, oklch 0.983
// 0.003 95), and a little lighter than the dark sheet (oklch 0.215).
const PAPER = '#faf9f7';
const DARK = '#181a1b';

describe('document inks', () => {
  it('has the 17 inks the server assigns (app/inks.py INK_COUNT)', () => {
    expect(DOC_INKS).toHaveLength(17);
    expect(new Set(DOC_INKS.map((i) => i.key)).size).toBe(17);
  });

  it('keeps role inks out of the document set', () => {
    const marks = new Set(DOC_INKS.map((i) => i.mark));
    Object.values(ROLE_INKS).forEach((r) => expect(marks.has(r.mark)).toBe(false));
  });

  it.each(DOC_INKS.map((i) => [i.key, i]))('%s text tones clear 4.5:1', (_key, ink) => {
    expect(contrast(ink.paper, PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink.dark, DARK)).toBeGreaterThanOrEqual(4.5);
    const fg = ink.fieldFg === 'light' ? '#ffffff' : '#1c1917';
    expect(contrast(fg, ink.field)).toBeGreaterThanOrEqual(4.5);
  });

  it('wraps an index past the end and ignores a missing one', () => {
    expect(inkStyle(17)['--ink-mark']).toBe(DOC_INKS[0].mark);
    expect(inkStyle(null)).toEqual({});
    expect(inkProps(undefined)).toEqual({});
    expect(inkProps(2)['data-ink']).toBe('');
  });
});

describe('role inks', () => {
  it.each(Object.entries(ROLE_INKS))('%s text tones clear 4.5:1', (_role, ink) => {
    expect(contrast(ink.paper, PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink.dark, DARK)).toBeGreaterThanOrEqual(4.5);
  });
});
