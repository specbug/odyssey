import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiService from '../api';
import { toNote } from '../data/adapters';
import { renderClozeInline } from '../utils/cloze';
import Starburst from '../components/Starburst';
import InlineCaptureDrawer from '../components/InlineCaptureDrawer';
import { Ic } from '../components/Icons';

// All-notes browser. Filter by source or tag, search by substring, create
// standalone notes via the inline capture drawer as a modal.
export default function NotesScreen({ onOpenDoc, onStartReview }) {
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // null | {kind:'new'} | {kind:'edit', note}
  const [menuId, setMenuId] = useState(null); // id of note with open row menu

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [anns, fs] = await Promise.all([
        apiService.getAllAnnotations(),
        apiService.getFiles(),
      ]);
      setNotes(anns.map(toNote).filter(Boolean));
      setFiles(fs);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const tags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [notes]);

  const sources = useMemo(() => {
    const counts = new Map();
    notes.forEach((n) => {
      const key = n.source == null ? 'standalone' : String(n.source);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return files
      .map((f) => ({ id: f.id, title: f.display_name || f.original_filename, hue: f.color_hue, count: counts.get(String(f.id)) || 0 }))
      .filter((s) => s.count > 0)
      .concat(counts.get('standalone') ? [{ id: 'standalone', title: 'Standalone', hue: null, count: counts.get('standalone') }] : []);
  }, [files, notes]);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (q) {
        const hay = (`${n.excerpt} ${n.prompt} ${n.answer}`).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (filter === 'all') return true;
      if (filter === 'standalone') return n.source == null;
      if (typeof filter === 'number' || /^\d+$/.test(String(filter))) return n.source === Number(filter);
      // tag filter
      return (n.tags || []).includes(filter);
    });
  }, [notes, q, filter]);

  const handleNewNote = async (draft) => {
    try {
      const payload = draftToPayload(draft);
      await apiService.createStandaloneAnnotation({
        ...payload,
        annotation_id: `note_${Date.now()}`,
      });
      setModal(null);
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const handleEditNote = async (draft) => {
    if (!modal?.note) return;
    try {
      await apiService.updateAnnotation(modal.note.id, draftToPayload(draft));
      setModal(null);
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteAnnotation(id);
      setMenuId(null);
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const beginReviewForFilter = () => {
    if (typeof filter === 'number' || /^\d+$/.test(String(filter))) {
      onStartReview(Number(filter));
    } else {
      onStartReview(null);
    }
  };

  if (error && !notes.length) {
    return (
      <div className="scroll" style={{ padding: '48px 64px' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-3)' }}>Couldn't reach the archive.</div>
        <div style={{ marginTop: 12, color: 'var(--ink-2)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ padding: '48px 0 96px', display: 'grid', gridTemplateColumns: '260px 1fr' }}>
      {/* Sidebar filter */}
      <aside style={{ padding: '8px 24px 0 64px', position: 'sticky', top: 0 }}>
        <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 14 }}>FILTER</div>
        <button onClick={() => setFilter('all')} style={filterBtn(filter === 'all')}>
          All notes <span className="mono" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>{notes.length}</span>
        </button>

        {sources.length > 0 && (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 24, marginBottom: 10 }}>BY SOURCE</div>
            {sources.map((s) => (
              <button key={s.id} onClick={() => setFilter(s.id === 'standalone' ? 'standalone' : Number(s.id))} style={filterBtn(filter === s.id || filter === Number(s.id))}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: s.hue != null ? `oklch(58% 0.15 ${s.hue})` : 'var(--ink-4)' }}/>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                </span>
                <span className="mono" style={{ color: 'var(--ink-4)' }}>{s.count}</span>
              </button>
            ))}
          </>
        )}

        {tags.length > 0 && (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 24, marginBottom: 10 }}>BY TAG</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className="mono"
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--rad)',
                    background: filter === t ? 'var(--ink)' : 'transparent',
                    color: filter === t ? 'var(--paper)' : 'var(--ink-2)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Main notes list */}
      <div style={{ padding: '0 64px 0 24px' }}>
        <header style={{ paddingBottom: 28, borderBottom: '1px solid var(--rule)' }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>
            NOTES · {filtered.length} OF {notes.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <h1 style={{ fontSize: 44, fontWeight: 400, letterSpacing: '-0.03em', flex: 1 }}>
              Everything you've marked.
            </h1>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {notes.length > 0 && (
                <button className="btn ghost xs" onClick={beginReviewForFilter}>
                  <Ic.Review/> Begin session
                </button>
              )}
              <button className="btn xs" onClick={() => setModal({ kind: 'new' })}>
                <Ic.Plus/> New note
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <Ic.Search color="var(--ink-3)"/>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search passages…"
              style={{ flex: 1, border: 0, background: 'transparent', fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--ink)', outline: 'none', padding: '6px 0' }}
            />
          </div>
        </header>

        {filtered.length === 0 ? (
          <div style={{ padding: '64px 24px', color: 'var(--ink-3)', textAlign: 'center', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
            {notes.length === 0
              ? "No notes yet. Start reading and mark a passage."
              : <>Nothing here for <em>{String(filter)}</em>. <button className="btn ghost xs" onClick={() => setFilter('all')}>reset filter</button></>}
          </div>
        ) : (
          <div className="enter-stagger">
            {filtered.map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                menuOpen={menuId === n.id}
                onMenuToggle={() => setMenuId(menuId === n.id ? null : n.id)}
                onEdit={() => { setMenuId(null); setModal({ kind: 'edit', note: n }); }}
                onDelete={() => handleDelete(n.id)}
                onOpen={() => (n.source ? onOpenDoc(n.source, n.id) : setModal({ kind: 'edit', note: n }))}
              />
            ))}
          </div>
        )}
      </div>

      {modal?.kind === 'new' && (
        <InlineCaptureDrawer
          variant="modal"
          title="NEW STANDALONE NOTE"
          onSave={handleNewNote}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit' && modal.note && (
        <InlineCaptureDrawer
          variant="modal"
          title={modal.note.source ? 'EDITING NOTE' : 'EDITING STANDALONE NOTE'}
          initial={{
            type: modal.note.type,
            prompt: modal.note.prompt,
            answer: modal.note.answer,
            tags: modal.note.tags,
          }}
          onSave={handleEditNote}
          onCancel={() => setModal(null)}
          onDelete={() => handleDelete(modal.note.id)}
        />
      )}

      {loading && (
        <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 32, textAlign: 'center' }}>
          …
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, onEdit, onDelete, onOpen, menuOpen, onMenuToggle }) {
  return (
    <article
      style={{
        padding: '28px 0',
        borderBottom: '1px solid var(--rule)',
        display: 'grid',
        gridTemplateColumns: '1fr 160px',
        gap: 32,
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'padding 220ms, background 220ms',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--paper-2)';
        e.currentTarget.style.paddingLeft = '12px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.paddingLeft = '0';
      }}
      onClick={onOpen}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: note.sourceHue != null ? `oklch(58% 0.15 ${note.sourceHue})` : 'var(--ink-4)' }}/>
          <span className="mono-sm" style={{ color: 'var(--ink-3)' }}>
            {note.sourceTitle ? `${note.sourceTitle.toUpperCase()} · p. ${note.page ?? '—'}` : 'STANDALONE'}
          </span>
          <span className="mono-sm" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em', padding: '1px 8px', border: '1px solid var(--rule)', borderRadius: 'var(--rad)', background: 'var(--paper)' }}>
            {(note.type || 'note').toUpperCase()}
          </span>
          <span className="mono-sm" style={{ color: 'var(--ink-4)', marginLeft: 'auto' }}>
            {note.date.toUpperCase()}
          </span>
          <button
            className="btn ghost xs"
            style={{ padding: '2px 6px' }}
            onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          >
            <Ic.Dots/>
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 42,
                right: 0,
                zIndex: 50,
                background: 'var(--paper)',
                border: '1px solid var(--rule-2)',
                borderRadius: 'var(--rad)',
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.16)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 120,
              }}
            >
              <button className="btn ghost xs" style={{ justifyContent: 'flex-start' }} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                Edit
              </button>
              <button className="btn ghost xs" style={{ justifyContent: 'flex-start', color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                Delete
              </button>
            </div>
          )}
        </div>

        {note.type === 'cloze' ? (
          <blockquote
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 17,
              lineHeight: 1.55,
              color: 'var(--ink)',
              borderLeft: '1px solid var(--ink-4)',
              paddingLeft: 20,
            }}
            dangerouslySetInnerHTML={{ __html: renderClozeInline(note.prompt || note.excerpt) }}
          />
        ) : note.type === 'recall' ? (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.08em' }}>Q.</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 17,
                lineHeight: 1.55,
                color: 'var(--ink)',
                marginBottom: 14,
                borderLeft: '1px solid var(--ink-4)',
                paddingLeft: 20,
              }}
              dangerouslySetInnerHTML={{ __html: note.prompt || note.excerpt }}
            />
            {note.answer && (
              <>
                <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.08em' }}>A.</div>
                <div
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    color: 'var(--ink-2)',
                    paddingLeft: 20,
                    borderLeft: '1px solid var(--rule)',
                  }}
                  dangerouslySetInnerHTML={{ __html: note.answer }}
                />
              </>
            )}
          </>
        ) : (
          <blockquote
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 17,
              lineHeight: 1.55,
              color: 'var(--ink)',
              borderLeft: '1px solid var(--ink-4)',
              paddingLeft: 20,
            }}
            dangerouslySetInnerHTML={{ __html: note.prompt || note.excerpt }}
          />
        )}

        {note.tags && note.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {note.tags.map((t) => (
              <span key={t} className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        <Starburst
          prompts={Array.from({ length: Math.min(12, Math.max(3, Math.ceil((note.stability || 4) / 4))) }, () => ({ days: note.stability || 4, state: 'review' }))}
          size={72}
          innerRadius={4}
          thickness={0.8}
          color="var(--ink-3)"
          maxLength={0.9}
        />
      </div>
    </article>
  );
}

function filterBtn(active) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    marginBottom: 2,
    border: 0,
    borderRadius: 'var(--rad)',
    background: active ? 'var(--paper-2)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-2)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function draftToPayload(draft) {
  return {
    question: draft.prompt || '',
    answer: draft.answer || '',
    highlighted_text: '',
    position_data: null,
    source: null,
    tag: draft.tag || '',
    deck: 'Default',
    page_index: null,
  };
}
