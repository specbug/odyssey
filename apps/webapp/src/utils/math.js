import React, { useLayoutEffect, useMemo, useRef } from 'react';
import katex from 'katex';

// Maths, as on sixeleven: KaTeX renders each expression to MathML and the
// browser lays it out in TeX Gyre Pagella Math (--math in tokens.css), which
// carries its own spacing, stretchy delimiters and italic correction. No
// KaTeX fonts or stylesheet are loaded.

// Chrome honours mathvariant="normal" only, so bold, italic and double-struck
// runs are rewritten as Unicode mathematical alphanumerics (𝐟, 𝟏𝟎, ℝ), which
// every browser draws. Each entry: [A, a, 0] code points, plus the letters
// Unicode places elsewhere.
const ALPHABETS = {
  bold: { base: [0x1d400, 0x1d41a, 0x1d7ce] },
  italic: { base: [0x1d434, 0x1d44e, null], holes: { h: 0x210e } },
  'bold-italic': { base: [0x1d468, 0x1d482, 0x1d7ce] },
  'double-struck': {
    base: [0x1d538, 0x1d552, 0x1d7d8],
    holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
};

function toAlphabet(variant, text) {
  const { base, holes } = ALPHABETS[variant];
  return text
    .split(/(&[#\w]+;)/) // leave HTML entities intact
    .map((part) => (part.startsWith('&')
      ? part
      : Array.from(part, (ch) => {
        if (holes?.[ch]) return String.fromCodePoint(holes[ch]);
        if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(base[0] + ch.charCodeAt(0) - 65);
        if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(base[1] + ch.charCodeAt(0) - 97);
        if (ch >= '0' && ch <= '9' && base[2] !== null) return String.fromCodePoint(base[2] + ch.charCodeAt(0) - 48);
        return ch;
      }).join('')))
    .join('');
}

const VARIANT_RUN = /<(mi|mn|mtext)([^>]*?)\smathvariant="(bold|italic|bold-italic|double-struck)"([^>]*)>([^<]*)<\/\1>/g;

export function mathToHtml(tex, displayMode) {
  return katex
    .renderToString(tex, { displayMode, output: 'mathml', throwOnError: false, strict: 'ignore' })
    .replace(VARIANT_RUN, (_m, tag, before, variant, after, text) => {
      // An <mi> keeps mathvariant="normal" so a single letter isn't italicised again.
      const keep = tag === 'mi' ? ' mathvariant="normal"' : '';
      return `<${tag}${before}${keep}${after}>${toAlphabet(variant, text)}</${tag}>`;
    });
}

// Chrome ignores an <mtable>'s columnalign, columnspacing and rowspacing, so
// `aligned` loses its alignment on the = sign. Copy them onto the cells.
function alignTables(root) {
  root.querySelectorAll('mtable').forEach((table) => {
    const aligns = (table.getAttribute('columnalign') || '').split(/\s+/).filter(Boolean);
    const colGap = table.getAttribute('columnspacing');
    const rowGap = table.getAttribute('rowspacing');
    Array.from(table.children).forEach((row) => {
      Array.from(row.children).forEach((cell, i) => {
        if (aligns.length) cell.style.textAlign = aligns[Math.min(i, aligns.length - 1)];
        if (colGap && i > 0) cell.style.paddingInlineStart = colGap;
        if (rowGap) cell.style.paddingBlock = `calc(${rowGap} / 2)`;
      });
    });
  });
}

export function MathTex({ tex, display = false }) {
  const ref = useRef(null);
  const html = useMemo(() => {
    try { return mathToHtml(tex, display); } catch { return null; }
  }, [tex, display]);
  useLayoutEffect(() => { if (ref.current) alignTables(ref.current); }, [html]);
  if (html == null) return <span>{tex}</span>;
  const Tag = display ? 'div' : 'span';
  return <Tag ref={ref} className={display ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }}/>;
}
