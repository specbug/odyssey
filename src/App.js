import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MemoizedPage = memo(Page);

const ContentEditable = memo(React.forwardRef(({ value, onChange, onKeyDown, onPaste, ...props }, ref) => {
    const localRef = useRef(null);

    useEffect(() => {
        if (localRef.current && localRef.current.innerHTML !== value) {
            localRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
    };

    return <div {...props} ref={r => { localRef.current = r; if (ref) ref.current = r; }} contentEditable onInput={handleInput} onKeyDown={onKeyDown} onPaste={onPaste}></div>;
}));

const NoteContent = memo(({ content, className }) => {
    const renderLatex = (string) => {
        if (!string) return [];
        
        const processedString = string.replace(/<div>/g, ' ').replace(/<\/div>/g, ' ');

        const latexRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\[[\s\S]*?\\\]|\\\(.*?\\\)|\\begin\{equation\}[\s\S]*?\\end\{equation\})/g;
        const parts = processedString.split(latexRegex);

        return parts.map((part, index) => {
            if (!part) {
                return null;
            }

            const match = part.match(latexRegex);
            if (match && match[0] === part) {
                let isBlock = false;
                let katexString = '';

                if (part.startsWith('$$')) {
                    isBlock = true;
                    katexString = part.substring(2, part.length - 2);
                } else if (part.startsWith('\\[')) {
                    isBlock = true;
                    katexString = part.substring(2, part.length - 2);
                } else if (part.startsWith('\\begin{equation}')) {
                    isBlock = true;
                    katexString = part.substring(16, part.length - 14);
                } else if (part.startsWith('$')) {
                    isBlock = false;
                    katexString = part.substring(1, part.length - 1);
                } else if (part.startsWith('\\(')) {
                    isBlock = false;
                    katexString = part.substring(2, part.length - 2);
                }
                
                if (katexString) {
                    if (isBlock) {
                        return <BlockMath key={index} math={katexString} />;
                    } else {
                        return <InlineMath key={index} math={katexString} />;
                    }
                }
            }
            
            return <span key={index} dangerouslySetInnerHTML={{ __html: part }}></span>;
        });
    };

    return <div className={`note-content ${className}`}>{renderLatex(content)}</div>;
});

const Note = memo(({ note, onSave, onCancel }) => {
    const [question, setQuestion] = useState(note.question);
    const [answer, setAnswer] = useState(note.answer);
    const questionRef = useRef(null);

    useEffect(() => {
        if (questionRef.current) {
            questionRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onCancel(note.id);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave({ ...note, question, answer, isEditing: false });
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = `<img src="${event.target.result}" class="pasted-image" />`;
                    document.execCommand('insertHTML', false, img);
                };
                reader.readAsDataURL(blob);
            } else if (items[i].type === 'text/plain') {
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            }
        }
    };

    return (
        <div className="note">
            <ContentEditable
                ref={questionRef}
                className="editable-div"
                value={question}
                onChange={setQuestion}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Question"
            />
            <ContentEditable
                className="editable-div"
                value={answer}
                onChange={setAnswer}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Answer"
            />
            <div className="note-actions">
                <button onClick={() => onCancel(note.id)}>Cancel</button>
            </div>
        </div>
    );
});

