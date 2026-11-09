import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../api';
import { toQueueCard } from '../data/adapters';
import { inkProps } from '../data/inks';
import { hasCloze } from '../utils/cloze';
import { renderRich } from '../utils/render';
import { failText, fmtInterval, plainText, plural, RELATION_LABEL } from '../utils/format';
import Comb from '../components/Comb';

const GRADES = [['again', 'Again'], ['hard', 'Hard'], ['good', 'Good'], ['easy', 'Easy']];

// Review. Centred prompt, the Comb in the left margin, Space reveals, 1–4
// grade. A cloze card hides only its own blank; the others show their
// answers. `O` opens the source page in the PDF when the card has one.
export default function ReviewScreen({ fileId, onExit, onJumpToSource }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState([]);
  // New interval (days) per graded card, from the API's response.
  const [nextDays, setNextDays] = useState([]);
  const [leaving, setLeaving] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [doc, setDoc] = useState(null);
  // file id → title, for each card's source line; file id → ink, for its field.
  const [titles, setTitles] = useState({});
  const [inks, setInks] = useState({});
  const cardStartRef = useRef(Date.now());
  const endedRef = useRef(false);
  // annotation id → linked notes, fetched as each card comes up and shown
  // only after reveal (a neighbour can contain the answer).
  const [linked, setLinked] = useState({});
  // Phone layout draws the Comb across the top; it needs the width.
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
        setNextDays(Array(cards.length).fill(null));
        if (session?.id) setSessionId(session.id);
        setTitles(Object.fromEntries((files || []).map((f) => [f.id, f.display_name || f.original_filename])));
        setInks(Object.fromEntries((files || []).map((f) => [f.id, f.ink])));
        if (fileId != null) {
          const f = files.find((x) => x.id === fileId);
          if (f) setDoc(f);
        }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fileId]);

  const total = queue.length;
  const card = queue[idx];
  const done = total === 0 || (idx >= total - 1 && answered[total - 1] != null);

  // A card can jump to its source only when it has both a file and a page —
  // standalone notes have neither. The raw annotation sits on `card.raw` via
  // the adapter (see data/adapters.js:toQueueCard).
  const annPageIndex = card?.raw?.annotation?.page_index;
  const canJump = card != null
    && card.source != null
    && annPageIndex != null
    && typeof onJumpToSource === 'function';

  // Jump to the source PDF page + briefly pulse the landing highlight. Ends
  // the review session explicitly (idempotent via endedRef) so the backend
  // doesn't leave an open session behind when the ReviewScreen unmounts.
  const handleJump = useCallback(() => {
    if (!canJump || leaving) return;
    if (sessionId && !endedRef.current) {
      endedRef.current = true;
      apiService.endSession(sessionId).catch(() => {});
    }
    onJumpToSource(card.source, card.annotationId);
  }, [canJump, leaving, sessionId, onJumpToSource, card]);

  const annotationId = card?.annotationId;
  useEffect(() => {
    if (annotationId == null || linked[annotationId] !== undefined) return;
    let alive = true;
    apiService.getAnnotationLinks(annotationId)
      .then((rows) => { if (alive) setLinked((m) => ({ ...m, [annotationId]: rows })); })
      .catch(() => { if (alive) setLinked((m) => ({ ...m, [annotationId]: [] })); });
    return () => { alive = false; };
  }, [annotationId, linked]);
  const connections = (annotationId != null && linked[annotationId]) || [];

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
    let days = card.nextIntervals?.[rnum - 1] ?? null;
    try {
      const res = await apiService.reviewCard(card.id, { rating: rnum, time_taken: timeTaken, session_id: sessionId });
      if (Number.isFinite(res?.card?.scheduled_days)) days = res.card.scheduled_days;
    } catch (e) {
      console.warn('review submit failed', e);
    }
    const at = idx;
    setNextDays((nd) => { const out = [...nd]; out[at] = days; return out; });
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
      // Respect form controls if any ever mount on this screen — today there
      // are none, but keep the guard so new surfaces don't steal typed keys.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // `O` → jump to source (pre-reveal OR post-reveal, for power users).
      // `e.code` fallback guards against non-US keyboard layouts where the
      // lowercase/uppercase `O` produced by `e.key` can vary.
      if (e.key === 'o' || e.key === 'O' || e.code === 'KeyO') {
        if (canJump) {
          e.preventDefault();
          handleJump();
        }
        return;
      }
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
  }, [revealed, grade, onExit, canJump, handleJump]);

  const combItems = useMemo(
    () => queue.map((c, i) => ({ id: c.id, days: c.interval, next: answered[i] != null ? nextDays[i] : null })),
    [queue, answered, nextDays],
  );

  if (error) {
    return (
      <div className="review review-message">
        <p className="t-body">{failText('load cards', error)}</p>
        <button className="btn" onClick={onExit}>Home <span className="key">Esc</span></button>
      </div>
    );
  }

  if (loading) return <div className="review"/>;

  if (total === 0) {
    return (
      <div className="review review-message">
        <p className="t-body">No cards due.</p>
        <button className="btn" onClick={onExit}>Home <span className="key">Esc</span></button>
      </div>
    );
  }

  if (done) {
    const reviewed = answered.filter(Boolean).length;
    return (
      <div className="review review-done">
        <div className="review-done-body">
          <h1 className="t-display review-done-count">{plural(reviewed, 'card')} reviewed.</h1>
          <Comb items={combItems} index={total} length={320} span={Math.min(320, total * 14)}/>
          <button className="btn primary" onClick={onExit}>Home <span className="key">Esc</span></button>
        </div>
      </div>
    );
  }

  const isCloze = card?.type === 'cloze' || hasCloze(card?.prompt || '');
  const ann = card?.raw?.annotation;
  const sourceTitle = ann?.file_title || titles[card?.source] || doc?.display_name || doc?.original_filename;
  const readout = `${idx + 1} of ${total}`;
  // The screen takes the card's document ink: a field in light mode, marks
  // on a tinted ground in dark (screens.css). A note without a document
  // stays on paper.
  const ink = card?.source != null ? (inks[card.source] ?? doc?.ink) : null;

  return (
    <div className="review" {...inkProps(ink)}>
      <button className="btn ghost quiet review-exit" onClick={onExit}>
        End session <span className="key">Esc</span>
      </button>

      <aside className="review-margin">
        <Comb items={combItems} index={idx} readout={readout}/>
      </aside>
      <div className="review-strip">
        <Comb items={combItems} index={idx} orientation="h" length={32} span={Math.max(0, Math.min(vw, 640) - 48)} readout={readout} labels={false}/>
      </div>

      <main className={`review-stage${revealed ? ' revealed' : ''}${leaving ? ' leaving' : ''}`}>
        <div className="t-small ink-3 review-source">
          {sourceTitle ? <>{sourceTitle}{annPageIndex != null && <>{' · '}p.{'\u00a0'}{annPageIndex + 1}</>}</> : 'Note'}
        </div>

        <div className="review-prompt">
          {renderRich(card?.prompt || '', {
            cloze: isCloze ? 'reveal' : 'none',
            revealed,
            activeIndex: card?.clozeIndex ?? 0,
          })}
        </div>

        {!revealed ? (
          <button className="btn review-reveal" onClick={() => setRevealed(true)}>
            Reveal <span className="key">Space</span>
          </button>
        ) : (
          <div className="review-after">
            {!isCloze && card?.answer && (
              <div className="review-answer t-body">{renderRich(card.answer)}</div>
            )}

            <div className="grades" role="group" aria-label="Grade">
              {GRADES.map(([g, label], i) => (
                <button key={g} className="grade" onClick={() => grade(g)} disabled={leaving}>
                  <span className="grade-head">
                    <span className="grade-label">{label}</span>
                    <span className="key">{i + 1}</span>
                  </span>
                  <span className="t-small lg c-data">{fmtInterval(card?.nextIntervals?.[i])}</span>
                </button>
              ))}
            </div>

            {canJump && (
              <div className="review-source-link">
                <button className="btn ghost sm link" onClick={handleJump}>
                  Open p.{'\u00a0'}{annPageIndex + 1} <span className="key">O</span>
                </button>
              </div>
            )}

            {connections.length > 0 && <Linked rows={connections}/>}
          </div>
        )}
      </main>
    </div>
  );
}

// The card's neighbours in the note graph, after reveal. Blanks stay masked:
// a neighbour may come up later in the same session.
function Linked({ rows }) {
  return (
    <section className="review-linked">
      <h2 className="t-small ink-2">Linked</h2>
      <ul>
        {rows.slice(0, 3).map(({ link, note }) => (
          <li key={link.id}>
            <p className="review-linked-text">
              {renderRich(escapeHtml(plainText(note.question || note.highlighted_text || '', 220, { keepCloze: true })), { cloze: 'mask' })}
            </p>
            <p className="t-small ink-3">
              {RELATION_LABEL[link.relation] || 'Linked'}
              {note.file_title ? ` · ${note.file_title}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
