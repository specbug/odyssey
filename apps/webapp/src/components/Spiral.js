import React, { useMemo, useState } from 'react';
import { reach } from './Comb';
import { fmtInterval } from '../utils/format';
import { inkStyle } from '../data/inks';

// Today's queue on a time spiral. The curve is a log time axis wound into an
// Archimedean spiral: the centre is now, the outer end one year. Each due
// card is a tick at its current interval, so new and fragile cards sit near
// the centre and well-learned ones far out. Point at a tick to read it.
//
// `items`: [{ id, days, label }]

const TURNS = 2.25;
const MARKS = [[1, '1 d'], [7, '1 wk'], [30, '1 mo'], [365, '1 yr']];

export default function Spiral({ items, size = 272 }) {
  const [hover, setHover] = useState(null);
  const R = size / 2 - 20;
  const r0 = 6;
  const c = size / 2;
  const P = (t, dr = 0) => {
    const a = t * TURNS * 2 * Math.PI - Math.PI / 2;
    const r = r0 + (R - r0) * t + dr;
    return [c + r * Math.cos(a), c + r * Math.sin(a), a];
  };

  const curve = useMemo(() => {
    const pts = [];
    for (let k = 0; k <= 480; k += 1) {
      const [x, y] = P(k / 480);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const ticks = items.map((it) => {
    const t = reach(it.days);
    const [x1, y1] = P(t, -4);
    const [x2, y2] = P(t, 4);
    const [x, y] = P(t);
    return { ...it, x1, y1, x2, y2, x, y };
  });

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * size;
    const py = ((e.clientY - r.top) / r.height) * size;
    let best = null; let bd = 10 * 10;
    ticks.forEach((t, i) => {
      const d = (t.x - px) ** 2 + (t.y - py) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    setHover(best);
  };

  const h = hover != null ? ticks[hover] : null;

  return (
    <figure className="spiral">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${items.length} due cards by interval, from new at the centre to one year at the edge`}
      >
        <polyline points={curve} fill="none" stroke="var(--rule)" strokeWidth="1"/>
        {MARKS.map(([d, label]) => {
          const [x, y, a] = P(reach(d));
          // Half way to the next turn out, so the label sits between turns.
          const off = Math.min(14, ((R - r0) / TURNS) / 2);
          const [lx, ly] = [x + off * Math.cos(a), y + off * Math.sin(a)];
          return (
            <g key={d}>
              <circle cx={x} cy={y} r="1.5" fill="var(--ink-3)"/>
              <text x={lx} y={ly} dy="0.35em" textAnchor="middle" className="spiral-label">{label}</text>
            </g>
          );
        })}
        {ticks.map((t, i) => (
          <line
            key={t.id ?? i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            {...(t.ink != null ? { 'data-ink': '', style: inkStyle(t.ink) } : {})}
            stroke={hover === i ? 'var(--ink)' : 'var(--doc-mark)'}
            strokeWidth={hover === i ? 2 : 1.25}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <figcaption className="spiral-readout t-small ink-2" aria-live="polite">
        {h ? <><span className="c-data">{fmtInterval(h.days)}</span> {h.label}</> : '\u00a0'}
      </figcaption>
    </figure>
  );
}