const PageRenderer = memo(({ index, style, scale, highlights, pendingHighlight, onPageRenderSuccess, notes, onNoteSave, onNoteCancel, onNoteDelete }) => {
    const pageNotes = notes.filter(note => {
        const highlight = highlights.find(h => h.id === note.id);
        return highlight && highlight.pageIndex === index;
    });

    return (
        <div style={style} className="page-and-notes-container">
            <div className="page-wrapper">
                <MemoizedPage
                    pageNumber={index + 1}
                    scale={scale}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    onRenderSuccess={onPageRenderSuccess}
                    customTextRenderer={text => text.str.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                >
                    {highlights.filter(h => h.pageIndex === index).map(h => (
                        <React.Fragment key={h.id}>
                            {h.rects.map((rect, i) => (
                                <div
                                    key={i}
                                    className="highlight"
                                    style={{
                                        position: 'absolute',
                                        top: `${rect.top}px`,
                                        left: `${rect.left}px`,
                                        width: `${rect.width}px`,
                                        height: `${rect.height}px`,
                                    }}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                    {pendingHighlight && pendingHighlight.pageIndex === index && pendingHighlight.rects.map((rect, i) => (
                        <div
                            key={i}
                            className="highlight pending"
                            style={{
                                position: 'absolute',
                                top: `${rect.top}px`,
                                left: `${rect.left}px`,
                                width: `${rect.width}px`,
                                height: `${rect.height}px`,
                            }}
                        />
                    ))}
                </MemoizedPage>
            </div>

            <div className="notes-column">
                {pageNotes.map(note => {
                    const highlight = highlights.find(h => h.id === note.id);
                    if (!highlight || !highlight.rects.length) return null;
                    const firstRect = highlight.rects[0];

                    return (
                        <div key={note.id} className="note-wrapper" style={{ top: `${firstRect.top}px` }}>
                           {note.isEditing ? (
                                <Note 
                                    note={note}
                                    onSave={onNoteSave}
                                    onCancel={onNoteCancel}
                               />
                           ) : (
                            <div className="note">
                                <NoteContent content={note.question} className="note-question" />
                                <NoteContent content={note.answer} className="note-answer" />
                                <button className="delete-note-button" onClick={() => onNoteDelete(note.id)}>×</button>
                            </div>
                           )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

function App() {
    const [file, setFile] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [notes, setNotes] = useState([]);
    const [scale, setScale] = useState(1.2);
    const [highlights, setHighlights] = useState([]);
    const [pendingHighlight, setPendingHighlight] = useState(null);
    const listRef = useRef();
    const pageHeights = useRef({});
    const viewerRef = useRef(null);

    const onFileChange = (event) => {
        setFile(event.target.files[0]);
        setHighlights([]);
        setNotes([]);
        setPendingHighlight(null);
        pageHeights.current = {};
    };

    const onDocumentLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
    }, []);

    const startNewNote = useCallback(() => {
        if (!pendingHighlight) return;

        const newHighlight = {
            id: `highlight-${Date.now()}`,
            pageIndex: pendingHighlight.pageIndex,
            rects: pendingHighlight.rects,
        };

        const newNote = {
            question: '',
            answer: '',
            highlightedText: pendingHighlight.highlightedText,
            id: newHighlight.id,
            isEditing: true,
        };

        setHighlights(prev => [...prev, newHighlight]);
        setNotes(prev => [newNote, ...prev]);
        setPendingHighlight(null);
    }, [pendingHighlight]);

    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        if (selection.isCollapsed) {
            setPendingHighlight(null);
            return;
        }

        const range = selection.getRangeAt(0);
        const pageElement = range.startContainer.parentElement.closest('.react-pdf__Page');
        if (!pageElement) return;

        const viewerRect = viewerRef.current.getBoundingClientRect();
        const selectionRect = range.getBoundingClientRect();

        const newPendingHighlight = {
            top: selectionRect.top - viewerRect.top + viewerRef.current.scrollTop,
            left: selectionRect.left - viewerRect.left,
            highlightedText: selection.toString(),
            pageIndex: parseInt(pageElement.dataset.pageNumber, 10) - 1,
            rects: Array.from(range.getClientRects()).map(rect => ({
                top: rect.top - pageElement.getBoundingClientRect().top,
                left: rect.left - pageElement.getBoundingClientRect().left,
                width: rect.width,
                height: rect.height,
            })),
        };

        setPendingHighlight(newPendingHighlight);
        selection.removeAllRanges();
    }, []);

    const handleNoteDelete = useCallback((noteId) => {
        setNotes(notes => notes.filter(n => n.id !== noteId));
        setHighlights(highlights => highlights.filter(h => h.id !== noteId));
    }, []);

    const handleNoteSave = useCallback((updatedNote) => {
        setNotes(notes => notes.map(n => n.id === updatedNote.id ? updatedNote : n));
    }, []);

    const handleNoteCancel = useCallback((noteId) => {
        const note = notes.find(n => n.id === noteId);
        if (note && note.question === '' && note.answer === '') {
            handleNoteDelete(noteId);
        } else {
            setNotes(notes => notes.map(n => n.id === noteId ? { ...n, isEditing: false } : n));
        }
    }, [notes, handleNoteDelete]);

    const handleViewerMouseUp = useCallback((event) => {
        if (event.target.closest('.comment-popup') || event.target.closest('.note')) {
            return;
        }
        handleTextSelection();
    }, [handleTextSelection]);

    const onPageRenderSuccess = useCallback((page) => {
        if (pageHeights.current[page.pageNumber - 1] !== page.height) {
            pageHeights.current[page.pageNumber - 1] = page.height;
            if (listRef.current) {
                listRef.current.resetAfterIndex(page.pageNumber - 1);
            }
        }
    }, []);

    const getPageHeight = (index) => pageHeights.current[index] || (1188 * scale);

    return (
        <div className="App">
            <div className="toolbar">
                <div className="file-input-container">
                    <label htmlFor="file-input">Select PDF:</label>
                    <input type="file" id="file-input" onChange={onFileChange} accept=".pdf" />
                </div>
                <div className="zoom-controls">
                    <button onClick={() => setScale(s => s > 0.5 ? s - 0.1 : s)}>-</button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => s < 3 ? s + 0.1 : s)}>+</button>
                </div>
            </div>
            <div className="viewer-scroll-container" ref={viewerRef} onMouseUp={handleViewerMouseUp}>
                {pendingHighlight && (
                    <div
                        className="comment-popup"
                        style={{ top: pendingHighlight.top, left: pendingHighlight.left }}
                        onClick={startNewNote}
                    >
                        Add Note
                    </div>
                )}
                <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                    {numPages && (
                        <List
                            ref={listRef}
                            height={viewerRef.current ? viewerRef.current.offsetHeight : 0}
                            itemCount={numPages}
                            itemSize={getPageHeight}
                            width="100%"
                        >
                            {({ index, style }) => (
                                <PageRenderer
                                    index={index}
                                    style={style}
                                    scale={scale}
                                    highlights={highlights}
                                    pendingHighlight={pendingHighlight}
                                    onPageRenderSuccess={onPageRenderSuccess}
                                    notes={notes}
                                    onNoteSave={handleNoteSave}
                                    onNoteCancel={handleNoteCancel}
                                    onNoteDelete={handleNoteDelete}
                                />
                            )}
                        </List>
                    )}
                </Document>
            </div>
        </div>
    );
}

export default App;