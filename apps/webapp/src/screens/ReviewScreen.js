import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../api';
import { toQueueCard } from '../data/adapters';
import { extractAnswers, hasCloze } from '../utils/cloze';
import { renderRich } from '../utils/render';
import Starburst from '../components/Starburst';
import { Ic } from '../components/Icons';

// The ritual. Centered prompt, starburst progress on the left, reveal on SPACE,
// grade 1–4. Cloze prompts reveal all [[x]] blanks together.
export default function ReviewScreen({ fileId, onExit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState([]);
  const [leaving, setLeaving] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [doc, setDoc] = useState(null);
  const cardStartRef = useRef(Date.now());
  const endedRef = useRef(false);

  // Load session + queue
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [session, due, files] = await Promise.all([
          apiService.startSession().catch(() => null),
          apiService.getDueCards(fileId ?? null, 100),
          apiService.getFiles().catch(() => []),
        ]);
        if (!alive) return;
        const cards = [...(due.due_cards || []), ...(due.learning_cards || []), ...(due.new_cards || [])]
          .map(toQueueCard)
          .filter(Boolean);
        setQueue(cards);
        setAnswered(Array(cards.length).fill(null));
        if (session?.id) setSessionId(session.id);
        if (fileId != null) {
          const f = files.find((x) => x.id === fileId);
          if (f) setDoc(f);
        }
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fileId]);

  const total = queue.length;
  const card = queue[idx];
  const done = total === 0 || (idx >= total - 1 && answered[total - 1] != null);

  // End session once on DoneView
  useEffect(() => {
    if (done && sessionId && !endedRef.current) {
      endedRef.current = true;
      apiService.endSession(sessionId).catch((e) => console.warn('endSession failed', e));
    }
  }, [done, sessionId]);

  const grade = useCallback(async (rating) => {
    if (!card || leaving) return;
    if (!revealed) { setRevealed(true); return; }
    const rnum = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
    if (!rnum) return;
    setLeaving(true);
    const timeTaken = Math.round((Date.now() - cardStartRef.current) / 1000);
    try {
      await apiService.reviewCard(card.id, { rating: rnum, time_taken: timeTaken, session_id: sessionId });
    } catch (e) {
      console.warn('review submit failed', e);
    }
    setTimeout(() => {
      const next = [...answered];
      next[idx] = rating;
      setAnswered(next);
      if (idx < total - 1) {
        setIdx(idx + 1);
        setRevealed(false);
        cardStartRef.current = Date.now();
      }
      setLeaving(false);
    }, 320);
  }, [card, leaving, revealed, idx, total, answered, sessionId]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (revealed) {
        if (e.key === '1') grade('again');
        if (e.key === '2') grade('hard');
        if (e.key === '3') grade('good');
        if (e.key === '4') grade('easy');
      }
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, grade, onExit]);

  // Progress starburst prompts
  const progressPrompts = useMemo(() => queue.map((c, i) => ({
    days: c.interval || c.stability || 7,
    state: i < idx ? 'review' : i === idx ? 'learning' : 'new',
    completed: answered[i] != null,
    heavy: i === idx,
  })), [queue, idx, answered]);

  const tickAngle = total > 0 ? (idx / total) * 360 * 0.92 : 0;

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 16 }}>SESSION ERROR</div>
          <div style={{ color: 'var(--ink-2)', marginBottom: 24 }}>{error}</div>
          <button className="btn" onClick={onExit}>Return home</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-4)' }}>Loading session…</div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="enter" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 24 }}>
            <Starburst
              prompts={Array.from({ length: 12 }, () => ({ days: 14, state: 'review' }))}
              size={160}
              innerRadius={8}
              color="var(--ink-3)"
            />
          </div>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Nothing due right now.
          </h1>
          <p style={{ color: 'var(--ink-2)', marginBottom: 28 }}>
            The queue will return when new cards are ready.
          </p>
          <button className="btn primary" onClick={onExit}>Return home <Ic.Right/></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <button className="btn ghost xs" onClick={onExit}>
          <Ic.Close/> End session
        </button>
        <div className="mono-sm" style={{ color: 'var(--ink-4)' }}>
          {doc ? `${(doc.display_name || doc.original_filename || '').toUpperCase()} · ` : ''}
          SESSION · {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
        <div className="mono-sm" style={{ color: 'var(--ink-4)' }}>
          {Math.max(1, Math.ceil((total - idx) * 0.4))} MIN REMAINING
        </div>
      </div>

      {done ? (
        <DoneView answered={answered} queue={queue} onExit={onExit}/>
      ) : (
        <>
          <div style={{ position: 'absolute', left: 48, top: '50%', transform: 'translateY(-50%)', opacity: 0.95 }}>
            <Starburst
              prompts={progressPrompts}
              size={200}
              innerRadius={10}
              thickness={1.4}
              color="var(--ink-3)"
              accentColor="var(--accent)"
              tickAngle={tickAngle}
            />
          </div>

          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '0 24px' }}>
            <div style={{
              width: 640,
              maxWidth: '90vw',
              opacity: leaving ? 0 : 1,
              transform: leaving ? 'translateY(-20px)' : 'translateY(0)',
              transition: 'opacity 280ms cubic-bezier(.2,.7,.2,1), transform 280ms cubic-bezier(.2,.7,.2,1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: doc?.color_hue != null ? `oklch(58% 0.16 ${doc.color_hue})` : 'var(--ink-4)' }}/>
                <div className="mono-sm" style={{ color: 'var(--ink-3)' }}>
                  {(card?.raw?.annotation?.file_title || doc?.original_filename || 'NOTE').toUpperCase()}
                </div>
              </div>

              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 26,
                  lineHeight: 1.45,
                  color: 'var(--ink)',
                  fontWeight: 400,
                  letterSpacing: '-0.005em',
                  minHeight: 140,
                }}
              >
                {renderRich(card?.prompt || '', {
                  cloze: (card?.type === 'cloze' || hasCloze(card?.prompt || '')) ? 'reveal' : 'none',
                  revealed,
                })}
              </div>

              <div style={{
                marginTop: 36,
                paddingTop: 28,
                borderTop: '1px solid var(--rule)',
                opacity: revealed ? 1 : 0,
                maxHeight: revealed ? 400 : 0,
                overflow: 'hidden',
                transition: 'opacity 420ms cubic-bezier(.2,.7,.2,1) 120ms, max-height 420ms cubic-bezier(.2,.7,.2,1)',
              }}>
                {card?.type === 'cloze' || hasCloze(card?.prompt || '') ? (
                  <div className="mono" style={{ color: 'var(--accent-deep)', fontSize: 14 }}>
                    — {extractAnswers(card?.prompt || '').join(' · ') || '—'}
                  </div>
                ) : (
                  <div
                    style={{ fontFamily: 'var(--sans)', fontSize: 17, lineHeight: 1.65, color: 'var(--ink-2)' }}
                  >
                    {renderRich(card?.answer || '')}
                  </div>
                )}

                <div style={{ marginTop: 28, display: 'flex', gap: 0, border: '1px solid var(--rule)' }}>
                  {['again', 'hard', 'good', 'easy'].map((g, i) => (
                    <button
                      key={g}
                      onClick={() => grade(g)}
                      style={{
                        flex: 1,
                        padding: '16px 12px',
                        border: 0,
                        background: 'transparent',
                        borderRight: i < 3 ? '1px solid var(--rule)' : 'none',
                        fontFamily: 'var(--sans)',
                        cursor: 'pointer',
                        transition: 'background 200ms',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: g === 'again' ? 'var(--accent)' : 'var(--ink)' }}>{g}</span>
                        <span className="mono-sm" style={{ color: 'var(--ink-4)' }}>{i + 1}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {card?.nextIntervals?.[i] ?? 1}d
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {!revealed && (
                <div style={{ marginTop: 64, display: 'flex', justifyContent: 'center' }}>
                  <button className="btn" onClick={() => setRevealed(true)} style={{ padding: '11px 22px', fontSize: 13 }}>
                    <Ic.Eye/> Reveal answer
                    <span className="mono-sm" style={{ color: 'var(--ink-4)', marginLeft: 6 }}>SPACE</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '20px 48px', display: 'flex', justifyContent: 'space-between', color: 'var(--ink-4)' }}>
            <div className="mono-sm">INTERVAL — {card?.interval || 0}d · STABILITY {card?.stability || 0}d</div>
            <div className="mono-sm">{(card?.type || 'note').toUpperCase()}</div>
          </div>
        </>
      )}
    </div>
  );
}

