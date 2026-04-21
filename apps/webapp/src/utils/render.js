import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';

// Render a string with LaTeX ($...$ / $$...$$ / \(..\) / \[..\]) and inline
// [image:UUID] markers into a JSX tree. Both kinds of markup can coexist.
//
// LaTeX delimiters supported:
//   $..$ and \(..\) → inline
//   $$..$$ and \[..\] → block
//   \begin{equation}..\end{equation} → block
//
// The string may also contain arbitrary HTML (from the contenteditable note).
// We round-trip HTML segments through dangerouslySetInnerHTML so bold/italic/br
// from the editor still render.

const LATEX_RE = /(\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^\n)]*?\\\)|\\begin\{equation\}[\s\S]*?\\end\{equation\})/g;
const IMAGE_RE = /\[image:([A-Za-z0-9-]+)\]/g;

// Public base for image resolution — matches api.js.
const IMAGE_BASE =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : `${process.env.PUBLIC_URL || ''}/api`;

function parseLatexPart(part, key) {
  if (!part) return null;
  let isBlock = false;
  let math = '';
  if (part.startsWith('$$')) {
    isBlock = true;
    math = part.slice(2, -2);
  } else if (part.startsWith('\\[')) {
    isBlock = true;
    math = part.slice(2, -2);
  } else if (part.startsWith('\\begin{equation}')) {
    isBlock = true;
    math = part.slice('\\begin{equation}'.length, -'\\end{equation}'.length);
  } else if (part.startsWith('\\(')) {
    math = part.slice(2, -2);
  } else if (part.startsWith('$')) {
    math = part.slice(1, -1);
  }
  if (!math) return null;
  try {
    return isBlock ? <BlockMath key={key} math={math}/> : <InlineMath key={key} math={math}/>;
  } catch {
    return <span key={key}>{part}</span>;
  }
}

function splitImages(text, baseKey) {
  // Produce alternating plain-HTML and <img> nodes.
  const nodes = [];
  let last = 0;
  let m;
  IMAGE_RE.lastIndex = 0;
  let idx = 0;
  while ((m = IMAGE_RE.exec(text)) !== null) {
    if (m.index > last) {
      const html = text.slice(last, m.index);
      if (html) {
        nodes.push(
          <span key={`${baseKey}-h-${idx}`} dangerouslySetInnerHTML={{ __html: html }}/>
        );
        idx += 1;
      }
    }
    nodes.push(
      <img
        key={`${baseKey}-img-${idx}`}
        src={`${IMAGE_BASE}/images/${m[1]}`}
        alt=""
        style={{ maxWidth: '100%', display: 'block', margin: '8px 0', borderRadius: 'var(--rad)' }}
      />
    );
    idx += 1;
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    const html = text.slice(last);
    if (html) {
      nodes.push(
        <span key={`${baseKey}-h-${idx}`} dangerouslySetInnerHTML={{ __html: html }}/>
      );
    }
  }
  if (!nodes.length) {
    return [
      <span key={`${baseKey}-empty`} dangerouslySetInnerHTML={{ __html: text }}/>,
    ];
  }
  return nodes;
}

export function renderRich(text) {
  if (!text) return null;
  // Contenteditable sometimes emits <div> per line; normalize to spaces so LaTeX
  // split doesn't get confused by wrapping tags.
  const normalized = String(text).replace(/<div>/g, ' ').replace(/<\/div>/g, ' ');
  const parts = normalized.split(LATEX_RE);

  return parts.map((part, i) => {
    if (!part) return null;
    // If the whole segment matches LaTeX delimiters, render as math.
    if (LATEX_RE.test(part) && part.match(LATEX_RE)?.[0] === part) {
      LATEX_RE.lastIndex = 0;
      return parseLatexPart(part, `l-${i}`);
    }
    LATEX_RE.lastIndex = 0;
    // Otherwise split on image markers and render HTML spans + <img>.
    return (
      <React.Fragment key={`p-${i}`}>{splitImages(part, `p-${i}`)}</React.Fragment>
    );
  });
}
