import React, { useState, useCallback, useRef, memo, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'katex/dist/katex.min.css';
import './katex-fonts.css';
import { InlineMath, BlockMath } from 'react-katex';
import './App.css';
import apiService from './api';

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

const Note = memo(({ note, onSave, onCancel, isPositioned }) => {
    const [question, setQuestion] = useState(note.question);
    const [answer, setAnswer] = useState(note.answer);
    const questionRef = useRef(null);

    useEffect(() => {
        if (note.isEditing && isPositioned && questionRef.current) {
            questionRef.current.focus();
        }
    }, [note.isEditing, isPositioned]);

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

const PageRenderer = memo(({ index, style, scale, highlights, pendingHighlight, onPageRenderSuccess, notes, onNoteSave, onNoteCancel, onNoteDelete, activeNoteId, onNoteClick, onHighlightClick, noteRefs }) => {
    const [notePositions, setNotePositions] = useState({});
    const [areNotesVisible, setAreNotesVisible] = useState(false);

    const pageNotes = useMemo(() => notes.filter(note => {
        const highlight = highlights.find(h => h.id === note.id);
        return highlight && highlight.pageIndex === index;
    }), [notes, highlights, index]);

    useEffect(() => {
        const calculatePositions = () => {
            const newPositions = {};
            let lastBottom = 0;
            const sortedNotes = [...pageNotes].sort((a, b) => {
                const aHighlight = highlights.find(h => h.id === a.id);
                const bHighlight = highlights.find(h => h.id === b.id);
                return (aHighlight?.rects[0]?.top || 0) - (bHighlight?.rects[0]?.top || 0);
            });

            sortedNotes.forEach(note => {
                const highlight = highlights.find(h => h.id === note.id);
                if (!highlight || !highlight.rects.length) return;

                const noteElement = noteRefs.current[note.id];
                if (!noteElement) return;

                const noteHeight = noteElement.offsetHeight;
                const highlightTop = highlight.rects[0].top;
                
                const top = Math.max(highlightTop, lastBottom + 5);
                newPositions[note.id] = top;
                lastBottom = top + noteHeight;
            });

            setNotePositions(newPositions);
            setAreNotesVisible(true);
        };

        const allNotesRendered = pageNotes.every(note => noteRefs.current[note.id]);

        if (pageNotes.length > 0 && allNotesRendered) {
            calculatePositions();
        } else {
            setAreNotesVisible(false);
        }
    }, [pageNotes, highlights, noteRefs]);

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
                                    onClick={(e) => { e.stopPropagation(); onHighlightClick(h.id); }}
                                    className={`highlight ${h.id === activeNoteId ? 'active' : ''}`}
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

            <div className="notes-column" style={{ opacity: areNotesVisible ? 1 : 0, transition: 'opacity 0.2s' }}>
                {pageNotes.map(note => {
                    return (
                        <div 
                            key={note.id} 
                            ref={el => noteRefs.current[note.id] = el}
                            className="note-wrapper" 
                            style={{ top: `${notePositions[note.id] || 0}px` }}
                        >
                           {note.isEditing ? (
                                <Note 
                                    note={note}
                                    onSave={onNoteSave}
                                    onCancel={onNoteCancel}
                                    isPositioned={notePositions[note.id] !== undefined}
                               />
                           ) : (
                            <div className={`note ${note.id === activeNoteId ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onNoteClick(note.id); }}>
                                <NoteContent content={note.question} className="note-question" />
                                <NoteContent content={note.answer} className="note-answer" />
                                <button className="delete-note-button" onClick={(e) => { e.stopPropagation(); onNoteDelete(note.id); }}>×</button>
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
    const [fileMetadata, setFileMetadata] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [notes, setNotes] = useState([]);
    const [scale, setScale] = useState(1.2);
    const [highlights, setHighlights] = useState([]);
    const [pendingHighlight, setPendingHighlight] = useState(null);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
    const listRef = useRef();
    const pageHeights = useRef({});
    const viewerRef = useRef(null);
    const noteRefs = useRef({});

    const onFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadError(null);
        
        try {
            // Upload file to backend
            const response = await apiService.uploadFile(selectedFile);
            
            if (response.success) {
                setFileMetadata(response.file_data);
                
                // For displaying the PDF, we need to create a blob URL from the original file
                setFile(selectedFile);
                
                // Load existing annotations if this is a duplicate file
                if (response.is_duplicate) {
                    await loadAnnotations(response.file_data.id);
                } else {
                    // New file, clear annotations
                    setHighlights([]);
                    setNotes([]);
                }
                
                // Reset UI state
                setPendingHighlight(null);
                setActiveNoteId(null);
                pageHeights.current = {};
                noteRefs.current = {};
                
                console.log(response.is_duplicate ? 'Opened existing file' : 'Uploaded new file', response.file_data);
            }
        } catch (error) {
            setUploadError(error.message);
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const onDocumentLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
    }, []);

    const loadAnnotations = useCallback(async (fileId) => {
        if (!fileId) return;
        
        setIsLoadingAnnotations(true);
        try {
            const annotations = await apiService.getAnnotations(fileId);
            
            // Convert backend annotations to frontend format
            const frontendNotes = annotations.map(annotation => ({
                id: annotation.annotation_id,
                question: annotation.question,
                answer: annotation.answer,
                highlightedText: annotation.highlighted_text,
                isEditing: false,
                backendId: annotation.id // Store backend ID for updates
            }));
            
            const frontendHighlights = annotations.map(annotation => ({
                id: annotation.annotation_id,
                pageIndex: annotation.page_index,
                rects: JSON.parse(annotation.position_data)
            }));
            
            setNotes(frontendNotes);
            setHighlights(frontendHighlights);
            
            console.log(`Loaded ${annotations.length} annotations`);
        } catch (error) {
            console.error('Failed to load annotations:', error);
        } finally {
            setIsLoadingAnnotations(false);
        }
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

    const getPageHeight = useCallback((index) => pageHeights.current[index] || (1188 * scale), [scale]);

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

    const handleNoteDelete = useCallback(async (noteId) => {
        const note = notes.find(n => n.id === noteId);
        
        // If the note has a backend ID, delete it from the backend
        if (note && note.backendId) {
            try {
                await apiService.deleteAnnotation(note.backendId);
                console.log('Deleted annotation from backend');
            } catch (error) {
                console.error('Failed to delete annotation from backend:', error);
                // Continue with frontend deletion even if backend fails
            }
        }
        
        setNotes(notes => notes.filter(n => n.id !== noteId));
        setHighlights(highlights => highlights.filter(h => h.id !== noteId));
    }, [notes]);

    const handleNoteSave = useCallback(async (updatedNote) => {
        if (!fileMetadata) {
            console.error('No file metadata available');
            return;
        }

        const highlight = highlights.find(h => h.id === updatedNote.id);
        if (!highlight) {
            console.error('No highlight found for note');
            return;
        }

        try {
            if (updatedNote.backendId) {
                // Update existing annotation
                const annotationData = {
                    question: updatedNote.question,
                    answer: updatedNote.answer,
                    highlighted_text: updatedNote.highlightedText,
                    position_data: JSON.stringify(highlight.rects)
                };
                
                await apiService.updateAnnotation(updatedNote.backendId, annotationData);
                console.log('Updated annotation in backend');
            } else {
                // Create new annotation
                const annotationData = {
                    annotation_id: updatedNote.id,
                    page_index: highlight.pageIndex,
                    question: updatedNote.question,
                    answer: updatedNote.answer,
                    highlighted_text: updatedNote.highlightedText,
                    position_data: JSON.stringify(highlight.rects)
                };
                
                const response = await apiService.createAnnotation(fileMetadata.id, annotationData);
                updatedNote.backendId = response.id;
                console.log('Created annotation in backend');
            }
        } catch (error) {
            console.error('Failed to save annotation to backend:', error);
            // Continue with frontend save even if backend fails
        }
        
        setNotes(notes => notes.map(n => n.id === updatedNote.id ? updatedNote : n));
    }, [fileMetadata, highlights]);

    const handleNoteClick = useCallback((noteId) => {
        setActiveNoteId(noteId);
        const highlight = highlights.find(h => h.id === noteId);
        if (highlight && viewerRef.current) {
            // Calculate total height of all pages before the target page
            let offsetToPage = 0;
            for (let i = 0; i < highlight.pageIndex; i++) {
                offsetToPage += getPageHeight(i);
            }
            
            // Add the highlight's position within the page, accounting for scale and padding
            const highlightTopOnPage = highlight.rects[0]?.top || 0;
            const scaledHighlightTop = highlightTopOnPage * scale;
            const pageContainerPadding = 20; // From CSS .page-and-notes-container padding
            
            const absoluteHighlightTop = offsetToPage + scaledHighlightTop + pageContainerPadding;
            
            // Center the highlight in the viewport
            const viewportHeight = viewerRef.current.offsetHeight;
            const targetScrollTop = absoluteHighlightTop - viewportHeight / 2;
            
            viewerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });
        }
    }, [highlights, scale, getPageHeight]);

    const handleHighlightClick = useCallback((noteId) => {
        setActiveNoteId(noteId);
        const noteElement = noteRefs.current[noteId];
        if (noteElement) {
            noteElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
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
        // Don't deselect if clicking on interactive elements
        if (event.target.closest('.comment-popup') || 
            event.target.closest('.note') || 
            event.target.closest('.highlight')) {
            return;
        }
        
        // Deselect active note
        setActiveNoteId(null);
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

    return (
        <div className="App">
            <div className="toolbar">
              <div className="toolbar-left">
                <div className="file-name">
                  {isUploading ? "Uploading..." : 
                   fileMetadata ? fileMetadata.original_filename : 
                   "No file selected"}
                </div>
                {uploadError && (
                  <div className="error-message" style={{ color: 'red', fontSize: '12px' }}>
                    Error: {uploadError}
                  </div>
                )}
                {isLoadingAnnotations && (
                  <div className="loading-message" style={{ color: 'blue', fontSize: '12px' }}>
                    Loading annotations...
                  </div>
                )}
              </div>
              
              <div className="toolbar-right">
                {/* Upload button */}
                <div className="file-input-container">
                  <button 
                    className="toolbar-button" 
                    title="Upload PDF"
                    disabled={isUploading}
                  >
                    <span className="material-symbols-outlined">
                      {isUploading ? 'hourglass_empty' : 'file_open'}
                    </span>
                  </button>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={onFileChange}
                    disabled={isUploading}
                  />
                </div>
                

                {/* Zoom controls */}
                <div className="zoom-controls">
                  <button onClick={() => setScale(s => s > 0.5 ? s - 0.1 : s)}>-</button>
                  <span>{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(s => s < 3 ? s + 0.1 : s)}>+</button>
                </div>
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
                {file ? (
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
                                    activeNoteId={activeNoteId}
                                    onNoteClick={handleNoteClick}
                                    onHighlightClick={handleHighlightClick}
                                    noteRefs={noteRefs}
                                />
                            )}
                        </List>
                    )}
                </Document>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📄</div>
                        <div className="empty-state-title">No PDF Selected</div>
                        <div className="empty-state-subtitle">
                            Choose a PDF file to start reading and taking notes
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;