import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import apiService from '../api';
import { toLibraryDoc } from '../data/adapters';
import { failText, plural } from '../utils/format';
import { inkProps } from '../data/inks';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

// Extract design metadata (author + excerpt) from a freshly uploaded PDF.
// Best-effort — encrypted or unusual PDFs fall back to null fields. This is
// only a fallback for when LLM enrichment is off or fails: it's PATCHed
// with fillOnly, and the backend's LLM task overwrites it.
async function extractPdfMetadata(fileId, hash) {
  try {
    const url = apiService.fileDownloadUrl(fileId, hash);
    const loadingTask = pdfjs.getDocument(url);
    const pdf = await loadingTask.promise;
    let author = null;
    let excerpt = null;
    let totalPages = pdf.numPages || null;
    try {
      const meta = await pdf.getMetadata();
      author = meta?.info?.Author ? String(meta.info.Author).trim() : null;
    } catch (e) { /* swallow */ }
    try {
      if (pdf.numPages >= 1) {
        const page = await pdf.getPage(1);
        const tc = await page.getTextContent();
        const raw = (tc.items || []).map((it) => it.str).join(' ');
        excerpt = raw.replace(/\s+/g, ' ').trim().slice(0, 220);
      }
    } catch (e) { /* swallow */ }
    return { author, excerpt, totalPages };
  } catch (e) {
    console.warn('PDF metadata extraction failed', e);
    return { author: null, excerpt: null, totalPages: null };
  }
}

export default function LibraryScreen({ onOpenDoc, onStartReview }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('recent');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // docId
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fs = await apiService.getFiles();
      setDocs(fs.map(toLibraryDoc).filter(Boolean));
      setError(null);
    } catch (e) {
      setError(failText('load library', e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiService.uploadFile(file);
      const data = res?.file_data;
      if (data?.id) {
        const { author, excerpt, totalPages } = await extractPdfMetadata(data.id, data.file_hash);
        try {
          await apiService.updateFileMetadata(
            data.id, { author, excerpt }, { fillOnly: true },
          );
        } catch (e) { console.warn('metadata patch failed', e); }
        if (totalPages && totalPages !== data.total_pages) {
          try { await apiService.updateTotalPages(data.id, totalPages); }
          catch (e) { /* non-fatal */ }
        }
      }
      await refresh();
    } catch (e) {
      setError(failText(`add ${file.name}`, e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteFile(id);
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      setError(failText('delete document', e));
    }
  };

  const sorted = [...docs].sort((a, b) => {
    if (sort === 'recent') return (b.raw?.last_accessed || b.raw?.upload_date || '').localeCompare(a.raw?.last_accessed || a.raw?.upload_date || '');
    if (sort === 'progress') {
      const ap = a.pages ? a.read / a.pages : 0;
      const bp = b.pages ? b.read / b.pages : 0;
      return bp - ap;
    }
    if (sort === 'due') return (b.due || 0) - (a.due || 0);
    return 0;
  });

  const addButton = (
    <button className="btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
      {uploading ? 'Adding…' : 'Add PDF'}
    </button>
  );

  return (
    <div className="scroll">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />
      <div className="page">
        <header className="page-head">
          <h1 className="t-h">Library</h1>
          {docs.length > 1 && (
            <div className="tabs" role="group" aria-label="Sort">
              {[['recent', 'Recent'], ['progress', 'Progress'], ['due', 'Due']].map(([k, label]) => (
                <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
              ))}
            </div>
          )}
          <span className="page-head-end">{addButton}</span>
        </header>

        {error && (
          <div className="notice">
            <p>{error}</p>
            {!docs.length && <button className="btn sm" onClick={refresh}>Retry</button>}
          </div>
        )}

        {!error && !loading && docs.length === 0 && <p className="empty">No documents.</p>}

        <ul className="rows library-rows">
          {sorted.map((doc) => (
            <li key={doc.id} className="library-row" {...inkProps(doc.ink)}>
              <button className="row" onClick={() => onOpenDoc(doc.id)}>
                <span className="row-main">
                  <span className="row-title">{doc.title}</span>
                  {doc.authors && <span className="t-small ink-2">{doc.authors}</span>}
                  {doc.sample && <span className="t-note row-excerpt">{doc.sample}</span>}
                </span>
              </button>
              <span className="library-end">
                <span className="t-small ink-2">
                  {doc.pages ? (doc.read > 0 ? `p.\u00a0${Math.min(doc.read + 1, doc.pages)} of ${doc.pages}` : plural(doc.pages, 'page')) : ''}
                </span>
                {doc.cards > 0 && <span className="t-small ink-3">{plural(doc.cards, 'note')}</span>}
              <span className="library-actions">
                {doc.due > 0 && (
                  <button className="btn ghost sm link" onClick={() => onStartReview(doc.id)}>
                    Review {doc.due}
                  </button>
                )}
                {confirmDelete === doc.id ? (
                  <>
                    <button className="btn ghost sm quiet" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    <button className="btn ghost sm" onClick={() => handleDelete(doc.id)}>Delete</button>
                  </>
                ) : (
                  <button className="btn ghost sm quiet library-delete" onClick={() => setConfirmDelete(doc.id)} aria-label={`Delete ${doc.title}`}>
                    Delete
                  </button>
                )}
              </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