function DoneView({ answered, queue, onExit }) {
  const counts = {
    again: answered.filter((a) => a === 'again').length,
    hard: answered.filter((a) => a === 'hard').length,
    good: answered.filter((a) => a === 'good').length,
    easy: answered.filter((a) => a === 'easy').length,
  };
  const total = answered.length;
  const finalPrompts = answered.map((a, i) => {
    const rIdx = ['again', 'hard', 'good', 'easy'].indexOf(a);
    const q = queue[i];
    return {
      days: (q?.nextIntervals?.[rIdx] ?? 7) || 7,
      state: 'review',
      completed: true,
      heavy: a === 'good' || a === 'easy',
    };
  });

  return (
    <div className="enter" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 32 }}>
          <Starburst
            prompts={finalPrompts.length ? finalPrompts : [{ days: 7, state: 'review', completed: true }]}
            size={240}
            innerRadius={14}
            thickness={2.2}
            color="var(--ink)"
            accentColor="var(--accent)"
            className="sb-glow"
          />
        </div>
        <h1 style={{ fontFamily: 'var(--sans)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 14 }}>
          Session complete.
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.55, marginBottom: 36 }}>
          {total} prompt{total === 1 ? '' : 's'} revisited.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid var(--rule)', marginBottom: 36, textAlign: 'left' }}>
          {Object.entries(counts).map(([k, v], i) => (
            <div key={k} style={{ padding: '16px 20px', borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}>
              <div className="mono-sm" style={{ color: k === 'again' ? 'var(--accent)' : 'var(--ink-4)', marginBottom: 4 }}>
                {k.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 300 }}>{v}</div>
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={onExit} style={{ padding: '11px 22px', fontSize: 14 }}>
          Return home <Ic.Right/>
        </button>
      </div>
    </div>
  );
}
