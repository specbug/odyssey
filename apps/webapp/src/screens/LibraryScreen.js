import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import apiService from '../api';
import { toLibraryDoc } from '../data/adapters';
import { hashToHue } from '../utils/hue';
import DocGlyph from '../components/DocGlyph';
import { Ic } from '../components/Icons';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

// Extract design metadata (author + excerpt) from a freshly uploaded PDF.
// Best-effort — encrypted or unusual PDFs fall back to null fields.
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
      setError(e.message || String(e));
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
        const color_hue = hashToHue(data.file_hash);
        try {
          await apiService.updateFileMetadata(data.id, { author, color_hue, excerpt });
        } catch (e) { console.warn('metadata patch failed', e); }
        if (totalPages && totalPages !== data.total_pages) {
          try { await apiService.updateTotalPages(data.id, totalPages); }
          catch (e) { /* non-fatal */ }
        }
      }
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
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
      setError(e.message || String(e));
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

  if (error && !docs.length) {
    return (
      <div className="scroll" style={{ padding: '48px 64px' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-3)' }}>Couldn't reach the archive.</div>
        <div style={{ marginTop: 12, color: 'var(--ink-2)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ padding: '48px 64px 96px' }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />

      <div className="enter" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {docs.length === 0 && !loading ? (
          <div style={{ padding: '120px 40px', textAlign: 'center', border: '1px solid var(--rule)' }}>
            <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 12 }}>LIBRARY</div>
            <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.03em', marginBottom: 16 }}>
              An empty voyage.
            </h1>
            <p style={{ color: 'var(--ink-3)', marginBottom: 24, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              Add a document to begin.
            </p>
            <button className="btn primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Ic.Upload/> {uploading ? 'Reading…' : 'Add document'}
            </button>
          </div>
        ) : (
          <>
            <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 28, borderBottom: '1px solid var(--rule)' }}>
              <div>
                <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>
                  LIBRARY · {docs.length} DOCUMENT{docs.length === 1 ? '' : 'S'}
                </div>
                <h1 style={{ fontSize: 44, fontWeight: 400, letterSpacing: '-0.03em' }}>
                  An index of what you carry.
                </h1>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="tweak-seg" style={{ background: 'var(--paper-2)' }}>
                  {['recent', 'progress', 'due'].map((s) => (
                    <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s}</button>
                  ))}
                </div>
                <button className="btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  <Ic.Upload/> {uploading ? 'Reading…' : 'Add document'}
                </button>
              </div>
            </header>

            <div className="enter-stagger">
              {sorted.map((doc) => {
                const pct = doc.pages ? Math.round((doc.read / doc.pages) * 100) : 0;
                return (
                  <div
                    key={doc.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr 160px 200px',
                      gap: 32,
                      alignItems: 'center',
                      padding: '28px 0',
                      borderBottom: '1px solid var(--rule)',
                      transition: 'padding 220ms, background 220ms',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--paper-2)';
                      e.currentTarget.style.paddingLeft = '12px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '0';
                    }}
                  >
                    <button onClick={() => onOpenDoc(doc.id)} style={rowGlyphBtn}>
                      <DocGlyph doc={doc} size={72}/>
                    </button>
                    <button onClick={() => onOpenDoc(doc.id)} style={rowTextBtn}>
                      <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.015em', marginBottom: 4 }}>
                        {doc.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>{doc.authors}</div>
                      {doc.sample && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--ink-3)',
                            fontStyle: 'italic',
                            maxWidth: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          "{doc.sample}"
                        </div>
                      )}
                    </button>
                    <button onClick={() => onOpenDoc(doc.id)} style={rowTextBtn}>
                      <div className="mono" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
                        p. {doc.read} / {doc.pages || '—'}
                      </div>
                      <div style={{ height: 1, background: 'var(--rule-2)', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--ink)', height: 1 }}/>
                      </div>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}>{doc.cards}</div>
                        <div className="mono-sm" style={{ color: 'var(--ink-4)', marginTop: 4 }}>
                          {doc.due > 0 ? `${doc.due} DUE` : 'CARDS'}
                        </div>
                      </div>
                      {doc.due > 0 && (
                        <button
                          className="btn xs"
                          onClick={(e) => { e.stopPropagation(); onStartReview(doc.id); }}
                          title={`Review ${doc.due} due card${doc.due === 1 ? '' : 's'}`}
                        >
                          <Ic.Review/>
                        </button>
                      )}
                      {confirmDelete === doc.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn xs" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          <button className="btn xs" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => handleDelete(doc.id)}>
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn ghost xs"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(doc.id); }}
                          title="Delete document"
                          style={{ color: 'var(--ink-4)' }}
                        >
                          <Ic.Trash/>
                        </button>
                      )}
                      <Ic.Right color="var(--ink-4)"/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const rowGlyphBtn = {
  background: 'transparent',
  border: 0,
  padding: 0,
  cursor: 'pointer',
};
const rowTextBtn = {
  background: 'transparent',
  border: 0,
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
};
