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
import HomePage from './HomePage';
import ReviewModal from './ReviewModal';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MemoizedPage = memo(Page);

const ContentEditable = memo(React.forwardRef(({ value, onChange, onKeyDown, onPaste, placeholder, ...props }, ref) => {
    const localRef = useRef(null);

    useEffect(() => {
        if (localRef.current && localRef.current.innerHTML !== value) {
            localRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
    };

    const isEmpty = !value || value.trim() === '';

    return (
        <div 
            {...props} 
            ref={r => { localRef.current = r; if (ref) ref.current = r; }} 
            contentEditable 
            onInput={handleInput} 
            onKeyDown={onKeyDown} 
            onPaste={onPaste}
            data-placeholder={placeholder}
            className={`${props.className || ''} ${isEmpty ? 'empty' : ''}`}
        ></div>
    );
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

const NoteMenu = memo(({ noteId, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        onEdit(noteId);
        setIsOpen(false);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete(noteId);
        setIsOpen(false);
    };

    return (
        <div className={`note-menu ${isOpen ? 'open' : ''}`} ref={menuRef}>
            <button 
                className="note-menu-button"
                onClick={handleMenuToggle}
                aria-label="Note options"
            >
                ⋯
            </button>
            {isOpen && (
                <div className="note-menu-dropdown">
                    <button className="note-menu-item" onClick={handleEdit}>
                        ✏️ Edit
                    </button>
                    <button className="note-menu-item" onClick={handleDelete}>
                        🗑️ Delete
                    </button>
                </div>
            )}
        </div>
    );
});

const Note = memo(({ note, onSave, onCancel, onEdit, onDelete, isPositioned }) => {
    const [question, setQuestion] = useState(note.question);
    const [answer, setAnswer] = useState(note.answer);
    const questionRef = useRef(null);

    useEffect(() => {
        if (note.isEditing && isPositioned && questionRef.current) {
            questionRef.current.focus();
        }
    }, [note.isEditing, isPositioned]);

    useEffect(() => {
        // Reset state when entering edit mode
        if (note.isEditing) {
            setQuestion(note.question);
            setAnswer(note.answer);
        }
    }, [note.isEditing, note.question, note.answer]);

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
                placeholder="Type a prompt here"
            />
            <ContentEditable
                className="editable-div editable-div-last"
                value={answer}
                onChange={setAnswer}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Type a response here"
            />
            <NoteMenu 
                noteId={note.id}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        </div>
    );
});

const PageRenderer = memo(({ index, style, scale, highlights, pendingHighlight, onPageRenderSuccess, notes, onNoteSave, onNoteCancel, onNoteEdit, onNoteDelete, activeNoteId, onNoteClick, onHighlightClick, noteRefs }) => {
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
                                    data-annotation-id={h.id}
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
                                    onEdit={onNoteEdit}
                                    onDelete={onNoteDelete}
                                    isPositioned={notePositions[note.id] !== undefined}
                               />
                           ) : (
                            <div 
                                className={`note ${note.id === activeNoteId ? 'active' : ''}`} 
                                onClick={(e) => { e.stopPropagation(); onNoteClick(note.id); }}
                                onDoubleClick={(e) => { e.stopPropagation(); onNoteEdit(note.id); }}
                            >
                                <NoteContent content={note.question} className="note-question" />
                                <NoteContent content={note.answer} className="note-answer" />
                                <NoteMenu 
                                    noteId={note.id}
                                    onEdit={onNoteEdit}
                                    onDelete={onNoteDelete}
                                />
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
    const [showHomePage, setShowHomePage] = useState(true);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const listRef = useRef();
    const pageHeights = useRef({});
    const viewerRef = useRef(null);
    const noteRefs = useRef({});

    const onFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        await handleFileSelection(selectedFile);
    };

    const handleFileSelection = async (selectedFile, existingMetadata = null) => {
        setIsUploading(true);
        setUploadError(null);
        
        try {
            let fileData = existingMetadata;
            
            // If no existing metadata, upload the file
            if (!existingMetadata) {
                const response = await apiService.uploadFile(selectedFile);
                if (response.success) {
                    fileData = response.file_data;
                    console.log(response.is_duplicate ? 'Opened existing file' : 'Uploaded new file', response.file_data);
                } else {
                    throw new Error('Upload failed');
                }
            }
            
            // Set file metadata and switch to PDF viewer
            setFileMetadata(fileData);
            setFile(selectedFile);
            setShowHomePage(false);
            
            // Load existing annotations
            if (fileData) {
                await loadAnnotations(fileData.id);
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
            
        } catch (error) {
            setUploadError(error.message);
            console.error('File selection failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleHomePageFileSelect = async (file, metadata) => {
        await handleFileSelection(file, metadata);
    };

    const goToHomePage = () => {
        setShowHomePage(true);
        setFile(null);
        setFileMetadata(null);
        setNotes([]);
        setHighlights([]);
        setPendingHighlight(null);
        setActiveNoteId(null);
        setUploadError(null);
    };

    const onDocumentLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
    }, []);

    const loadAnnotations = useCallback(async (fileId) => {
        if (!fileId) return;
        
        setIsLoadingAnnotations(true);
        try {
            const annotations = await apiService.getAnnotations(fileId);
            
            // Convert backend annotations to frontend format with fallback chain
            const frontendNotes = annotations.map(annotation => ({
                id: annotation.annotation_id,
                question: annotation.question,
                answer: annotation.answer,
                highlightedText: annotation.highlighted_text,
                isEditing: false,
                backendId: annotation.id // Store backend ID for updates
            }));
            
            const frontendHighlights = await Promise.all(annotations.map(async (annotation) => {
                const highlight = await resolveAnnotationLocation(annotation);
                return {
                    id: annotation.annotation_id,
                    pageIndex: annotation.page_index,
                    rects: highlight.rects,
                    normalizedRects: highlight.normalizedRects,
                    textAnchor: highlight.textAnchor,
                    resolutionMethod: highlight.resolutionMethod // For debugging
                };
            }));
            
            setNotes(frontendNotes);
            setHighlights(frontendHighlights);
            
                    console.log(`✅ Loaded ${annotations.length} annotations with resolution methods:`, 
            frontendHighlights.map(h => `${h.id}: ${h.resolutionMethod}`));
        
        // Debug: Show detailed resolution info
        frontendHighlights.forEach(h => {
            console.log(`📍 Annotation ${h.id}: ${h.resolutionMethod}`, {
                rects: h.rects.length,
                normalizedRects: h.normalizedRects?.length || 0,
                textAnchor: h.textAnchor?.selected_text || 'none'
            });
        });
        } catch (error) {
            console.error('Failed to load annotations:', error);
        } finally {
            setIsLoadingAnnotations(false);
        }
    }, []);

    // Resolve annotation location using fallback chain
    const resolveAnnotationLocation = useCallback(async (annotation) => {
        let positionData;
        
        try {
            positionData = JSON.parse(annotation.position_data);
        } catch (error) {
            console.warn('Failed to parse position data, using fallback:', error);
            // Fallback to treating as legacy pixel coordinates
            positionData = { pixel_rects: annotation.position_data };
        }

        // Method 1: Try text anchoring first (most reliable)
        if (positionData.text_anchor && positionData.text_anchor.selected_text) {
            const textMatch = await findTextAnchorMatch(
                annotation.page_index,
                positionData.text_anchor
            );
            if (textMatch) {
                return {
                    rects: textMatch.rects,
                    normalizedRects: textMatch.normalizedRects,
                    textAnchor: positionData.text_anchor,
                    resolutionMethod: 'text_anchor'
                };
            }
        }

        // Method 2: Try normalized coordinates (scale-independent)
        if (positionData.normalized_rects && positionData.normalized_rects.length > 0) {
            const normalizedMatch = convertNormalizedToPixel(
                annotation.page_index,
                positionData.normalized_rects
            );
            if (normalizedMatch) {
                return {
                    rects: normalizedMatch.rects,
                    normalizedRects: positionData.normalized_rects,
                    textAnchor: positionData.text_anchor,
                    resolutionMethod: 'normalized_coords'
                };
            }
        }

        // Method 3: Fallback to legacy pixel coordinates
        if (positionData.pixel_rects) {
            return {
                rects: positionData.pixel_rects,
                normalizedRects: positionData.normalized_rects || [],
                textAnchor: positionData.text_anchor,
                resolutionMethod: 'pixel_coords_legacy'
            };
        }

        // Method 4: Last resort - try to parse as legacy array
        if (Array.isArray(positionData)) {
            return {
                rects: positionData,
                normalizedRects: [],
                textAnchor: null,
                resolutionMethod: 'legacy_array'
            };
        }

        console.warn('Could not resolve annotation location for:', annotation.annotation_id);
        return {
            rects: [],
            normalizedRects: [],
            textAnchor: null,
            resolutionMethod: 'failed'
        };
    }, []);

    const startNewNote = useCallback(() => {
        if (!pendingHighlight) return;

        const newHighlight = {
            id: `highlight-${Date.now()}`,
            pageIndex: pendingHighlight.pageIndex,
            rects: pendingHighlight.rects,
            normalizedRects: pendingHighlight.normalizedRects,
            textAnchor: pendingHighlight.textAnchor,
            locationData: pendingHighlight.locationData
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
        const pageRect = pageElement.getBoundingClientRect();

        // Get selected text and page text for anchoring
        const selectedText = selection.toString();
        const fullPageText = pageElement.textContent || '';
        const selectionStart = fullPageText.indexOf(selectedText);

        // Create text anchor data
        const textAnchor = {
            selected_text: selectedText,
            prefix: selectionStart > 0 ? fullPageText.substring(Math.max(0, selectionStart - 20), selectionStart) : '',
            suffix: selectionStart >= 0 ? fullPageText.substring(selectionStart + selectedText.length, selectionStart + selectedText.length + 20) : '',
            char_start: selectionStart,
            char_end: selectionStart + selectedText.length,
            page_text_hash: hashString(fullPageText) // Simple hash for page text
        };

        // Convert pixel coordinates to normalized coordinates
        const clientRects = Array.from(range.getClientRects());
        const normalizedRects = clientRects.map(rect => ({
            x: (rect.left - pageRect.left) / pageRect.width,
            y: (rect.top - pageRect.top) / pageRect.height,
            width: rect.width / pageRect.width,
            height: rect.height / pageRect.height
        }));

        // Keep pixel coordinates for display (relative to page)
        const pixelRects = clientRects.map(rect => ({
            top: rect.top - pageRect.top,
            left: rect.left - pageRect.left,
            width: rect.width,
            height: rect.height,
        }));

        const newPendingHighlight = {
            top: selectionRect.top - viewerRect.top + viewerRef.current.scrollTop,
            left: selectionRect.left - viewerRect.left,
            highlightedText: selectedText,
            pageIndex: parseInt(pageElement.dataset.pageNumber, 10) - 1,
            rects: pixelRects,
            normalizedRects: normalizedRects,
            textAnchor: textAnchor,
            locationData: {
                normalized_rects: normalizedRects,
                text_anchor: textAnchor,
                metadata: {
                    page_text_hash: textAnchor.page_text_hash,
                    selection_timestamp: new Date().toISOString(),
                    scale: scale
                }
            }
        };

        setPendingHighlight(newPendingHighlight);
        selection.removeAllRanges();
        
        // Debug logging
        console.log('🎯 New selection captured:', {
            text: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''),
            normalizedRects: normalizedRects.length,
            textAnchor: textAnchor.selected_text.length > 0,
            prefix: textAnchor.prefix,
            suffix: textAnchor.suffix
        });
    }, [scale]);

    // Simple hash function for page text
    const hashString = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    };

    // Find text anchor match using prefix/suffix matching
    const findTextAnchorMatch = useCallback(async (pageIndex, textAnchor) => {
        // Wait for page to be rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const pageElements = document.querySelectorAll('.react-pdf__Page');
        const pageElement = pageElements[pageIndex];
        
        if (!pageElement) {
            console.warn(`Page ${pageIndex} not found`);
            return null;
        }

        const pageText = pageElement.textContent || '';
        const { selected_text, prefix, suffix } = textAnchor;

        // Method 1: Try exact prefix + text + suffix match
        const exactPattern = prefix + selected_text + suffix;
        let matchIndex = pageText.indexOf(exactPattern);
        
        if (matchIndex >= 0) {
            return findTextBounds(pageElement, selected_text, matchIndex + prefix.length);
        }

        // Method 2: Try text + suffix match
        const textSuffixPattern = selected_text + suffix;
        matchIndex = pageText.indexOf(textSuffixPattern);
        
        if (matchIndex >= 0) {
            return findTextBounds(pageElement, selected_text, matchIndex);
        }

        // Method 3: Try prefix + text match
        const prefixTextPattern = prefix + selected_text;
        matchIndex = pageText.indexOf(prefixTextPattern);
        
        if (matchIndex >= 0) {
            return findTextBounds(pageElement, selected_text, matchIndex + prefix.length);
        }

        // Method 4: Try just the selected text (could be multiple matches)
        matchIndex = pageText.indexOf(selected_text);
        
        if (matchIndex >= 0) {
            return findTextBounds(pageElement, selected_text, matchIndex);
        }

        console.warn('Text anchor match failed for:', selected_text);
        return null;
    }, []);

    // Find text bounds and convert to coordinates
    const findTextBounds = useCallback((pageElement, text, startIndex) => {
        try {
            const pageRect = pageElement.getBoundingClientRect();
            const textNodes = getTextNodes(pageElement);
            
            let currentIndex = 0;
            let startNode = null;
            let startOffset = 0;
            let endNode = null;
            let endOffset = 0;

            // Find start and end nodes
            for (let node of textNodes) {
                const nodeText = node.textContent || '';
                const nodeLength = nodeText.length;
                
                if (currentIndex + nodeLength > startIndex && !startNode) {
                    startNode = node;
                    startOffset = startIndex - currentIndex;
                }
                
                if (currentIndex + nodeLength >= startIndex + text.length && !endNode) {
                    endNode = node;
                    endOffset = startIndex + text.length - currentIndex;
                    break;
                }
                
                currentIndex += nodeLength;
            }

            if (!startNode || !endNode) {
                console.warn('Could not find text nodes for bounds');
                return null;
            }

            // Create range and get bounding rects
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            
            const clientRects = Array.from(range.getClientRects());
            
            // Convert to pixel coordinates (relative to page)
            const pixelRects = clientRects.map(rect => ({
                top: rect.top - pageRect.top,
                left: rect.left - pageRect.left,
                width: rect.width,
                height: rect.height
            }));

            // Convert to normalized coordinates
            const normalizedRects = clientRects.map(rect => ({
                x: (rect.left - pageRect.left) / pageRect.width,
                y: (rect.top - pageRect.top) / pageRect.height,
                width: rect.width / pageRect.width,
                height: rect.height / pageRect.height
            }));

            return {
                rects: pixelRects,
                normalizedRects: normalizedRects
            };
        } catch (error) {
            console.warn('Error finding text bounds:', error);
            return null;
        }
    }, []);

    // Get all text nodes from an element
    const getTextNodes = (element) => {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) {
                textNodes.push(node);
            }
        }

        return textNodes;
    };

    // Convert normalized coordinates to current pixel coordinates
    const convertNormalizedToPixel = useCallback((pageIndex, normalizedRects) => {
        const pageElements = document.querySelectorAll('.react-pdf__Page');
        const pageElement = pageElements[pageIndex];
        
        if (!pageElement) {
            console.warn(`Page ${pageIndex} not found for coordinate conversion`);
            return null;
        }

        const pageRect = pageElement.getBoundingClientRect();
        
        const pixelRects = normalizedRects.map(normalized => ({
            top: normalized.y * pageRect.height,
            left: normalized.x * pageRect.width,
            width: normalized.width * pageRect.width,
            height: normalized.height * pageRect.height
        }));

        return {
            rects: pixelRects,
            normalizedRects: normalizedRects
        };
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
            // Prepare enriched position data
            const enrichedPositionData = {
                // Legacy pixel coordinates for backward compatibility
                pixel_rects: highlight.rects,
                
                // New normalized coordinates
                normalized_rects: highlight.normalizedRects || [],
                
                // Text anchoring data
                text_anchor: highlight.textAnchor || {
                    selected_text: updatedNote.highlightedText,
                    prefix: '',
                    suffix: '',
                    char_start: -1,
                    char_end: -1
                },
                
                // Metadata
                metadata: {
                    page_text_hash: highlight.textAnchor?.page_text_hash || '',
                    selection_timestamp: new Date().toISOString(),
                    scale: scale,
                    version: '1.0'
                }
            };

            if (updatedNote.backendId) {
                // Update existing annotation
                const annotationData = {
                    question: updatedNote.question,
                    answer: updatedNote.answer,
                    highlighted_text: updatedNote.highlightedText,
                    position_data: JSON.stringify(enrichedPositionData)
                };
                
                await apiService.updateAnnotation(updatedNote.backendId, annotationData);
                console.log('Updated annotation in backend with enriched data');
            } else {
                // Create new annotation
                const annotationData = {
                    annotation_id: updatedNote.id,
                    page_index: highlight.pageIndex,
                    question: updatedNote.question,
                    answer: updatedNote.answer,
                    highlighted_text: updatedNote.highlightedText,
                    position_data: JSON.stringify(enrichedPositionData)
                };
                
                const response = await apiService.createAnnotation(fileMetadata.id, annotationData);
                updatedNote.backendId = response.id;
                console.log('Created annotation in backend with enriched data');
            }
        } catch (error) {
            console.error('Failed to save annotation to backend:', error);
            // Continue with frontend save even if backend fails
        }
        
        setNotes(notes => notes.map(n => n.id === updatedNote.id ? updatedNote : n));
    }, [fileMetadata, highlights, scale]);

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

    const handleNoteEdit = useCallback((noteId) => {
        setNotes(notes => notes.map(n => n.id === noteId ? { ...n, isEditing: true } : n));
    }, []);

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

    if (showHomePage) {
        return (
            <div className="App">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <div className="app-title clickable-title" onClick={goToHomePage}>odyssey</div>
                  </div>
                  
                  <div className="toolbar-right">
                    {/* Upload button */}
                    <div className="file-input-container">
                      <button 
                        className="toolbar-button upload-button" 
                        title="Upload PDF"
                        disabled={isUploading}
                      >
                                              <span className={`material-icons ${isUploading ? 'loading' : ''}`}>
                        {isUploading ? 'sync' : 'upload_file'}
                      </span>
                      <span className="upload-text">Upload</span>
                      </button>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={onFileChange}
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                </div>
                <HomePage onFileSelect={handleHomePageFileSelect} />
            </div>
        );
    }

    return (
        <div className="App">
            <div className="toolbar">
              <div className="toolbar-left">
                <div className="app-title clickable-title" onClick={goToHomePage}>odyssey</div>
                
                <div className="file-info-container">
                  <div className="file-name">
                    {isUploading ? "Uploading..." : 
                     fileMetadata ? fileMetadata.display_name : 
                     "No file selected"}
                  </div>
                  {uploadError && (
                    <div className="error-message">
                      Error: {uploadError}
                    </div>
                  )}
                  {isLoadingAnnotations && (
                    <div className="loading-message">
                      Loading annotations...
                    </div>
                  )}
                </div>
              </div>
              
              <div className="toolbar-right">
                {/* Review button */}
                <button 
                  className="toolbar-button review-button" 
                  onClick={() => setShowReviewModal(true)}
                  title="Review Cards"
                >
                  <span className="material-icons">memory</span>
                  <span className="review-text">Review</span>
                </button>
                
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
                                    onNoteEdit={handleNoteEdit}
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
            
            {/* Review Modal */}
            <ReviewModal 
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                fileId={fileMetadata?.id}
            />
        </div>
    );
}

export default App;