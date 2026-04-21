import React, { useEffect, useMemo, useState } from 'react';
import apiService from '../api';
import { toLibraryDoc, toQueueCard, toStats, queueToStarburstPrompts } from '../data/adapters';
import Starburst from '../components/Starburst';
import DocGlyph from '../components/DocGlyph';
import Metric from '../components/Metric';
import { Ic } from '../components/Icons';

// Ritual Home — time-of-day greeting, hero starburst for today's queue,
// reading strip, memory tiles. All data is fetched once on mount.
export default function HomeScreen({ onNav, onOpenDoc, onStartReview }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fs, due, ds] = await Promise.all([
          apiService.getFiles(),
          apiService.getDueCards(null, 50),
          apiService.getDashboardStats(),
        ]);
        if (!alive) return;
        setFiles(fs.map(toLibraryDoc).filter(Boolean));
        // Queue order: due cards first, then learning, then new.
        const cards = [...(due.due_cards || []), ...(due.learning_cards || []), ...(due.new_cards || [])];
        setQueue(cards.map(toQueueCard).filter(Boolean));
        setStats(ds);
      } catch (e) {
        console.error(e);
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const now = new Date();
  const hr = now.getHours();
  const timeLabel = hr < 5 ? 'Night' : hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : hr < 21 ? 'Evening' : 'Night';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const ritualPrompts = useMemo(() => queueToStarburstPrompts(queue, 0), [queue]);
  const view = toStats(stats);
  const dueTotal = queue.length;
  const reading = files.filter((d) => d.read > 0 && d.read < d.pages).slice(0, 3);

  if (error) {
    return (
      <div className="scroll" style={{ padding: '48px 64px' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-3)' }}>Couldn't reach the archive.</div>
        <div style={{ marginTop: 12, color: 'var(--ink-2)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ padding: '48px 64px 96px' }}>
      <div className="enter" style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 56,
          padding: '40px 0 56px',
          borderBottom: '1px solid var(--rule)',
          alignItems: 'center',
        }}>
          <div>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 16 }}>
              {timeLabel.toUpperCase()} — {dateLabel}
            </div>
            {dueTotal > 0 ? (
              <>
                <h1 style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.02, marginBottom: 20 }}>
                  Today, {dueTotal} prompt{dueTotal === 1 ? '' : 's'}
                  <br/>
                  <span style={{ color: 'var(--ink-3)' }}>return for review.</span>
                </h1>
                <p style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 480, marginBottom: 28, lineHeight: 1.55 }}>
                  A quiet session — a handful of passages you've wanted to live with. Each answer carries them a little further along.
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn primary" onClick={() => onStartReview(null)} style={{ padding: '11px 22px', fontSize: 14 }}>
                    Begin session <Ic.Right/>
                  </button>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginLeft: 8 }}>
                    ~ {Math.max(1, Math.ceil(dueTotal * 0.4))} min
                    {view.retained !== '—' && ` · avg retention ${view.retained}`}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.02, marginBottom: 20 }}>
                  Nothing due today.
                  <br/>
                  <span style={{ color: 'var(--ink-3)' }}>The queue will return.</span>
                </h1>
                <p style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 480, marginBottom: 28, lineHeight: 1.55 }}>
                  Keep reading — new highlights will surface here when they're ready.
                </p>
                <button className="btn" onClick={() => onNav('library')} style={{ padding: '11px 22px', fontSize: 14 }}>
                  Open library <Ic.Right/>
                </button>
              </>
            )}
          </div>

          <div style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 300, height: 300, justifySelf: 'end' }}>
            <Starburst
              prompts={ritualPrompts.length ? ritualPrompts : [{ days: 3, state: 'new' }, { days: 7, state: 'new' }, { days: 14, state: 'new' }, { days: 30, state: 'new' }]}
              size={300} innerRadius={22} maxLength={0.92} thickness={1.6}
              color="var(--ink)"
            />
            <div className="mono-sm" style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', color: 'var(--ink-4)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
              {dueTotal} DUE · {queue.filter((c) => c.state === 'Learning' || c.state === 'Relearning').length} LEARNING · {queue.filter((c) => c.state === 'Review').length} REVIEW
            </div>
          </div>
        </div>

        {/* Reading */}
        <section style={{ padding: '48px 0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Reading
            </h2>
            <button className="btn ghost xs" onClick={() => onNav('library')}>
              All documents — {files.length} <Ic.Right/>
            </button>
          </div>
          {reading.length === 0 ? (
            <div style={{ padding: 24, border: '1px solid var(--rule)', color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontStyle: 'italic', textAlign: 'center' }}>
              {files.length === 0
                ? 'No documents yet. Start your library.'
                : 'Nothing in flight — open a document to begin.'}
            </div>
          ) : (
            <div
              className="enter-stagger"
              style={{
                display: 'grid',
                // Match columns to what we actually have so empty grid cells
                // don't show the rule backdrop as a gray slab.
                gridTemplateColumns: `repeat(${Math.min(3, reading.length)}, minmax(0, 1fr))`,
                gap: 1,
                // Backdrop creates the 1px column dividers via gap — only useful
                // when there's more than one card to separate.
                background: reading.length > 1 ? 'var(--rule)' : 'transparent',
                border: '1px solid var(--rule)',
              }}
            >
              {reading.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onOpenDoc(doc.id)}
                  style={{ padding: 24, background: 'var(--paper)', border: 0, textAlign: 'left', cursor: 'pointer', transition: 'background 220ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--paper)'; }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                    <DocGlyph doc={doc} size={48}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{doc.authors}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginBottom: 6 }}>
                    <span>p. {doc.read} / {doc.pages || '—'}</span>
                    <span>{doc.pages ? Math.round((doc.read / doc.pages) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: 2, background: 'var(--rule)', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: doc.pages ? `${(doc.read / doc.pages) * 100}%` : '0%', background: 'var(--ink)' }}/>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Memory */}
        <section style={{ padding: '24px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Memory
            </h2>
            <span className="mono" style={{ color: 'var(--ink-3)' }}>
              {view.cardsInLog} cards in the log
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, border: '1px solid var(--rule)' }}>
            <Metric label="RETAINED" value={view.retained} sub="14-day rolling"/>
            <Metric label="STABILITY" value={view.stability} sub="average interval"/>
            <Metric label="SESSIONS" value={view.sessions} sub="this quarter"/>
            <Metric label="STREAK" value={view.streak} sub="consecutive days"/>
          </div>
        </section>

        {loading && (
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 32, textAlign: 'center' }}>
            …
          </div>
        )}
      </div>
    </div>
  );
}
