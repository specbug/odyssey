import React from 'react';

// Information-rich starburst glyph. Each stroke encodes one prompt's interval.
// - length: log-scaled from `days`
// - taper: wedge-shaped (wide at inner, narrow at tip) for the halo illusion
// - opacity: dims for retired/new; accent color for completed
// - rotation: tickAngle rotates the whole figure clockwise during review
export default function Starburst({
  prompts = [],
  size = 200,
  innerRadius = 10,
  maxLength = 0.82,
  tickAngle = 0,
  mode = 'radial',
  color = 'currentColor',
  accentColor = null,
  thickness = 1.6,
  className = '',
  onTickHover = null,
  style = {},
}) {
  const n = prompts.length || 16;
  const half = size / 2;

  if (mode === 'unwrap') {
    // Vertical stack — each prompt a bar, length = log(days).
    const barH = Math.max(2, Math.floor(size / n) - 1);
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style} className={className}>
        {prompts.map((p, i) => {
          const len = encodeLength(p.days) * size;
          const y = i * (barH + 1) + 2;
          const c = p.completed ? (accentColor || color) : color;
          const o = p.state === 'retired' ? 0.25 : p.state === 'new' ? 0.5 : 1;
          return <rect key={i} x={0} y={y} width={len} height={barH} fill={c} opacity={o} rx={0.5}/>;
        })}
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      style={{ transform: `rotate(${tickAngle}deg)`, transition: 'transform 520ms cubic-bezier(.2,.7,.2,1)', ...style }}
      className={className}
    >
      <g>
        <circle r={innerRadius * 0.4} fill={color} opacity={0.85}/>
        {prompts.length === 0 &&
          Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * 360;
            return strokeWedge(i, angle, innerRadius, innerRadius + 40, thickness, color, 0.3);
          })}
        {prompts.map((p, i) => {
          const angle = (i / n) * 360;
          const len = innerRadius + encodeLength(p.days) * (half * maxLength);
          const c = p.completed ? (accentColor || color) : color;
          let o = 1;
          if (p.state === 'retired') o = 0.22;
          else if (p.state === 'new') o = 0.55;
          else if (p.state === 'learning') o = 0.85;
          if (p.dim) o *= 0.5;
          const tw = thickness * (p.heavy ? 1.4 : 1);
          return strokeWedge(i, angle, innerRadius, len, tw, c, o, onTickHover);
        })}
      </g>
    </svg>
  );
}

function strokeWedge(key, angleDeg, rInner, rOuter, thick, color, opacity, onHover) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  const perp = angle + Math.PI / 2;
  const wInner = thick * 2.2;
  const wOuter = thick * 0.45;
  const ix = Math.cos(angle) * rInner;
  const iy = Math.sin(angle) * rInner;
  const ox = Math.cos(angle) * rOuter;
  const oy = Math.sin(angle) * rOuter;
  const px = Math.cos(perp);
  const py = Math.sin(perp);

  const p1 = [ix + px * wInner, iy + py * wInner];
  const p2 = [ix - px * wInner, iy - py * wInner];
  const p3 = [ox - px * wOuter, oy - py * wOuter];
  const p4 = [ox + px * wOuter, oy + py * wOuter];

  const d = `M${p1[0].toFixed(2)},${p1[1].toFixed(2)} L${p2[0].toFixed(2)},${p2[1].toFixed(2)} L${p3[0].toFixed(2)},${p3[1].toFixed(2)} L${p4[0].toFixed(2)},${p4[1].toFixed(2)} Z`;
  return (
    <path
      key={key}
      d={d}
      fill={color}
      opacity={opacity}
      onMouseEnter={onHover ? (e) => onHover(key, e) : undefined}
      style={{ transition: 'opacity 320ms, fill 320ms' }}
    />
  );
}

// Log-scaled length so day-1 and year-long intervals both read reasonably.
function encodeLength(days) {
  if (days == null || days <= 0) return 0.22;
  return Math.min(1, 0.22 + Math.log10(days + 1) * 0.32);
}

// Brand mark — the petal-logo PNG rendered black. Source art in public/logo.png;
// black variant baked at public/logo-black.png so we don't rely on CSS filters.
export function Mark({ size = 24 }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL || ''}/logo-black.png`}
      width={size}
      height={size}
      alt="Odyssey"
      style={{ display: 'block' }}
    />
  );
}

export function seedPrompts(n, seed = 1) {
  const prompts = [];
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const r = rand();
    let days;
    if (r < 0.15) days = Math.floor(rand() * 2) + 1;
    else if (r < 0.5) days = Math.floor(rand() * 10) + 3;
    else if (r < 0.85) days = Math.floor(rand() * 40) + 14;
    else days = Math.floor(rand() * 120) + 45;
    const state = r < 0.1 ? 'new' : r < 0.25 ? 'learning' : r < 0.95 ? 'review' : 'retired';
    prompts.push({ days, state });
  }
  return prompts;
}
