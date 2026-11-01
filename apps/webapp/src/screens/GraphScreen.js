import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import apiService from '../api';
import { toNote } from '../data/adapters';
import { renderRich } from '../utils/render';
import { failText, plainText, plural, relativeDate, RELATION_LABEL } from '../utils/format';
import { Ic } from '../components/Icons';

// The note graph. Links are written by the backend's background linker —
// nothing here creates them; the reader only browses and unlinks. Layout is
// computed once per data change and then held still: a graph that keeps
// drifting is noise, not information.

const POLL_MS = 60_000;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

const nodeRadius = (degree) => 2.5 + Math.sqrt(degree) * 1.3;

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
      setError(failText('load graph', e));
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
      setError(failText('unlink', e));
    }
  };

  const restore = async (link) => {
    try {
      await apiService.restoreLink(link.id);
      setUnlinked((m) => { const n = new Map(m); n.delete(link.id); return n; });
    } catch (e) {
      setError(failText('restore link', e));
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
      <div className="scroll">
        <div className="page">
          <div className="notice"><p>{error}</p><button className="btn sm" onClick={refresh}>Retry</button></div>
        </div>
      </div>
    );
  }

  const linkedCount = degree.size;

  return (
    <div className="graph">
      <section className="graph-main">
        <header className="graph-head">
          <div className="page-head">
            <h1 className="t-h">Graph</h1>
            <div className="tabs" role="group" aria-label="Show">
              <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>Linked</button>
              <button aria-pressed={showAll} onClick={() => setShowAll(true)}>All notes</button>
            </div>
          </div>
          <p className="t-small ink-2 graph-readout">
            {plural(liveLinks.length, 'link')} across {linkedCount} of {plural(notes.length, 'note')}
            <LinkerLine stats={stats}/>
          </p>
        </header>

        <div className="graph-canvas">
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

      <aside className="graph-panel scroll" aria-label={selectedNote ? 'Selected note' : 'About the links'}>
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
      style={{ display: 'block', cursor: 'grab' }}
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
                stroke={hot ? 'var(--ink-2)' : 'var(--rule)'}
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
              {/* The selected note is where you are: a you-colour ring. */}
              {active && <circle r={p.r + 4} fill="none" stroke="var(--you)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>}
              {/* Nodes are the person's notes, so the note colour. */}
              <circle r={p.r} fill="var(--note)" stroke="var(--ground)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
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
                fontFamily: 'var(--small)',
                fontSize: l.fs,
                fill: l.id === focus ? 'var(--ink)' : 'var(--ink-2)',
                paintOrder: 'stroke',
                stroke: 'var(--ground)',
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
    measureCtx.font = `${fs}px 'Google Sans Flex'`;
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
  // Clear of the 4px selection ring.
  const gap = 10 / Math.max(scale, 0.6);
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
    <div className="graph-tip" style={{ left: x + 14, top: y + 14 }}>
      <p className="t-small ink-3">{RELATION_LABEL[link.relation] || 'Linked'}</p>
      {link.reason && <p className="t-note">{link.reason}</p>}
    </div>
  );
}

function LinkerLine({ stats }) {
  if (!stats) return null;
  let text;
  if (!stats.enabled) text = 'Linking off. Set META_API_KEY to enable.';
  else if (stats.last_error) text = `Linking failed, retrying. ${stats.pending} pending.`;
  else if (stats.pending > 0) text = `Checking ${plural(stats.pending, 'note')}.`;
  else text = `Up to date${stats.last_run ? `, checked ${relativeDate(stats.last_run)}` : ''}.`;
  return <span className="ink-3"> · {text}</span>;
}

function EmptyGraph({ stats, hasNotes }) {
  let line;
  if (!hasNotes) line = 'No notes.';
  else if (stats && !stats.enabled) line = 'No links. Linking off.';
  else line = 'No links. Notes are checked in the background.';
  return <p className="empty graph-empty">{line}</p>;
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
    <div className="graph-overview">
      <p className="t-note">
        Links are model-proposed, then independently verified. Removed links stay removed.
      </p>

      {stats && stats.proposed > 0 && (
        // Whether the links are any good: how often verification agrees with
        // the proposal, and how often you remove what passed.
        <p className="t-small ink-2 graph-stats">
          {stats.accepted} of {stats.proposed} proposals passed verification.<br/>
          {stats.rejected} of {stats.active + stats.rejected} links removed by you.
        </p>
      )}

      {hubs.length > 0 && (
        <section>
          <h2 className="t-small ink-2 panel-h">Most linked</h2>
          <ul className="panel-list">
            {hubs.map((n) => (
              <li key={n.id}>
                <button className="panel-row" onClick={() => onSelect(n.id)}>
                  <span className="panel-row-text">{plainText(n.prompt || n.excerpt, 140)}</span>
                  <span className="t-small ink-3">{degree.get(n.id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NotePanel({ note, entries, unlinked, onSelect, onUnlink, onRestore, onOpenDoc }) {
  const live = entries.filter((e) => !unlinked.has(e.link.id));
  const where = note.sourceTitle ? `${note.sourceTitle}${note.page ? ` · p.\u00a0${note.page}` : ''}` : 'Standalone';
  return (
    <div key={note.id} className="graph-note">
      <div className="graph-note-head">
        <span className="t-small ink-3 graph-note-where">{where}</span>
        <button className="btn ghost sm quiet" onClick={() => onSelect(null)} aria-label="Close">
          <Ic.Close size={16}/>
        </button>
      </div>

      <div className="card graph-note-card">
        <div className="graph-note-text">{renderRich(note.prompt || note.excerpt, { cloze: 'inline' })}</div>
        {note.answer && <div className="t-note graph-note-answer">{renderRich(note.answer)}</div>}
      </div>
      {note.source != null && (
        <button className="btn ghost sm link graph-open" onClick={() => onOpenDoc(note.source, note.id)}>
          Open in document
        </button>
      )}

      <h2 className="t-small ink-2 panel-h">{live.length ? plural(live.length, 'link') : 'No links'}</h2>
      <ul className="panel-list">
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
      </ul>
    </div>
  );
}

function LinkEntry({ link, other, isUnlinked, onSelect, onUnlink, onRestore }) {
  if (isUnlinked) {
    return (
      <li className="graph-link unlinked">
        <span className="t-note">Unlinked.</span>
        <button className="btn ghost sm link" onClick={() => onRestore(link)}>Undo</button>
      </li>
    );
  }
  return (
    <li className="graph-link">
      <div className="graph-link-head">
        <span className="t-small ink-3">
          {RELATION_LABEL[link.relation] || 'Linked'}
          {other.sourceTitle ? ` · ${other.sourceTitle}` : ' · Standalone'}
        </span>
        <button className="btn ghost sm quiet graph-unlink" onClick={() => onUnlink(link)} aria-label="Unlink these notes">
          Unlink
        </button>
      </div>
      <button className="panel-row" onClick={() => onSelect(other.id)}>
        <span className="panel-row-text">{plainText(other.prompt || other.excerpt, 220)}</span>
      </button>
      {link.reason && <p className="t-note">{link.reason}</p>}
    </li>
  );
}
