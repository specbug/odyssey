import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../api';
import { toLibraryDoc, toQueueCard } from '../data/adapters';
import Spiral from '../components/Spiral';
import Mark from '../components/Mark';
import { failText, plainText, plural } from '../utils/format';

// Home: what is due, what you are partway through, and today's queue drawn
// on the time spiral. R starts the review.
export default function HomeScreen({ onOpenDoc, onStartReview }) {
  const [state, setState] = useState({ loading: true, error: null, files: [], queue: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fs, due] = await Promise.all([apiService.getFiles(), apiService.getDueCards(null, 100)]);
        if (!alive) return;
        const cards = [...(due.due_cards || []), ...(due.learning_cards || []), ...(due.new_cards || [])];
        setState({ loading: false, error: null, files: fs.map(toLibraryDoc).filter(Boolean), queue: cards.map(toQueueCard).filter(Boolean) });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, loading: false, error: e }));
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  const { loading, error, files, queue } = state;
  const due = queue.length;
  const start = useCallback(() => onStartReview(null), [onStartReview]);

  useEffect(() => {
    if (!due) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [due, start]);

  if (error) {
    return (
      <div className="scroll">
        <div className="home">
          <p className="t-body">{failText('load cards', error)}</p>
          <button className="btn" style={{ marginTop: 24 }} onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </div>
      </div>
    );
  }
  if (loading) return <div className="scroll"/>;

  const reading = files
    .filter((d) => d.read > 0 && d.pages && d.read < d.pages - 1) // read is 0-based; last page = done
    .sort((a, b) => (b.raw?.last_accessed || '').localeCompare(a.raw?.last_accessed || ''))
    .slice(0, 4);

  return (
    <div className="scroll">
      <div className="home">
        <section className="home-due">
          <div>
            <h1 className="t-display home-count">{due ? `${plural(due, 'card')} due` : 'No cards due'}</h1>
            {due > 0 && (
              <button className="btn primary home-review" onClick={start}>
                Review <span className="key">R</span>
              </button>
            )}
          </div>
          {due > 0 ? (
            <Spiral items={queue.map((c) => ({ id: c.id, days: c.interval, label: plainText(c.prompt, 64) }))}/>
          ) : (
            // Nothing to draw on the spiral: the mark holds its place, so the
            // page keeps its shape between a due day and a quiet one.
            <div className="home-mark" aria-hidden="true"><Mark size={176}/></div>
          )}
        </section>

        {reading.length > 0 && (
          <section className="home-reading">
            <h2 className="t-h">Reading</h2>
            <ul className="rows">
              {reading.map((d) => (
                <li key={d.id}>
                  <button className="row" onClick={() => onOpenDoc(d.id)}>
                    <span className="row-main">
                      <span className="row-title">{d.title}</span>
                      {d.authors && <span className="t-small ink-2">{d.authors}</span>}
                    </span>
                    <span className="t-small ink-2 row-end">p.{'\u00a0'}{Math.min(d.read + 1, d.pages)} of {d.pages}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {files.length === 0 && (
          <p className="t-note home-empty">No documents.</p>
        )}
      </div>
    </div>
  );
}
