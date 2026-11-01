import React, { useCallback, useRef, useState } from 'react';

// The reader's Rule: a vertical scale in the left margin where height maps to
// page. One tick per page (every 10th longer), note ticks on the right for
// pages that carry notes, an ink line for the pages behind you and a 1.5px
// you-colour line at the current page. Hidden until the pointer enters the
// margin or the Rule takes keyboard focus; point and click to jump.

export default function PageRule({ numPages, current, notePages, onJump }) {
  const [shown, setShown] = useState(false);
  const [hoverPage, setHoverPage] = useState(null);
  const fieldRef = useRef(null);

  const pageAt = useCallback((clientY) => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r || numPages < 1) return null;
    const f = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return Math.min(numPages, Math.max(1, Math.round(f * (numPages - 1)) + 1));
  }, [numPages]);

  if (numPages < 1) return null;
  const y = (p) => (numPages > 1 ? ((p - 1) / (numPages - 1)) * 100 : 0);
  // Every page gets a tick up to 300 pages; past that, every 5th.
  const step = numPages > 300 ? 5 : 1;
  const ticks = [];
  for (let p = 1; p <= numPages; p += step) ticks.push(p);
  const shownPage = hoverPage ?? current;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      onJump(Math.min(numPages, Math.max(1, current + (e.key === 'ArrowDown' ? 1 : -1))));
    }
  };

  return (
    <div
      className={`page-rule${shown ? ' shown' : ''}`}
      onPointerEnter={() => setShown(true)}
      onPointerLeave={() => { setShown(false); setHoverPage(null); }}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      <div
        ref={fieldRef}
        className="page-rule-field"
        role="slider"
        tabIndex={0}
        aria-label="Page"
        aria-valuemin={1}
        aria-valuemax={numPages}
        aria-valuenow={current}
        aria-valuetext={`Page ${current} of ${numPages}`}
        onPointerMove={(e) => setHoverPage(pageAt(e.clientY))}
        onClick={(e) => { const p = pageAt(e.clientY); if (p) onJump(p); }}
        onKeyDown={onKeyDown}
      >
        <span className="page-rule-spine"/>
        <span className="page-rule-spine covered" style={{ height: `${y(current)}%` }}/>
        {ticks.map((p) => (
          <span key={p} className={`page-rule-tick${p % 10 === 0 ? ' major' : ''}`} style={{ top: `${y(p)}%` }}/>
        ))}
        {notePages.map((p) => (
          <span key={`n${p}`} className="page-rule-note" style={{ top: `${y(p)}%` }}/>
        ))}
        <span className="page-rule-you" style={{ top: `${y(current)}%` }}/>
        {hoverPage != null && hoverPage !== current && (
          <span className="page-rule-hover" style={{ top: `${y(hoverPage)}%` }}/>
        )}
        <span className="page-rule-readout t-small ink-2" style={{ top: `${y(shownPage)}%` }}>
          p.{'\u00a0'}{shownPage} of {numPages}
        </span>
      </div>
    </div>
  );
}
