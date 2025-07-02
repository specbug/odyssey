import React, { useState, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

function App() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [comments, setComments] = useState([]);
  const [scale, setScale] = useState(1.5);
  const [highlights, setHighlights] = useState([]);
  const listRef = useRef();
  const pageHeights = useRef({});

  const onFileChange = (event) => {
    setFile(event.target.files[0]);
    setHighlights([]);
    setComments([]);
    pageHeights.current = {};
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const getPageHeight = (index) => {
    return pageHeights.current[index] || 1000; // Default height
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const commentText = prompt('Enter your comment:');
      if (commentText) {
        const range = selection.getRangeAt(0);
        const pageElement = range.startContainer.parentElement.closest('.react-pdf__Page');
        if (!pageElement) return;

        const pageRect = pageElement.getBoundingClientRect();
        const selectionRects = Array.from(range.getClientRects()).map(rect => ({
          top: rect.top - pageRect.top,
          left: rect.left - pageRect.left,
          width: rect.width,
          height: rect.height,
        }));

        const newHighlight = {
          id: `highlight-${Date.now()}`,
          pageIndex: parseInt(pageElement.dataset.pageNumber, 10) - 1,
          rects: selectionRects,
        };

        const newComment = {
          text: commentText,
          highlightedText: selection.toString(),
          id: newHighlight.id,
        };

        setHighlights(prev => [...prev, newHighlight]);
        setComments(prev => [...prev, newComment]);
        selection.removeAllRanges();
      }
    }
  }, []);

  const PageRenderer = ({ index, style }) => (
    <div style={style} onMouseUp={handleTextSelection}>
      <Page
        pageNumber={index + 1}
        scale={scale}
        renderAnnotationLayer={true}
        renderTextLayer={true}
        onRenderSuccess={(page) => {
            if (pageHeights.current[index] !== page.height) {
                pageHeights.current[index] = page.height;
                if(listRef.current) {
                    listRef.current.resetAfterIndex(index);
                }
            }
        }}
        customTextRenderer={text =>
            text.str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
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
      </Page>
    </div>
  );

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
        <div className="pdf-viewer-container">
          <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
            {numPages && (
              <List
                ref={listRef}
                height={800} // This should be dynamic based on container size
                itemCount={numPages}
                itemSize={getPageHeight}
                width="100%"
              >
                {PageRenderer}
              </List>
            )}
          </Document>
        </div>
      </div>
      <div className="sidebar">
        <h2>Comments</h2>
        <div className="comments-container">
          {comments.map(comment => (
            <div key={comment.id} className="comment">
              <p><strong>Highlighted:</strong> {comment.highlightedText}</p>
              <p><strong>Comment:</strong> {comment.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
