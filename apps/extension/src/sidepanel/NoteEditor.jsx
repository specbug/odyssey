import React, { useState, useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

function NoteEditor({ note, onSave, onCancel }) {
  const [question, setQuestion] = useState(note?.question || '');
  const [answer, setAnswer] = useState(note?.answer || '');
  const [color, setColor] = useState('#ffeb3b');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const questionRef = useRef(null);
  const answerRef = useRef(null);

  useEffect(() => {
    // Auto-focus question field
    if (questionRef.current && !note) {
      questionRef.current.focus();
    }
  }, [note]);

  // Auto-resize textareas
  useEffect(() => {
    [questionRef, answerRef].forEach(ref => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        ref.current.style.height = ref.current.scrollHeight + 'px';
      }
    });
  }, [question, answer]);

  function handleSave() {
    if (!question.trim()) {
      alert('Question cannot be empty');
      return;
    }

    onSave({
      question: question.trim(),
      answer: answer.trim(),
      highlightData: {
        id: note?.annotation_id || `note-${Date.now()}`,
        text: note?.highlighted_text || '',
        color,
      },
    });
  }

  function renderLatex(text) {
    // Simple LaTeX rendering for preview
    const latexPattern = /\$\$(.*?)\$\$|\$(.*?)\$/g;
    return text.replace(latexPattern, (match, display, inline) => {
      try {
        const tex = display || inline;
        return katex.renderToString(tex, {
          displayMode: !!display,
          throwOnError: false,
        });
      } catch (e) {
        return match;
      }
    });
  }

  const colors = [
    { name: 'Yellow', value: '#ffeb3b' },
    { name: 'Green', value: '#4caf50' },
    { name: 'Blue', value: '#2196f3' },
    { name: 'Orange', value: '#ff9800' },
    { name: 'Pink', value: '#e91e63' },
    { name: 'Purple', value: '#9c27b0' },
  ];

  return (
    <div className="note-editor">
      <div className="editor-header">
        <h2>{note ? 'Edit Note' : 'New Note'}</h2>
        <button className="btn-close" onClick={onCancel}>✕</button>
      </div>

      <div className="editor-body">
        {/* Question field */}
        <div className="form-group">
          <label htmlFor="question">Question</label>
          <textarea
            ref={questionRef}
            id="question"
            className="form-control"
            placeholder="What do you want to remember?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
          />
          <div className="hint">Supports LaTeX: $inline$ or $$display$$</div>
        </div>

        {/* Answer field */}
        <div className="form-group">
          <label htmlFor="answer">Answer</label>
          <textarea
            ref={answerRef}
            id="answer"
            className="form-control"
            placeholder="The answer or explanation..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
          />
        </div>

        {/* Color picker */}
        <div className="form-group">
          <label>Highlight Color</label>
          <div className="color-picker">
            {colors.map((c) => (
              <button
                key={c.value}
                className={`color-swatch ${color === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="editor-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave}>
          {note ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default NoteEditor;
