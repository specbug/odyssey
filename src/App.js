import React, { useState, useCallback, useRef, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

const MemoizedPage = memo(Page);

const PageRenderer = memo(({ index, style, scale, highlights, pendingHighlight, onPageRenderSuccess }) => {
    return (
        <div style={style}>
        <MemoizedPage
            pageNumber={index + 1}
            scale={scale}
            renderAnnotationLayer={true}
            renderTextLayer={true}
            onRenderSuccess={onPageRenderSuccess}
            customTextRenderer={text =>
                text.str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
            }
        >
            {highlights.map(h => (
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
            {pendingHighlight && pendingHighlight.rects.map((rect, i) => (
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
    );
});

const PdfViewer = memo(({ file, numPages, scale, highlights, pendingComment, listRef, pageHeights, viewerRef, handleViewerMouseUp, onDocumentLoadSuccess, startCommenting }) => {
    const onPageRenderSuccess = useCallback((page) => {
        if (pageHeights.current[page.pageNumber - 1] !== page.height) {
            pageHeights.current[page.pageNumber - 1] = page.height;
            if(listRef.current) {
                listRef.current.resetAfterIndex(page.pageNumber - 1);
            }
        }
    }, [pageHeights, listRef]);

    const getPageHeight = (index) => {
        return pageHeights.current[index] || 1000; // Default height
    };
    
    return (
        <div className="pdf-viewer-container" ref={viewerRef} onMouseUp={handleViewerMouseUp}>
            {pendingComment && (
                <div 
                className="comment-popup" 
                style={{ top: pendingComment.top, left: pendingComment.left }}
                onClick={startCommenting}
                >
                Add Comment
                </div>
            )}
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                {numPages && (
                <List
                    ref={listRef}
                    height={viewerRef.current ? viewerRef.current.clientHeight : 0}
                    itemCount={numPages}
                    itemSize={getPageHeight}
                    width="100%"
                >
                    {({ index, style }) => (
                        <PageRenderer 
                            index={index}
                            style={style}
                            scale={scale}
                            highlights={highlights.filter(h => h.pageIndex === index)}
                            pendingHighlight={pendingComment && pendingComment.pageIndex === index ? pendingComment : null}
                            onPageRenderSuccess={onPageRenderSuccess}
                        />
                    )}
                </List>
                )}
            </Document>
        </div>
    )
});


function App() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [comments, setComments] = useState([]);
  const [scale, setScale] = useState(1.5);
  const [highlights, setHighlights] = useState([]);
  const [pendingComment, setPendingComment] = useState(null);
  const listRef = useRef();
  const pageHeights = useRef({});
  const viewerRef = useRef(null);

  const onFileChange = (event) => {
    setFile(event.target.files[0]);
    setHighlights([]);
    setComments([]);
    setPendingComment(null);
    pageHeights.current = {};
  };

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
  }, []);

  const startCommenting = useCallback(() => {
    if (!pendingComment) return;

    const newHighlight = {
      id: `highlight-${Date.now()}`,
      pageIndex: pendingComment.pageIndex,
      rects: pendingComment.rects,
    };

    const newComment = {
      text: '', // Will be filled in from the sidebar
      highlightedText: pendingComment.highlightedText,
      id: newHighlight.id,
      isEditing: true,
    };

    setHighlights(prev => [...prev, newHighlight]);
    setComments(prev => [...prev, newComment]);
    setPendingComment(null);
  }, [pendingComment]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection.isCollapsed) {
      setPendingComment(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const pageElement = range.startContainer.parentElement.closest('.react-pdf__Page');
    if (!pageElement) return;

    const viewerRect = viewerRef.current.getBoundingClientRect();
    const selectionRect = range.getBoundingClientRect();

    const pageRect = pageElement.getBoundingClientRect();
    const selectionRects = Array.from(range.getClientRects()).map(rect => ({
        top: rect.top - pageRect.top,
        left: rect.left - pageRect.left,
        width: rect.width,
        height: rect.height,
    }));

    const newPendingComment = {
      top: selectionRect.top - viewerRect.top + viewerRef.current.scrollTop,
      left: selectionRect.left - viewerRect.left,
      highlightedText: selection.toString(),
      pageIndex: parseInt(pageElement.dataset.pageNumber, 10) - 1,
      rects: selectionRects,
    };
    
    setPendingComment(newPendingComment);
    selection.removeAllRanges();

  }, []);

  const handleCommentChange = (commentId, newText) => {
    setComments(comments.map(c => c.id === commentId ? {...c, text: newText} : c));
  };

  const handleCommentSave = (commentId, e) => {
    if (e.key === 'Enter') {
      setComments(comments.map(c => c.id === commentId ? {...c, isEditing: false} : c));
    }
  };

  const handleViewerMouseUp = useCallback((event) => {
    if (event.target.closest('.comment-popup')) {
      return;
    }
    handleTextSelection();
  }, [handleTextSelection]);

  return (
    <div className="App">
      <div className="main-content">
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
        <PdfViewer 
            file={file}
            numPages={numPages}
            scale={scale}
            highlights={highlights}
            pendingComment={pendingComment}
            listRef={listRef}
            pageHeights={pageHeights}
            viewerRef={viewerRef}
            handleViewerMouseUp={handleViewerMouseUp}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            startCommenting={startCommenting}
        />
      </div>
      <div className="sidebar">
        <h2>Comments</h2>
        <div className="comments-container">
          {comments.map(comment => (
            <div key={comment.id} className="comment">
              <p><strong>Highlighted:</strong> {comment.highlightedText}</p>
              {comment.isEditing ? (
                <textarea
                  autoFocus
                  value={comment.text}
                  onChange={(e) => handleCommentChange(comment.id, e.target.value)}
                  onKeyDown={(e) => handleCommentSave(comment.id, e)}
                  placeholder="Type your comment..."
                />
              ) : (
                <p><strong>Comment:</strong> {comment.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;