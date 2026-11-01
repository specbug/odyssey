import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';

// The reader's page dial, in the top bar where "p. 6 of 120" used to be: a
// page tape that slides under a fixed index, like the scale on a lens, with
// the current page as a figure above the index. One tick per page, longer
// every 5, numbered every 10.
//
// The tape follows the scroll continuously. PdfScreen calls
// ref.setPosition(pos) from its scroll handler with a fractional page
// (1 = top of page 1); the dial moves its own DOM, so scrolling never
// re-renders the reader. round(pos) is the page whose half is in view, the
// same rule as PdfScreen's page counter.
//
// Drag the tape to scrub through the document; click a tick to jump to it.

const PX = 4;        // tape pixels per page
const W = 112;       // window width
const MID = W / 2;   // the index
const DRAG_SLOP = 3; // px of movement before a press counts as a drag

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const PageDial = forwardRef(function PageDial({ numPages, onScrub, onJump }, ref) {
  const tapeRef = useRef(null);
  const readingRef = useRef(null);
  const sliderRef = useRef(null);
  const labelsRef = useRef([]);
  const pos = useRef(1);
  const drag = useRef(null);

  const n = Math.max(1, numPages || 1);
  const len = (n - 1) * PX;

  // Ticks as two paths (minor, longer) and the tens as labels.
  const { minor, major, labels } = useMemo(() => {
    let mi = '';
    let ma = '';
    const lab = [];
    for (let p = 1; p <= n; p += 1) {
      const x = (p - 1) * PX + 0.5;
      if (p % 10 === 0 || p === 1) { ma += `M${x} 23V32`; lab.push(p); }
      else if (p % 5 === 0) mi += `M${x} 26V32`;
      else mi += `M${x} 29V32`;
    }
    return { minor: mi, major: ma, labels: lab };
  }, [n]);

  const paint = useCallback((p) => {
    const at = clamp(p, 1, n);
    pos.current = at;
    const shift = MID - (at - 1) * PX;
    if (tapeRef.current) tapeRef.current.style.transform = `translateX(${shift}px)`;
    const page = Math.round(at);
    if (readingRef.current && readingRef.current.textContent !== String(page)) {
      readingRef.current.textContent = String(page);
      sliderRef.current?.setAttribute('aria-valuenow', String(page));
      sliderRef.current?.setAttribute('aria-valuetext', `Page ${page} of ${n}`);
    }
    // Numbers make way for the reading: each fades out as it nears the index.
    labels.forEach((lp, i) => {
      const el = labelsRef.current[i];
      if (!el) return;
      const dx = Math.abs((lp - 1) * PX + shift - MID);
      el.style.opacity = String(clamp((dx - 15) / 13, 0, 1));
    });
  }, [n, labels]);

  useImperativeHandle(ref, () => ({ setPosition: paint }), [paint]);

  // Paint once the tape exists, and again if the page count changes.
  const setTape = useCallback((el) => {
    tapeRef.current = el;
    if (el) paint(pos.current);
  }, [paint]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, from: pos.current, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_SLOP) return;
    d.moved = true;
    // Drag the tape: moving it left brings later pages under the index.
    onScrub?.(clamp(d.from - dx / PX, 1, n));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const r = e.currentTarget.getBoundingClientRect();
    const page = Math.round(clamp(pos.current + (e.clientX - r.left - MID) / PX, 1, n));
    onJump?.(page);
  };

  return (
    <div
      ref={sliderRef}
      className="page-dial"
      role="slider"
      tabIndex={0}
      aria-label="Page"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={Math.round(pos.current)}
      aria-valuetext={`Page ${Math.round(pos.current)} of ${n}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
    >
      <div className="page-dial-window">
        <div className="page-dial-tape" ref={setTape} style={{ width: len + 1 }}>
          <svg width={len + 1} height="32" aria-hidden="true">
            <path d={minor} className="page-dial-minor"/>
            <path d={major} className="page-dial-major"/>
          </svg>
          {labels.map((p, i) => (
            <span
              key={p}
              ref={(el) => { labelsRef.current[i] = el; }}
              className="page-dial-label"
              style={{ left: (p - 1) * PX }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
      <span className="page-dial-index" aria-hidden="true"/>
      <span className="page-dial-reading" ref={readingRef} aria-hidden="true">1</span>
    </div>
  );
});

export default PageDial;
