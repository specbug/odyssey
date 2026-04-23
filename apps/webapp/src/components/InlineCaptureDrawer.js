import React, { useEffect, useRef, useState } from 'react';
import { Ic } from './Icons';
import { hasCloze } from '../utils/cloze';
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
// All textareas use R Sans — authoring is structural UI, not a reading
// surface. Serif is reserved for the review ritual.
const drawerTextarea = (minH) => ({
  width: '100%',
  minHeight: minH,
  border: '1px solid var(--rule)',
  background: 'var(--paper-2)',
  padding: 10,
  fontFamily: 'var(--sans)',
  fontSize: 13.5,
  lineHeight: 1.5,
  color: 'var(--ink)',
  borderRadius: 'var(--rad)',
  resize: 'vertical',
  outline: 'none',
});

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

  const wrapper =
    variant === 'modal'
      ? {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 1000,
          background: 'var(--paper)',
          border: '1px solid var(--rule-2)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 'var(--rad)',
          boxShadow: '0 20px 60px -20px rgba(0,0,0,0.25), 0 4px 12px -4px rgba(0,0,0,0.1)',
          padding: 22,
          animation: 'fadeUp 240ms cubic-bezier(.2,.7,.2,1) forwards',
        }
      : {
          position: 'relative',
          background: 'var(--paper)',
          border: '1px solid var(--rule-2)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 'var(--rad)',
          boxShadow: '0 12px 40px -16px rgba(0,0,0,0.18)',
          padding: 18,
          animation: 'fadeUp 240ms cubic-bezier(.2,.7,.2,1) forwards',
        };

  return (
    <>
      {variant === 'modal' && (
        <div
          onClick={onCancel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
            backdropFilter: 'blur(2px)',
            zIndex: 999,
            animation: 'fadeUp 200ms cubic-bezier(.2,.7,.2,1) both',
          }}
        />
      )}
      <div onKeyDown={onKey} style={{ ...wrapper, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
            {title || (isEdit ? 'EDITING NOTE' : 'NEW NOTE')}
          </div>
          <div className="tweak-seg" style={{ background: 'var(--paper-2)' }}>
            {['cloze', 'recall', 'note'].map((m) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} style={{ padding: '3px 9px', fontSize: 10.5 }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {mode === 'cloze' && (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 6 }}>
              PASSAGE · wrap answer in [[brackets]]
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste(setPrompt)}
              style={drawerTextarea(90)}
            />
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 8 }}>
              {(prompt.match(/\[\[[^\]]+\]\]/g) || []).length} cloze
              {(prompt.match(/\[\[[^\]]+\]\]/g) || []).length !== 1 ? 's' : ''}
            </div>
          </>
        )}

        {mode === 'recall' && (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 6 }}>QUESTION</div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste(setPrompt)}
              style={drawerTextarea(54)}
            />
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 10, marginBottom: 6 }}>ANSWER</div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPaste={onPaste(setAnswer)}
              style={drawerTextarea(72)}
            />
          </>
        )}

        {mode === 'note' && (
          <>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 6 }}>NOTE</div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste(setPrompt)}
              style={drawerTextarea(140)}
            />
          </>
        )}

        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="mono"
              style={{
                padding: '2px 7px',
                background: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                color: 'var(--ink-2)',
                borderRadius: 'var(--rad)',
                fontSize: 10.5,
                cursor: 'pointer',
              }}
            >
              {t} ×
            </button>
          ))}
          <input
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
            placeholder="+ tag"
            style={{
              border: 0,
              background: 'transparent',
              outline: 'none',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-2)',
              padding: '2px 4px',
              width: 70,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {isEdit && onDelete && (
              <button className="btn ghost xs" onClick={onDelete} style={{ color: 'var(--accent)' }}>
                <Ic.Trash/> Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginRight: 4 }}>⌘⏎</div>
            <button className="btn ghost xs" onClick={onCancel}>Cancel</button>
            <button className="btn primary xs" onClick={commit} style={{ padding: '6px 12px' }}>
              {isEdit ? 'Save' : 'Commit to memory'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
