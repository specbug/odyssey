import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

const MemoizedPage = memo(Page);

const Note = memo(({ note, onSave, onCancel }) => {
    const [question, setQuestion] = useState(note.question);
    const [answer, setAnswer] = useState(note.answer);
    const questionRef = useRef(null);

    useEffect(() => {
        questionRef.current?.focus();
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

    return (
        <div className="note">
            <textarea
                ref={questionRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Question"
            />
            <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
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
                                <p className="note-question">{note.question}</p>
                                <p className="note-answer">{note.answer}</p>
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
