import React, { useState } from 'react';
import { fmtInterval } from '../utils/format';

// The review instrument. One bar per card in queue order; bar length is the
// card's interval on a log scale (now → 1 year). A graded card's bar is
// redrawn at its new interval in the data colour, over a dotted trace of the
// old one, so the session reads as cards being pushed out (or, on Again,
// pulled back). The spine is ink as far as the session has come; the
// current card is the you colour.
//
// `items`: [{ id, days, next }] where `next` is the new interval once graded.
// `index`: the current card (items.length when the session is done).
// `orientation`: 'v' in the review margin, 'h' along the top on a phone.

const YEAR = 365;
export const reach = (d) => Math.min(1, Math.log1p(Math.max(0, d || 0)) / Math.log1p(YEAR));
// Gridlines at a day, a week, a month and a year; the week goes unlabelled
// because at 136px its label would touch the month's.
const GRID = [[1, '1 d'], [7, null], [30, '1 mo'], [365, '1 yr']];

export default function Comb({ items, index, orientation = 'v', length = 136, span = 288, labels = true, readout, strength = 'half' }) {
  const [hover, setHover] = useState(null);
  const n = items.length;
  if (!n) return null;
  const vertical = orientation === 'v';
  const gap = n > 1 ? Math.max(3, Math.min(vertical ? 16 : 14, span / (n - 1))) : 0;
  const extent = gap * (n - 1);
  const covered = Math.min(index, n - 1) * gap;

  const at = (i) => `${i * gap}px`;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = vertical ? e.clientY - r.top : e.clientX - r.left;
    const i = gap ? Math.round(p / gap) : 0;
    setHover(i >= 0 && i < n ? i : null);
  };

  let text = readout;
  if (hover != null) {
    const it = items[hover];
    text = it.next != null
      ? `${fmtInterval(it.days)} → ${fmtInterval(it.next)}`
      : hover === index ? `${fmtInterval(it.days)}, now` : fmtInterval(it.days);
  }

  return (
    <div
      className={`comb comb-${orientation} comb-${strength}`}
      style={vertical ? { width: length } : { height: length }}
    >
      <div
        className="comb-field"
        style={vertical ? { height: extent + 1 } : { width: extent + 1, height: length }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        tabIndex={strength === 'half' ? 0 : undefined}
        aria-label={`Session progress: card ${Math.min(index + 1, n)} of ${n}`}
      >
        {vertical && GRID.map(([d]) => (
          <span key={d} className="comb-grid" style={{ left: `${reach(d) * 100}%` }}/>
        ))}
        <span className="comb-spine"/>
        <span className="comb-spine covered" style={vertical ? { height: covered } : { width: covered }}/>
        {items.map((it, i) => {
          const graded = it.next != null;
          const cur = i === index;
          const cls = graded ? 'graded' : cur ? 'current' : 'pending';
          const pos = vertical ? { top: at(i) } : { left: at(i) };
          const scale = (d) => (vertical ? `scaleX(${Math.max(0.015, reach(d))})` : `scaleY(${Math.max(0.03, reach(d))})`);
          return (
            <React.Fragment key={it.id ?? i}>
              {graded && <span className="comb-trace" style={{ ...pos, transform: scale(it.days) }}/>}
              <span
                className={`comb-bar ${cls}${hover === i ? ' hover' : ''}`}
                style={{ ...pos, transform: scale(graded ? it.next : it.days) }}
              />
            </React.Fragment>
          );
        })}
      </div>
      {vertical && labels && (
        <div className="comb-scale t-small xs ink-3" aria-hidden="true">
          {GRID.filter(([, l]) => l).map(([d, l]) => (
            <span key={d} style={{ left: `${reach(d) * 100}%` }}>{l}</span>
          ))}
        </div>
      )}
      {text && <div className="comb-readout t-small ink-2" aria-live="polite">{text}</div>}
    </div>
  );
}
