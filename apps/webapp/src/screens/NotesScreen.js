import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiService from '../api';
import { toNote } from '../data/adapters';
import { renderRich } from '../utils/render';
import InlineCaptureDrawer from '../components/InlineCaptureDrawer';
import { Ic } from '../components/Icons';
import { failText, plural, TYPE_LABEL } from '../utils/format';
import { inkProps } from '../data/inks';

// Every note, as cards. Filter by source or tag, search by substring, and
// write standalone notes in the capture drawer.
export default function NotesScreen({ onOpenDoc, onStartReview, onOpenGraph }) {
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // null | {kind:'new'} | {kind:'edit', note}

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
      setError(failText('load notes', e));
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
      .map((f) => ({ id: f.id, title: f.display_name || f.original_filename, ink: f.ink, count: counts.get(String(f.id)) || 0 }))
      .filter((s) => s.count > 0)
      .concat(counts.get('standalone') ? [{ id: 'standalone', title: 'Standalone', count: counts.get('standalone') }] : []);
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
      const payload = draftToCreatePayload(draft);
      await apiService.createStandaloneAnnotation({
        ...payload,
        annotation_id: `note_${Date.now()}`,
      });
      setModal(null);
      await refresh();
    } catch (e) {
      setError(failText('save note', e));
    }
  };

  const handleEditNote = async (draft) => {
    if (!modal?.note) return;
    try {
      await apiService.updateAnnotation(modal.note.id, draftToUpdatePayload(draft));
      setModal(null);
      await refresh();
    } catch (e) {
      setError(failText('save note', e));
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteAnnotation(id);
      setModal(null);
      await refresh();
    } catch (e) {
      setError(failText('delete note', e));
    }
  };

  const beginReviewForFilter = () => {
    if (typeof filter === 'number' || /^\d+$/.test(String(filter))) {
      onStartReview(Number(filter));
    } else {
      onStartReview(null);
    }
  };

  const isSource = (id) => filter === id || filter === Number(id);
  const filterName = filter === 'all' ? null
    : filter === 'standalone' ? 'Standalone'
    : sources.find((x) => x.id === Number(filter))?.title || filter;

  return (
    <div className="scroll">
      <div className="notes">
        <aside className="notes-filter" aria-label="Filter">
          <button className="filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            <span>All notes</span><span className="t-small ink-3">{notes.length}</span>
          </button>
          {sources.map((x) => (
            <button
              key={x.id}
              className="filter"
              {...inkProps(x.ink)}
              aria-pressed={isSource(x.id)}
              onClick={() => setFilter(x.id === 'standalone' ? 'standalone' : Number(x.id))}
            >
              <span className="filter-name">{x.title}</span><span className="t-small ink-3">{x.count}</span>
            </button>
          ))}
          {tags.length > 0 && (
            <div className="filter-tags">
              {tags.map((t) => (
                <button key={t} className="filter-tag t-small" aria-pressed={filter === t} onClick={() => setFilter(t)}>{t}</button>
              ))}
            </div>
          )}
        </aside>

        <div className="notes-main">
          <header className="page-head">
            <h1 className="t-h">Notes</h1>
            <span className="page-head-end">
              {notes.length > 0 && (
                <button className="btn ghost quiet" onClick={beginReviewForFilter}>Review</button>
              )}
              <button className="btn" onClick={() => setModal({ kind: 'new' })}>New note</button>
            </span>
          </header>

          <label className="search">
            <Ic.Search/>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search notes"
            />
            {(q || filter !== 'all') && (
              <span className="t-small ink-3">{filtered.length} of {notes.length}</span>
            )}
          </label>

          <select
            className="field notes-filter-select"
            aria-label="Filter"
            value={String(filter)}
            onChange={(e) => {
              const v = e.target.value;
              setFilter(/^\d+$/.test(v) ? Number(v) : v);
            }}
          >
            <option value="all">All notes ({notes.length})</option>
            {sources.map((x) => <option key={x.id} value={String(x.id)}>{x.title} ({x.count})</option>)}
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {error && <div className="notice"><p>{error}</p>{!notes.length && <button className="btn sm" onClick={refresh}>Retry</button>}</div>}

          {!loading && !error && filtered.length === 0 && (
            <p className="empty">
              {notes.length === 0 ? 'No notes.' : <>No matching notes{filterName ? ` in ${filterName}` : ''}. <button className="btn ghost sm link" onClick={() => { setFilter('all'); setQ(''); }}>Clear filter</button></>}
            </p>
          )}

          <ul className="note-list">
            {filtered.map((n) => (
              <li key={n.id}>
                <NoteCard
                  note={n}
                  onOpen={() => (n.source ? onOpenDoc(n.source, n.id) : setModal({ kind: 'edit', note: n }))}
                  onEdit={() => setModal({ kind: 'edit', note: n })}
                  onOpenGraph={onOpenGraph ? () => onOpenGraph(n.id) : null}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {modal?.kind === 'new' && (
        <InlineCaptureDrawer
          variant="modal"
          title="New note"
          onSave={handleNewNote}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit' && modal.note && (
        <InlineCaptureDrawer
          variant="modal"
          title="Edit note"
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
    </div>
  );
}

// A note is something the person made and can act on, so it is a card: sheet,
// rule on three sides, a 2px edge in its document's ink, its type as a word.
// Clicking opens it where it lives: its page in the PDF, or the drawer for a
// standalone note.
function NoteCard({ note, onOpen, onEdit, onOpenGraph }) {
  const where = note.sourceTitle
    ? `${note.sourceTitle}${note.page ? ` · p.\u00a0${note.page}` : ''}`
    : 'Standalone';
  return (
    <article className="card note-card hoverable" {...inkProps(note.ink)}>
      <div className="note-card-head">
        <span className="t-small note-card-where">
          <span className="card-type">{TYPE_LABEL[note.type] || 'Note'}</span>
          <span className="note-card-src">{where}</span>
        </span>
        {note.source != null && (
          <button className="btn ghost sm quiet note-card-edit" onClick={onEdit}>Edit</button>
        )}
      </div>
      <button className="note-card-body" onClick={onOpen}>
        <div className="note-card-prompt">
          {renderRich(note.prompt || note.excerpt, { cloze: note.type === 'cloze' ? 'inline' : 'none' })}
        </div>
        {note.type === 'recall' && note.answer && (
          <div className="t-note note-card-answer">{renderRich(note.answer)}</div>
        )}
      </button>
      {(note.tags?.length > 0 || (note.linkCount > 0 && onOpenGraph)) && (
        <div className="note-card-foot">
          {note.linkCount > 0 && onOpenGraph && (
            <button className="btn ghost sm link" onClick={onOpenGraph}>{plural(note.linkCount, 'link')}</button>
          )}
          {note.tags?.length > 0 && <span className="t-small ink-3">{note.tags.join(', ')}</span>}
        </div>
      )}
    </article>
  );
}

// Used for POST /annotations (standalone create). `null` anchor fields are
// the correct semantic here — standalone notes have no PDF anchor — and the
// backend coerces them to sensible empty values on insert.
function draftToCreatePayload(draft) {
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

// Used for PUT /annotations/{id}. Only includes the three user-editable
// fields: the modal has no control over PDF anchor data, so we must never
// transmit those keys. Backend uses `exclude_unset=True` to leave any
// omitted field untouched — which is exactly what preserves the existing
// highlight anchor / page index for PDF-linked notes.
//
// `question` is only emitted when the draft has a non-empty trimmed prompt,
// so accidentally Save-ing with an empty textarea doesn't clobber the
// stored prompt. `answer` / `tag` empty strings are meaningful ("clear").
function draftToUpdatePayload(draft) {
  const payload = {
    answer: draft.answer || '',
    tag: draft.tag || '',
  };
  if (draft.prompt && draft.prompt.trim().length > 0) {
    payload.question = draft.prompt;
  }
  return payload;
}
