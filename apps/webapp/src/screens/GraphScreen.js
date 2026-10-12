import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import apiService from '../api';
import { toNote } from '../data/adapters';
import { renderRich } from '../utils/render';
import { plainText, relativeDate, RELATION_LABEL } from '../utils/format';
import { Ic } from '../components/Icons';
import { docColor } from '../utils/hue';

// The note graph. Links are written by the backend's background linker —
// nothing here creates them; the reader only browses and unlinks. Layout is
// computed once per data change and then held still: a graph that keeps
// drifting is noise, not information.

const POLL_MS = 60_000;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

const nodeRadius = (degree) => 2.5 + Math.sqrt(degree) * 1.3;
const hueFill = (hue) => docColor(hue);

export default function GraphScreen({ focusId = null, onOpenDoc }) {
  const [notes, setNotes] = useState([]);
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(focusId);
  const [hovered, setHovered] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  // Links unlinked while this screen is open, so the panel can offer undo.
  const [unlinked, setUnlinked] = useState(() => new Map());

  const refresh = useCallback(async () => {
    try {
      const [anns, ls] = await Promise.all([
        apiService.getAllAnnotations({ limit: 5000 }),
        apiService.getLinks(),
      ]);
      setNotes(anns.map(toNote).filter(Boolean));
      setLinks(ls.links || []);
      setStats(ls.stats || null);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // The linker works in the background; pick up what it finds.
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const liveLinks = useMemo(
    () => links.filter((l) => byId.has(l.source) && byId.has(l.target) && !unlinked.has(l.id)),
    [links, byId, unlinked],
  );
  const degree = useMemo(() => {
    const d = new Map();
    liveLinks.forEach((l) => {
      d.set(l.source, (d.get(l.source) || 0) + 1);
      d.set(l.target, (d.get(l.target) || 0) + 1);
    });
    return d;
  }, [liveLinks]);

  const visible = useMemo(
    () => notes.filter((n) => showAll || degree.has(n.id)),
    [notes, showAll, degree],
  );

  const positions = useLayout(visible, liveLinks, degree);

  const focus = hovered ?? selected;
  const neighbours = useMemo(() => {
    if (focus == null) return null;
    const set = new Set([focus]);
    liveLinks.forEach((l) => {
      if (l.source === focus) set.add(l.target);
      if (l.target === focus) set.add(l.source);
    });
    return set;
  }, [focus, liveLinks]);

  const unlink = async (link) => {
    setUnlinked((m) => new Map(m).set(link.id, link));
    try {
      await apiService.rejectLink(link.id);
    } catch (e) {
      setUnlinked((m) => { const n = new Map(m); n.delete(link.id); return n; });
      setError(e.message || String(e));
    }
  };

  const restore = async (link) => {
    try {
      await apiService.restoreLink(link.id);
      setUnlinked((m) => { const n = new Map(m); n.delete(link.id); return n; });
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectedNote = selected != null ? byId.get(selected) : null;
  const selectedLinks = useMemo(() => {
    if (selected == null) return [];
    return links
      .filter((l) => (l.source === selected || l.target === selected) && (byId.has(l.source) && byId.has(l.target)))
      .map((l) => ({ link: l, other: byId.get(l.source === selected ? l.target : l.source) }));
  }, [links, selected, byId]);

  if (error && !notes.length) {
    return (
      <div className="scroll" style={{ padding: '48px 64px' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-3)' }}>Couldn't reach the archive.</div>
        <div style={{ marginTop: 12, color: 'var(--ink-2)' }}>{error}</div>
      </div>
    );
  }

  const linkedCount = degree.size;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 340px' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <header style={{ padding: '48px 64px 20px', borderBottom: '1px solid var(--rule)' }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>
            GRAPH · {liveLinks.length} LINK{liveLinks.length === 1 ? '' : 'S'} ACROSS {linkedCount} OF {notes.length} NOTES
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <h1 style={{ fontSize: 44, fontWeight: 400, letterSpacing: '-0.03em', flex: 1 }}>
              How your notes connect.
            </h1>
            <div className="tweak-seg" style={{ marginBottom: 8, whiteSpace: 'nowrap' }}>
              <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>Linked</button>
              <button aria-pressed={showAll} onClick={() => setShowAll(true)}>All notes</button>
            </div>
          </div>
          <LinkerLine stats={stats}/>
        </header>

        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {visible.length === 0 && !loading ? (
            <EmptyGraph stats={stats} hasNotes={notes.length > 0}/>
          ) : (
            <GraphCanvas
              nodes={visible}
              links={liveLinks}
              positions={positions}
              degree={degree}
              selected={selected}
              focus={focus}
              neighbours={neighbours}
              focusId={focusId}
              onSelect={setSelected}
              onHover={setHovered}
              onHoverLink={setHoverLink}
            />
          )}
          {hoverLink && <LinkTooltip hover={hoverLink}/>}
        </div>
      </section>

      <aside className="scroll" style={{ borderLeft: '1px solid var(--rule)', padding: '48px 28px 64px' }}>
        {selectedNote ? (
          <NotePanel
            note={selectedNote}
            entries={selectedLinks}
            unlinked={unlinked}
            onSelect={setSelected}
            onUnlink={unlink}
            onRestore={restore}
            onOpenDoc={onOpenDoc}
          />
        ) : (
          <Overview stats={stats} notes={notes} degree={degree} onSelect={setSelected}/>
        )}
      </aside>
    </div>
  );
}

// Force layout, run to rest synchronously so the graph appears still. Each
// pass seeds from the previous positions, so a poll that adds one link nudges
// the picture instead of reshuffling it.
function useLayout(nodes, links, degree) {
  const memo = useRef({ shape: null, positions: new Map() });
  // Polls hand back fresh arrays every minute; only a change in which nodes
  // and links exist should move anything.
  const shape = `${nodes.map((n) => n.id).sort((a, b) => a - b).join(',')}|${links.map((l) => l.id).sort((a, b) => a - b).join(',')}`;
  if (memo.current.shape !== shape) {
    memo.current = { shape, positions: layout(nodes, links, degree, memo.current.positions) };
  }
  return memo.current.positions;
}

function layout(nodes, links, degree, prev) {
  const simNodes = [...nodes]
    .sort((a, b) => a.id - b.id)
    .map((n) => {
      const p = prev.get(n.id);
      return { id: n.id, r: nodeRadius(degree.get(n.id) || 0), ...(p ? { x: p.x, y: p.y } : {}) };
    });
  const ids = new Set(simNodes.map((n) => n.id));
  const simLinks = links
    .filter((l) => ids.has(l.source) && ids.has(l.target))
    .map((l) => ({ source: l.source, target: l.target }));
  const known = simNodes.filter((n) => prev.has(n.id)).length;
  const settled = simNodes.length > 0 && known === simNodes.length;

  const sim = forceSimulation(simNodes)
    .force('link', forceLink(simLinks).id((d) => d.id).distance(56).strength(0.7))
    .force('charge', forceManyBody().strength(-46).distanceMax(320))
    .force('collide', forceCollide((d) => d.r + 4))
    // Gentle pull to the middle keeps islands from drifting off-canvas.
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.05))
    .alpha(settled ? 0.15 : known > 0 ? 0.5 : 1)
    .stop();
  const ticks = settled ? 60 : 320;
  for (let i = 0; i < ticks; i += 1) sim.tick();

  // Keep positions of nodes that left (e.g. "All notes" toggled off), so
  // they land back where they were.
  const out = new Map(simNodes.map((n) => [n.id, { x: n.x, y: n.y, r: n.r }]));
  return new Map([...prev, ...out]);
}

function GraphCanvas({ nodes, links, positions, degree, selected, focus, neighbours, focusId, onSelect, onHover, onHoverLink }) {
  const svgRef = useRef(null);
  const layerRef = useRef(null);
  const zoomRef = useRef(null);
  const fittedRef = useRef(false);
  const [scale, setScale] = useState(1);

  // Pan / zoom writes the transform straight onto the layer — re-rendering
  // hundreds of nodes per wheel event would stutter.
  useEffect(() => {
    const svg = select(svgRef.current);
    const z = d3zoom()
      .scaleExtent([0.25, 5])
      .on('zoom', (e) => {
        layerRef.current?.setAttribute('transform', e.transform.toString());
        setScale((s) => (Math.abs(s - e.transform.k) > 0.05 ? e.transform.k : s));
      });
    svg.call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => svg.on('.zoom', null);
  }, []);

  // Fit everything once, then centre on the deep-linked note if there is one.
  useEffect(() => {
    if (fittedRef.current || positions.size === 0 || !svgRef.current) return;
    fittedRef.current = true;
    const { width, height } = svgRef.current.getBoundingClientRect();
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    positions.forEach((p) => {
      x0 = Math.min(x0, p.x - p.r); y0 = Math.min(y0, p.y - p.r);
      x1 = Math.max(x1, p.x + p.r); y1 = Math.max(y1, p.y + p.r);
    });
    const pad = 64;
    const k = Math.min(2, (width - pad * 2) / Math.max(1, x1 - x0), (height - pad * 2) / Math.max(1, y1 - y0));
    const focus = focusId != null ? positions.get(focusId) : null;
    const cx = focus ? focus.x : (x0 + x1) / 2;
    const cy = focus ? focus.y : (y0 + y1) / 2;
    const kk = focus ? Math.max(k, 1.4) : k;
    select(svgRef.current).call(
      zoomRef.current.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(kk).translate(-cx, -cy),
    );
  }, [positions, focusId]);

  const dim = (id) => neighbours != null && !neighbours.has(id);
  const isHot = (l) => focus != null && (l.source === focus || l.target === focus);
  const labels = useMemo(
    () => placeLabels({ nodes, positions, degree, focus, neighbours, scale }),
    [nodes, positions, degree, focus, neighbours, scale],
  );

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', cursor: 'grab', background: 'var(--paper)' }}
      onClick={(e) => { if (e.target === svgRef.current) onSelect(null); }}
      role="img"
      aria-label="Graph of linked notes"
    >
      <g ref={layerRef}>
        {links.map((l) => {
          const a = positions.get(l.source);
          const b = positions.get(l.target);
          if (!a || !b) return null;
          const hot = isHot(l);
          return (
            <g key={l.id}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={hot ? 'var(--accent)' : 'var(--rule-2)'}
                strokeWidth={hot ? 1.25 : 1}
                vectorEffect="non-scaling-stroke"
                style={{ opacity: neighbours != null && !hot ? 0.25 : 1, transition: `opacity 220ms ${EASE}, stroke 220ms ${EASE}` }}
              />
              {/* Wider invisible stroke so a 1px edge is hoverable. */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent"
                strokeWidth={10}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={(e) => onHoverLink({ link: l, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => onHoverLink({ link: l, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => onHoverLink(null)}
              />
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const active = n.id === selected;
          return (
            <g
              key={n.id}
              className="graph-node"
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: 'pointer', opacity: dim(n.id) ? 0.22 : 1, transition: `opacity 220ms ${EASE}` }}
              onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
              onMouseEnter={() => onHover(n.id)}
              onMouseLeave={() => onHover(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id); } }}
              tabIndex={0}
              role="button"
              aria-label={plainText(n.prompt || n.excerpt, 80) || 'Note'}
              aria-pressed={active}
            >
              {/* Keyboard focus ring; the UA outline is suppressed in base.css. */}
              <circle className="graph-node-focus" r={p.r + 4} fill="none" stroke="var(--ink-3)" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
              {active && <circle r={p.r + 4} fill="none" stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke"/>}
              <circle r={p.r} fill={hueFill(n.sourceHue)} stroke="var(--paper)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
            </g>
          );
        })}
        {/* Labels sit in their own layer, above every node and edge. */}
        <g style={{ pointerEvents: 'none' }}>
          {labels.map((l) => (
            <text
              key={l.id}
              x={l.x}
              y={l.y + l.h / 2}
              dominantBaseline="central"
              style={{
                fontFamily: 'var(--sans)',
                fontSize: l.fs,
                fill: l.id === focus ? 'var(--ink)' : 'var(--ink-2)',
                paintOrder: 'stroke',
                stroke: 'var(--paper)',
                strokeWidth: l.fs * 0.3,
                strokeLinejoin: 'round',
              }}
            >
              {l.text}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
}

// Text width in graph units. Canvas measures the real face once it has
// loaded; the em estimate covers the first paint.
let measureCtx = null;
function textWidth(text, fs) {
  try {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = `${fs}px 'R Sans'`;
    return measureCtx.measureText(text).width;
  } catch {
    return text.length * fs * 0.55;
  }
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Greedy label placement: the focused note first, then its neighbours by
// degree. Each tries right, left, above, below and is dropped if all four
// collide with a placed label or another node — the side panel lists every
// neighbour anyway, so a missing label loses nothing.
function placeLabels({ nodes, positions, degree, focus, neighbours, scale }) {
  const fs = 11 / Math.max(scale, 0.6);
  const h = fs * 1.3;
  const gap = 6 / Math.max(scale, 0.6);
  let ids;
  if (neighbours != null) {
    ids = [focus, ...[...neighbours].filter((id) => id !== focus)
      .sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0) || a - b)];
  } else if (scale >= 1.6) {
    // Zoomed in with nothing focused: name the hubs.
    ids = nodes.map((n) => n.id).filter((id) => (degree.get(id) || 0) >= 3);
  } else {
    return [];
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const discs = nodes
    .map((n) => ({ id: n.id, p: positions.get(n.id) }))
    .filter((d) => d.p)
    .map(({ id, p }) => ({ id, x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }));
  const placed = [];
  const out = [];
  ids.forEach((id) => {
    const n = byId.get(id);
    const p = positions.get(id);
    if (!n || !p) return;
    const text = plainText(n.prompt || n.excerpt, 42);
    if (!text) return;
    const w = textWidth(text, fs);
    const spots = [
      { x: p.x + p.r + gap, y: p.y - h / 2 },
      { x: p.x - p.r - gap - w, y: p.y - h / 2 },
      { x: p.x - w / 2, y: p.y - p.r - gap - h },
      { x: p.x - w / 2, y: p.y + p.r + gap },
    ].map((s) => ({ ...s, w, h }));
    const free = spots.find((box) => !placed.some((b) => overlaps(box, b))
      && !discs.some((d) => d.id !== id && overlaps(box, d)));
    const box = free || (id === focus ? spots[0] : null);
    if (!box) return;
    placed.push(box);
    out.push({ id, text, fs, ...box });
  });
  return out;
}

function LinkTooltip({ hover }) {
  const { link, x, y } = hover;
  return (
    <div
      style={{
        position: 'fixed',
        left: x + 14,
        top: y + 14,
        maxWidth: 280,
        padding: '10px 12px',
        background: 'var(--paper)',
        boxShadow: '0 0 0 1px var(--rule-2), 0 8px 24px -8px rgba(0,0,0,0.16)',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 4 }}>
        {RELATION_LABEL[link.relation] || 'Linked'}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>{link.reason}</div>
    </div>
  );
}

function LinkerLine({ stats }) {
  if (!stats) return null;
  let text;
  if (!stats.enabled) text = 'LINKER · OFF';
  else if (stats.last_error) text = `LINKER · RETRYING · ${stats.pending} PENDING`;
  else if (stats.pending > 0) text = `LINKER · READING · ${stats.pending} PENDING`;
  else text = 'LINKER · UP TO DATE';
  const last = stats.last_run ? ` · LAST PASS ${relativeDate(stats.last_run).toUpperCase()}` : '';
  return (
    <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 14 }}>
      {text}{stats.enabled ? last : ''}
    </div>
  );
}

function EmptyGraph({ stats, hasNotes }) {
  let line;
  if (!hasNotes) line = 'No notes yet. Mark a passage and the archive starts to connect.';
  else if (stats && !stats.enabled) line = 'Linking is off. Set META_API_KEY on the server and the archive starts connecting itself.';
  else line = 'No connections yet. New notes are read in the background — links appear here as they’re found.';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 48 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.6 }}>
        {line}
      </div>
    </div>
  );
}

function Overview({ stats, notes, degree, onSelect }) {
  const hubs = useMemo(
    () => notes
      .filter((n) => (degree.get(n.id) || 0) > 0)
      .sort((a, b) => (degree.get(b.id) - degree.get(a.id)) || (a.id - b.id))
      .slice(0, 6),
    [notes, degree],
  );
  return (
    <div className="enter">
      <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 14 }}>ABOUT THE LINKS</div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: 28 }}>
        Each link is proposed by the model, then checked again on its own. Only pairs that pass both
        are drawn. Select a note to see why it connects — unlink anything that doesn’t earn its place,
        and it won’t come back.
      </p>

      {stats && stats.proposed > 0 && (
        // The two numbers that say whether the links are any good, as a
        // quiet ledger line rather than dashboard tiles.
        <div className="mono" style={{ color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 32 }}>
          {stats.accepted} of {stats.proposed} proposals passed the second check.
          <br/>
          {stats.rejected} of {stats.active + stats.rejected} links unlinked by you.
        </div>
      )}

      {hubs.length > 0 && (
        <>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>MOST CONNECTED</div>
          {hubs.map((n) => (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className="graph-row"
              style={rowBtn}
            >
              <span style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, marginTop: 8, background: hueFill(n.sourceHue) }}/>
              <span style={{ flex: 1, minWidth: 0, ...clamp(2), fontSize: 13.5, lineHeight: 1.45 }}>
                {plainText(n.prompt || n.excerpt, 140)}
              </span>
              <span className="mono" style={{ color: 'var(--ink-4)' }}>{degree.get(n.id)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function NotePanel({ note, entries, unlinked, onSelect, onUnlink, onRestore, onOpenDoc }) {
  const live = entries.filter((e) => !unlinked.has(e.link.id));
  return (
    <div key={note.id} className="enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: hueFill(note.sourceHue) }}/>
        <span className="mono-sm" style={{ color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.sourceTitle ? `${note.sourceTitle.toUpperCase()} · p. ${note.page ?? '—'}` : 'STANDALONE'}
        </span>
        <button className="btn ghost xs" style={{ marginLeft: 'auto', padding: '2px 6px' }} onClick={() => onSelect(null)} aria-label="Close">
          <Ic.Close size={14}/>
        </button>
      </div>

      <div style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--ink)', borderLeft: '1px solid var(--ink-4)', paddingLeft: 16 }}>
        {renderRich(note.prompt || note.excerpt, { cloze: 'inline' })}
      </div>
      {note.answer && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', borderLeft: '1px solid var(--rule)', paddingLeft: 16, marginTop: 12 }}>
          {renderRich(note.answer)}
        </div>
      )}
      {note.source != null && (
        <button className="btn ghost xs" style={{ marginTop: 16, color: 'var(--ink-3)' }} onClick={() => onOpenDoc(note.source, note.id)}>
          <span className="mono-sm">Open in source</span> <Ic.Right size={14}/>
        </button>
      )}

      <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 36, marginBottom: 6 }}>
        CONNECTED · {live.length}
      </div>
      {entries.length === 0 && (
        <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 14, padding: '12px 0' }}>
          Not linked to anything yet.
        </div>
      )}
      {entries.map(({ link, other }) => (
        <LinkEntry
          key={link.id}
          link={link}
          other={other}
          isUnlinked={unlinked.has(link.id)}
          onSelect={onSelect}
          onUnlink={onUnlink}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}

function LinkEntry({ link, other, isUnlinked, onSelect, onUnlink, onRestore }) {
  if (isUnlinked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--rule)', color: 'var(--ink-4)' }}>
        <span style={{ fontSize: 13, fontStyle: 'italic', flex: 1 }}>Unlinked. It won’t be suggested again.</span>
        <button className="btn ghost xs" onClick={() => onRestore(link)}>Undo</button>
      </div>
    );
  }
  return (
    <div className="graph-link" style={{ padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span className="mono-sm" style={{ color: 'var(--ink-4)', flex: 1 }}>
          {RELATION_LABEL[link.relation] || 'Linked'}
          {other.sourceTitle ? ` · ${other.sourceTitle.toUpperCase()}` : ' · STANDALONE'}
        </span>
        <button className="btn ghost xs graph-unlink" onClick={() => onUnlink(link)} aria-label="Unlink these notes">
          Unlink
        </button>
      </div>
      <button onClick={() => onSelect(other.id)} style={{ ...rowBtn, padding: 0, marginBottom: 6 }}>
        <span style={{ ...clamp(3), fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
          {plainText(other.prompt || other.excerpt, 220)}
        </span>
      </button>
      {link.reason && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-3)' }}>{link.reason}</div>
      )}
    </div>
  );
}

const rowBtn = {
  width: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '8px 0',
  border: 0,
  background: 'transparent',
  color: 'var(--ink-2)',
  textAlign: 'left',
  cursor: 'pointer',
};

const clamp = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});
