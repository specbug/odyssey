import React, { useEffect, useRef, useState } from 'react';
import { countCloze, hasCloze } from '../utils/cloze';
import apiService from '../api';

// Inline capture drawer — cloze / recall / note modes. Reused in:
//   - PdfScreen's right rail (variant="rail") for highlights on a page
//   - NotesScreen as a standalone modal (variant="modal") for file_id=null notes
//
// Props:
//   initial   - {type, prompt, answer, tags, excerpt}  (edit mode) or null
//   seedText  - text to seed into prompt (new cloze from a highlight)
//   onSave    - ({type, prompt, answer, tags}) => void
//   onCancel  - () => void
//   onDelete  - () => void  (optional; shown in edit mode only)
//   variant   - 'rail' | 'modal'  (layout wrapper style)
//   title     - the card label, e.g. "New note"
export default function InlineCaptureDrawer({
  initial = null,
  seedText = '',
  onSave,
  onCancel,
  onDelete,
  variant = 'rail',
  style = {},
  title = null,
}) {
  const isEdit = !!initial;
  const [mode, setMode] = useState(initial?.type || (hasCloze(seedText) ? 'cloze' : 'recall'));
  const [prompt, setPrompt] = useState(initial?.prompt ?? seedText ?? '');
  const [answer, setAnswer] = useState(initial?.answer || '');
  const [tags, setTags] = useState(Array.isArray(initial?.tags) ? initial.tags : (initial?.tag ? initial.tag.split(',').map(t=>t.trim()).filter(Boolean) : []));
  const [tagInput, setTagInput] = useState('');
  const promptRef = useRef(null);

  useEffect(() => {
    setTimeout(() => promptRef.current?.focus(), 40);
  }, []);

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  // Paste images into the prompt or answer area — upload to /images then
  // insert an [image:UUID] marker at the cursor.
  const onPaste = (setter) => async (e) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        try {
          const { uuid } = await apiService.uploadImage(blob);
          setter((prev) => `${prev}\n[image:${uuid}]\n`);
        } catch (err) {
          console.error('image upload failed', err);
        }
        return;
      }
    }
  };

  const commit = () => {
    const tagStr = tags.map((t) => t.replace(/,/g, '-').trim()).filter(Boolean).join(',');
    onSave?.({ type: mode, prompt, answer, tags, tag: tagStr });
  };

  const addTag = () => {
    const raw = tagInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/,/g, '-').replace(/#/g, '');
    if (cleaned && !tags.includes(cleaned)) setTags([...tags, cleaned]);
    setTagInput('');
  };

  const blanks = countCloze(prompt);
  const modes = [['cloze', 'Cloze'], ['recall', 'Recall'], ['note', 'Note']];

  return (
    <>
      {variant === 'modal' && <div className="scrim" onClick={onCancel}/>}
      <div
        className={`card drawer drawer-${variant}`}
        data-type={mode}
        onKeyDown={onKey}
        style={style}
        role={variant === 'modal' ? 'dialog' : 'group'}
        aria-label={title || (isEdit ? 'Edit note' : 'New note')}
      >
        <div className="drawer-head">
          <span className="card-label">{title || (isEdit ? 'Edit note' : 'New note')}</span>
          <div className="tabs" role="group" aria-label="Type">
            {modes.map(([m, label]) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
        </div>

        {mode === 'cloze' && (
          <>
            <textarea
              ref={promptRef}
              className="field"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste(setPrompt)}
              aria-label="Passage"
              placeholder="Passage, with each answer in [[double brackets]]"
            />
            <p className="t-small ink-3 drawer-hint">
              {blanks === 0 ? 'No blanks.' : `${blanks} blank${blanks === 1 ? '' : 's'}, ${blanks} card${blanks === 1 ? '' : 's'}.`}
            </p>
          </>
        )}

        {mode === 'recall' && (
          <>
            <textarea
              ref={promptRef}
              className="field"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste(setPrompt)}
              aria-label="Question"
              placeholder="Question"
            />
            <textarea
              className="field drawer-answer"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPaste={onPaste(setAnswer)}
              aria-label="Answer"
              placeholder="Answer"
            />
          </>
        )}

        {mode === 'note' && (
          <textarea
            ref={promptRef}
            className="field"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={onPaste(setPrompt)}
            aria-label="Note"
            placeholder="Note"
          />
        )}

        <div className="drawer-tags">
          {tags.map((t) => (
            <button key={t} className="tag t-small" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
              {t} <span aria-hidden="true">×</span>
            </button>
          ))}
          <input
            className="tag-input t-small"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput) {
                e.stopPropagation();
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add tag"
            aria-label="Add tag"
          />
        </div>

        <div className="drawer-foot">
          {isEdit && onDelete && (
            <button className="btn ghost sm quiet" onClick={onDelete}>Delete</button>
          )}
          <span className="drawer-foot-end">
            <button className="btn ghost sm quiet" onClick={onCancel}>Cancel <span className="key">Esc</span></button>
            <button className="btn primary sm" onClick={commit}>Save <span className="key">⌘↵</span></button>
          </span>
        </div>
      </div>
    </>
  );
}
