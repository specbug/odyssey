import React from 'react';
import { MathTex } from './math';

// Render a string with a small, consistent markup set into React nodes.
// Supported:
//   - fenced code blocks: ```optional-lang\n...\n```
//   - inline code: `...`
//   - block math: $$...$$, \[...\], \begin{equation}...\end{equation}
//   - inline math: $...$, \(...\)
//   - cloze: [[word]] (rendering depends on `cloze` option)
//   - image markers: [image:UUID] → <img src=/images/UUID>
//   - any other text: passed through dangerouslySetInnerHTML so HTML from
//     the contenteditable (bold, italic, <br>) still renders.
//
// The drawer stores raw user text including contenteditable HTML; this
// renderer is the single source of truth for every surface that displays
// note content (StickyNote, NotesScreen rows, ReviewScreen prompt + answer).

const IMAGE_BASE =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : `${process.env.PUBLIC_URL || ''}/api`;

// Order matters: code fences first (so their contents don't get eaten by
// $-math inside), then backtick inline code, then the various math forms,
// then cloze, then image markers.
const RICH_RE = new RegExp(
  [
    '```[\\s\\S]*?```',
    '`[^`\\n]+`',
    '\\$\\$[\\s\\S]*?\\$\\$',
    '\\$[^\\n$]+\\$',
    '\\\\\\[[\\s\\S]*?\\\\\\]',
    '\\\\\\([^\\n)]+\\\\\\)',
    '\\\\begin\\{equation\\}[\\s\\S]*?\\\\end\\{equation\\}',
    '\\[\\[[^\\]]+\\]\\]',
    '\\[image:[A-Za-z0-9-]+\\]',
  ].join('|'),
  'g'
);

// Split a string into an array of { type, value } tokens.
function tokenize(text) {
  const src = String(text).replace(/<div>/g, ' ').replace(/<\/div>/g, ' ');
  const out = [];
  let last = 0;
  for (const m of src.matchAll(RICH_RE)) {
    if (m.index > last) out.push({ type: 'html', value: src.slice(last, m.index) });
    out.push({ type: classify(m[0]), value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ type: 'html', value: src.slice(last) });
  return out;
}

function classify(s) {
  if (s.startsWith('```')) return 'code_block';
  if (s.startsWith('`')) return 'code_inline';
  if (s.startsWith('$$')) return 'math_block';
  if (s.startsWith('\\[')) return 'math_block_bracket';
  if (s.startsWith('\\begin{equation}')) return 'math_block_eq';
  if (s.startsWith('$')) return 'math_inline';
  if (s.startsWith('\\(')) return 'math_inline_paren';
  if (s.startsWith('[[')) return 'cloze';
  if (s.startsWith('[image:')) return 'image';
  return 'html';
}

// Code: JetBrains Mono (--mono), ligatures on.
const CODE_BLOCK_STYLE = {
  fontFamily: 'var(--mono)',
  fontSize: '0.8em',
  lineHeight: 1.55,
  background: 'var(--ground)',
  border: '1px solid var(--rule)',
  padding: '12px 16px',
  margin: '8px 0',
  overflowX: 'auto',
  whiteSpace: 'pre',
  color: 'var(--ink)',
};
const CODE_INLINE_STYLE = {
  fontFamily: 'var(--mono)',
  fontSize: '0.86em',
  background: 'var(--ground)',
  border: '1px solid var(--rule)',
  padding: '0 4px',
  color: 'var(--ink)',
};

function renderMath(value, kind, key) {
  try {
    let math = value;
    if (kind === 'math_block') math = value.slice(2, -2);
    else if (kind === 'math_block_bracket') math = value.slice(2, -2);
    else if (kind === 'math_block_eq') math = value.slice('\\begin{equation}'.length, -'\\end{equation}'.length);
    else if (kind === 'math_inline') math = value.slice(1, -1);
    else if (kind === 'math_inline_paren') math = value.slice(2, -2);
    const isBlock = kind.startsWith('math_block');
    return <MathTex key={key} tex={math} display={isBlock}/>;
  } catch {
    return <span key={key}>{value}</span>;
  }
}

// Cloze rendering.
//   'reveal' (ReviewScreen): only the blank at `activeIndex` hides until
//            revealed; the other blanks show their answers, so each card
//            tests one blank.
//   'inline' (notes, sticky notes, graph): every answer shown, underlined.
//   'mask'   (linked notes during review): every answer hidden as […], since
//            a neighbour may be due later in the same session.
function renderCloze(value, key, cloze, revealed, isActive) {
  const word = value.slice(2, -2);
  if (cloze === 'reveal') {
    if (isActive && !revealed) {
      // Width tracks the answer's length so the blank hints at its size.
      const em = Math.max(2, Math.min(12, word.length * 0.5));
      return <span key={key} className="cloze-blank" style={{ width: `${em}em` }} role="img" aria-label="blank"/>;
    }
    return <span key={key} className={isActive ? 'cloze active' : 'cloze'}>{word}</span>;
  }
  if (cloze === 'inline') return <span key={key} className="cloze">{word}</span>;
  if (cloze === 'mask') return <span key={key} className="cloze-mask">[…]</span>;
  return <span key={key}>{value}</span>;
}

/**
 * Render note content to React nodes.
 * @param {string} text
 * @param {{cloze?: 'none' | 'inline' | 'reveal' | 'mask', revealed?: boolean, activeIndex?: number}} opts
 *   activeIndex picks which [[word]] blank is the target when cloze === 'reveal'.
 *   Blanks before/after it are shown with their answer, so each cloze is
 *   reviewed in isolation.
 */
export function renderRich(text, opts = {}) {
  if (!text) return null;
  const { cloze = 'none', revealed = false, activeIndex = 0 } = opts;
  const tokens = tokenize(text);
  const nodes = [];
  let clozeCounter = 0;
  tokens.forEach((t, i) => {
    const key = `r-${i}`;
    switch (t.type) {
      case 'code_block': {
        const inner = t.value.slice(3, -3).replace(/^[a-zA-Z0-9_+-]*\n/, '');
        nodes.push(
          <pre key={key} style={CODE_BLOCK_STYLE}><code>{inner}</code></pre>
        );
        return;
      }
      case 'code_inline': {
        nodes.push(
          <code key={key} style={CODE_INLINE_STYLE}>{t.value.slice(1, -1)}</code>
        );
        return;
      }
      case 'math_block':
      case 'math_block_bracket':
      case 'math_block_eq':
      case 'math_inline':
      case 'math_inline_paren':
        nodes.push(renderMath(t.value, t.type, key));
        return;
      case 'cloze': {
        const isActive = clozeCounter === activeIndex;
        clozeCounter += 1;
        nodes.push(renderCloze(t.value, key, cloze, revealed, isActive));
        return;
      }
      case 'image': {
        const uuid = t.value.slice(7, -1);
        nodes.push(
          <img
            key={key}
            src={`${IMAGE_BASE}/images/${uuid}`}
            alt=""
            style={{ maxWidth: '100%', display: 'block', margin: '8px 0' }}
          />
        );
        return;
      }
      case 'html':
      default:
        nodes.push(
          <span key={key} dangerouslySetInnerHTML={{ __html: t.value }}/>
        );
    }
  });
  return nodes;
}
