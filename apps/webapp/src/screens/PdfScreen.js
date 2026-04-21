import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { VariableSizeList as List } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'katex/dist/katex.min.css';
import apiService from '../api';
import { toLibraryDoc } from '../data/adapters';
import { hasCloze } from '../utils/cloze';
import StickyNote from '../components/StickyNote';
import InlineCaptureDrawer from '../components/InlineCaptureDrawer';
import DocGlyph from '../components/DocGlyph';
import { Ic } from '../components/Icons';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

const MemoizedPage = memo(Page);

// ──────────────────────────────────────────────────────────────────
// Text-anchor + normalized-coords fallback chain
// (ported from the old App.js so highlights survive zoom & reflow)
// ──────────────────────────────────────────────────────────────────

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return h.toString(16);
}

function getTextNodes(el) {
  const out = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while ((n = walker.nextNode())) if (n.textContent.trim()) out.push(n);
  return out;
}

function findTextBounds(pageEl, text, startIndex) {
  try {
    const pageRect = pageEl.getBoundingClientRect();
    const nodes = getTextNodes(pageEl);
    let idx = 0, sN = null, sO = 0, eN = null, eO = 0;
    for (const node of nodes) {
      const len = (node.textContent || '').length;
      if (idx + len > startIndex && !sN) { sN = node; sO = startIndex - idx; }
      if (idx + len >= startIndex + text.length && !eN) {
        eN = node; eO = startIndex + text.length - idx;
        break;
      }
      idx += len;
    }
    if (!sN || !eN) return null;
    const range = document.createRange();
    range.setStart(sN, sO);
    range.setEnd(eN, eO);
    const rects = Array.from(range.getClientRects());
    const pixelRects = rects.map((r) => ({
      top: r.top - pageRect.top,
      left: r.left - pageRect.left,
      width: r.width,
      height: r.height,
    }));
    const normalizedRects = rects.map((r) => ({
      x: (r.left - pageRect.left) / pageRect.width,
      y: (r.top - pageRect.top) / pageRect.height,
      width: r.width / pageRect.width,
      height: r.height / pageRect.height,
    }));
    return { rects: pixelRects, normalizedRects };
  } catch {
    return null;
  }
}

async function findTextAnchorMatch(pageIndex, anchor) {
  await new Promise((r) => setTimeout(r, 40));
  const pages = document.querySelectorAll('.react-pdf__Page');
  const pageEl = pages[pageIndex];
  if (!pageEl) return null;
  const pageText = pageEl.textContent || '';
  const { selected_text, prefix = '', suffix = '' } = anchor;
  const tries = [
    prefix + selected_text + suffix,
    selected_text + suffix,
    prefix + selected_text,
    selected_text,
  ];
  for (const t of tries) {
    if (!t) continue;
    const i = pageText.indexOf(t);
    if (i >= 0) {
      const start = t.startsWith(prefix) && prefix ? i + prefix.length : i;
      return findTextBounds(pageEl, selected_text, start);
    }
  }
  return null;
}

function convertNormalizedToPixel(pageIndex, normalizedRects) {
  const pages = document.querySelectorAll('.react-pdf__Page');
  const pageEl = pages[pageIndex];
  if (!pageEl) return null;
  const pageRect = pageEl.getBoundingClientRect();
  const pixelRects = normalizedRects.map((n) => ({
    top: n.y * pageRect.height,
    left: n.x * pageRect.width,
    width: n.width * pageRect.width,
    height: n.height * pageRect.height,
  }));
  return { rects: pixelRects, normalizedRects };
}

async function resolveAnnotationLocation(ann) {
  let pd;
  try { pd = JSON.parse(ann.position_data); }
  catch { pd = { pixel_rects: ann.position_data }; }

  if (pd?.text_anchor?.selected_text) {
    const m = await findTextAnchorMatch(ann.page_index, pd.text_anchor);
    if (m) return { ...m, textAnchor: pd.text_anchor, method: 'text_anchor' };
  }
  if (Array.isArray(pd?.normalized_rects) && pd.normalized_rects.length) {
    const m = convertNormalizedToPixel(ann.page_index, pd.normalized_rects);
    if (m) return { ...m, textAnchor: pd.text_anchor || null, method: 'normalized' };
  }
  if (Array.isArray(pd?.pixel_rects)) {
    return { rects: pd.pixel_rects, normalizedRects: pd.normalized_rects || [], textAnchor: pd.text_anchor || null, method: 'pixel_legacy' };
  }
  if (Array.isArray(pd)) {
    return { rects: pd, normalizedRects: [], textAnchor: null, method: 'legacy_array' };
  }
  return { rects: [], normalizedRects: [], textAnchor: null, method: 'failed' };
}

// ──────────────────────────────────────────────────────────────────
// PageRenderer — one page + its right-column sticky notes
// ──────────────────────────────────────────────────────────────────

const PageRenderer = memo(function PageRenderer({
  index, style, scale,
  highlights, pendingHighlight, pageNotes,
  activeHighlightId, drawerState,
  onPageRenderSuccess, onHighlightClick, onOpenNote, noteRefs,
}) {
  // Sort notes by their highlight's first rect top, so they flow down the rail.
  const sortedNotes = useMemo(() => {
    return [...pageNotes].sort((a, b) => {
      const ha = highlights.find((h) => h.id === a.id);
      const hb = highlights.find((h) => h.id === b.id);
      return (ha?.rects?.[0]?.top || 0) - (hb?.rects?.[0]?.top || 0);
    });
  }, [pageNotes, highlights]);

  const drawerHere = drawerState && drawerState.pageIndex === index;

  return (
    <div style={style} className="page-and-notes-container">
      <div className="page-wrapper">
        <MemoizedPage
          pageNumber={index + 1}
          scale={scale}
          renderAnnotationLayer
          renderTextLayer
          onRenderSuccess={onPageRenderSuccess}
          customTextRenderer={(text) => text.str.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        >
          {highlights
            .filter((h) => h.pageIndex === index)
            .map((h) => (
              <React.Fragment key={h.id}>
                {(h.rects || []).map((rect, i) => {
                  const isActive = h.id === activeHighlightId;
                  const hasNote = !!h.noteBackendId;
                  return (
                    <div
                      key={i}
                      onClick={(e) => { e.stopPropagation(); onHighlightClick(h.id); }}
                      data-annotation-id={h.id}
                      style={{
                        position: 'absolute',
                        top: `${rect.top}px`,
                        left: `${rect.left}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                        cursor: 'pointer',
                        background: isActive
                          ? 'color-mix(in oklab, var(--accent) 45%, transparent)'
                          : hasNote
                            ? 'color-mix(in oklab, var(--accent) 28%, transparent)'
                            : 'color-mix(in oklab, var(--accent) 18%, transparent)',
                        boxShadow: hasNote ? 'inset 0 -2px 0 color-mix(in oklab, var(--accent) 60%, transparent)' : 'none',
                        transition: 'background 240ms, box-shadow 240ms',
                        mixBlendMode: 'multiply',
                      }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          {pendingHighlight && pendingHighlight.pageIndex === index &&
            pendingHighlight.rects.map((rect, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${rect.top}px`,
                  left: `${rect.left}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  background: 'color-mix(in oklab, var(--accent) 35%, transparent)',
                  mixBlendMode: 'multiply',
                }}
              />
            ))}
        </MemoizedPage>
      </div>

      <div className="notes-column">
        {sortedNotes.map((note) => {
          const openedInDrawer = drawerHere && drawerState.kind === 'edit' && drawerState.noteId === note.id;
          if (openedInDrawer) {
            // Leave a placeholder — the drawer itself is rendered at PdfScreen
            // top level so react-window's row remounts don't tear it down.
            return (
              <div key={`ph-${note.id}`} data-drawer-placeholder={note.id} style={{ minHeight: 1 }} />
            );
          }
          return (
            <div
              key={note.id}
              ref={(el) => { noteRefs.current[note.id] = el; }}
            >
              <StickyNote
                note={note}
                onOpen={() => onOpenNote(note)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────
// DrawerFloater
// Positions its child absolute-fixed on screen, tracking the target page's
// current viewport rect. Rendering the drawer here (instead of inside
// PageRenderer) keeps it mounted across react-window row recycling — so typed
// text persists through annotation reloads, page-height measurements, and
// index reshuffles.
// ──────────────────────────────────────────────────────────────────

function DrawerFloater({ drawer, children }) {
  // Always render children once `drawer` is set — hide via visibility/opacity
  // when the anchor page isn't in the DOM, so the drawer's typed state
  // survives the user scrolling the anchor page off-screen.
  const [anchor, setAnchor] = React.useState(null);

  React.useEffect(() => {
    if (!drawer) { setAnchor(null); return; }
    let raf = 0;
    const measure = () => {
      // react-pdf uses 1-indexed data-page-number; our pageIndex is 0-indexed.
      const pageEl = document.querySelector(
        `.react-pdf__Page[data-page-number="${drawer.pageIndex + 1}"]`
      );
      if (!pageEl) { setAnchor(null); return; }
      const r = pageEl.getBoundingClientRect();
      const top = Math.max(80, Math.min(window.innerHeight - 320, r.top + 16));
      setAnchor({ top, left: r.right + 24, visible: true });
    };
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    const scroller = document.querySelector('.pdf-screen .scroll');
    scroller?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Page heights re-measure after render — poll briefly so zoom/render
    // reflow doesn't strand the drawer.
    const interval = setInterval(measure, 400);
    return () => {
      scroller?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [drawer]);

  const offscreen = !anchor;
  return (
    <div
      style={{
        position: 'fixed',
        top: anchor?.top ?? 100,
        left: anchor?.left ?? -9999,
        width: 320,
        zIndex: 25,
        opacity: offscreen ? 0 : 1,
        pointerEvents: offscreen ? 'none' : 'auto',
        transition: 'opacity 200ms ease',
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PdfScreen
// ──────────────────────────────────────────────────────────────────

export default function PdfScreen({ docId, targetNoteId, onConsumedTarget, onExit, onStartReview }) {
  const [fileBlob, setFileBlob] = useState(null);
  const [fileMetadata, setFileMetadata] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [drawer, setDrawer] = useState(null); // null | {kind:'new', pageIndex, seedText, rects, normalizedRects, textAnchor, highlightedText} | {kind:'edit', pageIndex, noteId, initial}
  const [dueCount, setDueCount] = useState(0);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [chromeVisible, setChromeVisible] = useState(true);

  const listRef = useRef(null);
  const viewerRef = useRef(null);
  const pageHeights = useRef({});
  const noteRefs = useRef({});
  const lastScrollY = useRef(0);
  const savePosTimer = useRef(null);
  const chromeTimerRef = useRef(null);
  const consumedTargetRef = useRef(false);

  const doc = useMemo(() => (fileMetadata ? toLibraryDoc(fileMetadata) : null), [fileMetadata]);

  // Load the file blob + metadata. Fetch metadata first so we can pass the
  // file_hash as a cache-buster on the blob download — SQLite rowids get
  // recycled after a delete, and the browser would otherwise serve the
  // previous upload's cached bytes for the same /files/{id}/download URL.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meta = await apiService.getFile(docId);
        if (!alive) return;
        setFileMetadata(meta);
        if (meta?.zoom_level) setScale(meta.zoom_level);
        const blob = await apiService.downloadFile(docId, meta?.file_hash);
        if (!alive) return;
        setFileBlob(blob);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, [docId]);

  // Refresh due count
  const refreshDue = useCallback(async () => {
    if (!docId) return;
    try {
      const due = await apiService.getDueCards(docId);
      setDueCount((due.due_cards?.length || 0) + (due.new_cards?.length || 0) + (due.learning_cards?.length || 0));
    } catch { /* ignore */ }
  }, [docId]);

  useEffect(() => { refreshDue(); }, [refreshDue, notes.length]);

  // Document loaded
  const onDocLoad = useCallback(({ numPages: np }) => {
    setNumPages(np);
    // Persist page count if new
    if (fileMetadata && np !== fileMetadata.total_pages) {
      apiService.updateTotalPages(docId, np).catch(() => {});
    }
    // Restore scroll position after a tick
    setTimeout(() => {
      const saved = fileMetadata?.last_read_position || 0;
      if (listRef.current && saved > 0 && saved < np) {
        listRef.current.scrollToItem(saved, 'start');
      }
    }, 50);
  }, [docId, fileMetadata]);

  // Load annotations once the doc is rendered. `scale` is intentionally NOT a
  // dep — the annotations themselves don't depend on zoom; only their pixel
  // coordinates do, and those get re-resolved via the text-anchor fallback
  // chain at render time.
  useEffect(() => {
    if (!numPages || !docId) return;
    let alive = true;
    (async () => {
      try {
        const anns = await apiService.getAnnotations(docId);
        if (!alive) return;
        const resolved = await Promise.all(anns.map(async (a) => {
          const loc = await resolveAnnotationLocation(a);
          return { ann: a, loc };
        }));
        if (!alive) return;
        const hs = [];
        const ns = [];
        for (const { ann, loc } of resolved) {
          const localId = ann.annotation_id || `ann_${ann.id}`;
          hs.push({
            id: localId,
            pageIndex: ann.page_index,
            rects: loc.rects || [],
            normalizedRects: loc.normalizedRects || [],
            textAnchor: loc.textAnchor,
            noteBackendId: ann.id,
          });
          ns.push({
            id: localId,
            backendId: ann.id,
            pageIndex: ann.page_index,
            type: hasCloze(ann.question || '') ? 'cloze' : (ann.answer ? 'recall' : 'note'),
            prompt: ann.question || '',
            answer: ann.answer || '',
            highlightedText: ann.highlighted_text || '',
            tag: ann.tag || '',
            tags: (ann.tag || '').split(',').map((t) => t.trim()).filter(Boolean),
          });
        }
        setHighlights(hs);
        setNotes(ns);
      } catch (e) {
        console.warn('Failed to load annotations', e);
      }
    })();
    return () => { alive = false; };
  }, [numPages, docId]);

  // Save scale (debounced)
  useEffect(() => {
    if (!fileMetadata?.id) return;
    const t = setTimeout(() => {
      apiService.updateFileZoom(fileMetadata.id, scale).catch(() => {});
    }, 750);
    return () => clearTimeout(t);
  }, [scale, fileMetadata?.id]);

  // Page height estimate + react-window itemSize
  const getPageHeight = useCallback((i) => pageHeights.current[i] || 1188 * scale, [scale]);

  // When a page finishes rendering, update its height & re-measure the list
  const onPageRenderSuccess = useCallback((page) => {
    const idx = page._pageIndex;
    const h = page.height + 24;
    if (pageHeights.current[idx] !== h) {
      pageHeights.current[idx] = h;
      listRef.current?.resetAfterIndex(idx);
    }
  }, []);

  // Text selection — produces the pending highlight + add-note bubble
  const onViewerMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPendingHighlight(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const pageEl = range.startContainer.parentElement?.closest('.react-pdf__Page');
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const sel = selection.toString();
    if (!sel || sel.length < 3) return;
    const fullPageText = pageEl.textContent || '';
    const selStart = fullPageText.indexOf(sel);
    const textAnchor = {
      selected_text: sel,
      prefix: selStart > 0 ? fullPageText.substring(Math.max(0, selStart - 20), selStart) : '',
      suffix: selStart >= 0 ? fullPageText.substring(selStart + sel.length, selStart + sel.length + 20) : '',
      char_start: selStart,
      char_end: selStart + sel.length,
      page_text_hash: hashString(fullPageText),
    };
    const clientRects = Array.from(range.getClientRects());
    const normalizedRects = clientRects.map((r) => ({
      x: (r.left - pageRect.left) / pageRect.width,
      y: (r.top - pageRect.top) / pageRect.height,
      width: r.width / pageRect.width,
      height: r.height / pageRect.height,
    }));
    const pixelRects = clientRects.map((r) => ({
      top: r.top - pageRect.top,
      left: r.left - pageRect.left,
      width: r.width,
      height: r.height,
    }));
    const bubbleTop = range.getBoundingClientRect().bottom + 8;
    const bubbleLeft = range.getBoundingClientRect().left;
    setPendingHighlight({
      pageIndex: parseInt(pageEl.dataset.pageNumber, 10) - 1,
      rects: pixelRects,
      normalizedRects,
      textAnchor,
      highlightedText: sel,
      bubble: { x: bubbleLeft, y: bubbleTop },
    });
  }, []);

  // Begin capture drawer from a pending selection
  const beginNewFromSelection = useCallback(() => {
    if (!pendingHighlight) return;
    setDrawer({
      kind: 'new',
      pageIndex: pendingHighlight.pageIndex,
      seedText: '',
      rects: pendingHighlight.rects,
      normalizedRects: pendingHighlight.normalizedRects,
      textAnchor: pendingHighlight.textAnchor,
      highlightedText: pendingHighlight.highlightedText,
    });
    setPendingHighlight(null);
    window.getSelection()?.removeAllRanges?.();
  }, [pendingHighlight]);

  // Save drawer → create or update annotation
  const handleSaveDrawer = useCallback(async (draft) => {
    if (!drawer) return;
    const enriched = {
      pixel_rects: drawer.kind === 'new' ? drawer.rects : highlights.find((h) => h.id === drawer.highlightId)?.rects || [],
      normalized_rects: drawer.kind === 'new' ? drawer.normalizedRects : highlights.find((h) => h.id === drawer.highlightId)?.normalizedRects || [],
      text_anchor: drawer.kind === 'new' ? drawer.textAnchor : (highlights.find((h) => h.id === drawer.highlightId)?.textAnchor || null),
      metadata: {
        page_text_hash: (drawer.kind === 'new' ? drawer.textAnchor?.page_text_hash : null) || '',
        selection_timestamp: new Date().toISOString(),
        scale,
        version: '1.0',
      },
    };

    try {
      if (drawer.kind === 'new') {
        const localId = `ann_${Date.now()}`;
        const payload = {
          annotation_id: localId,
          page_index: drawer.pageIndex,
          question: draft.prompt || '',
          answer: draft.answer || '',
          highlighted_text: drawer.highlightedText || '',
          position_data: JSON.stringify(enriched),
          tag: draft.tag || '',
          deck: 'Default',
        };
        const created = await apiService.createAnnotation(docId, payload);
        // Also create the study card so it enters the review queue.
        try { await apiService.createStudyCard(created.id); }
        catch (e) { console.warn('createStudyCard failed', e); }

        setHighlights((hs) => [...hs, {
          id: localId,
          pageIndex: drawer.pageIndex,
          rects: drawer.rects,
          normalizedRects: drawer.normalizedRects,
          textAnchor: drawer.textAnchor,
          noteBackendId: created.id,
        }]);
        setNotes((ns) => [...ns, {
          id: localId,
          backendId: created.id,
          pageIndex: drawer.pageIndex,
          type: draft.type,
          prompt: draft.prompt || '',
          answer: draft.answer || '',
          highlightedText: drawer.highlightedText || '',
          tag: draft.tag || '',
          tags: Array.isArray(draft.tags) ? draft.tags : [],
        }]);
      } else if (drawer.kind === 'edit') {
        const note = notes.find((n) => n.id === drawer.noteId);
        if (!note?.backendId) throw new Error('missing backend id');
        await apiService.updateAnnotation(note.backendId, {
          question: draft.prompt || '',
          answer: draft.answer || '',
          highlighted_text: note.highlightedText || '',
          position_data: JSON.stringify(enriched),
          tag: draft.tag || '',
        });
        setNotes((ns) =>
          ns.map((n) =>
            n.id === drawer.noteId
              ? { ...n, type: draft.type, prompt: draft.prompt || '', answer: draft.answer || '', tag: draft.tag || '', tags: Array.isArray(draft.tags) ? draft.tags : [] }
              : n
          )
        );
      }
      setDrawer(null);
      setActiveHighlightId(null);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    }
  }, [drawer, docId, highlights, notes, scale]);

  const handleDeleteDrawer = useCallback(async () => {
    if (!drawer || drawer.kind !== 'edit') return;
    const note = notes.find((n) => n.id === drawer.noteId);
    if (!note) return;
    try {
      if (note.backendId) await apiService.deleteAnnotation(note.backendId);
    } catch (e) {
      console.warn('delete failed', e);
    }
    setHighlights((hs) => hs.filter((h) => h.id !== note.id));
    setNotes((ns) => ns.filter((n) => n.id !== note.id));
    setDrawer(null);
    setActiveHighlightId(null);
  }, [drawer, notes]);

  const handleCancelDrawer = useCallback(() => {
    setDrawer(null);
    setActiveHighlightId(null);
  }, []);

  const handleHighlightClick = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveHighlightId(id);
    setDrawer({
      kind: 'edit',
      pageIndex: note.pageIndex,
      noteId: id,
      highlightId: id,
      initial: {
        type: note.type,
        prompt: note.prompt,
        answer: note.answer,
        tags: note.tags,
      },
    });
  }, [notes]);

  const handleOpenNote = useCallback((note) => {
    handleHighlightClick(note.id);
  }, [handleHighlightClick]);

  // Target-note deep link from NotesScreen
  useEffect(() => {
    if (!targetNoteId || consumedTargetRef.current) return;
    if (!notes.length) return;
    const note = notes.find((n) => n.backendId === targetNoteId || n.id === String(targetNoteId));
    if (!note) return;
    consumedTargetRef.current = true;
    // Scroll to that page
    setTimeout(() => {
      if (listRef.current && note.pageIndex != null) {
        listRef.current.scrollToItem(note.pageIndex, 'start');
      }
      handleHighlightClick(note.id);
      onConsumedTarget?.();
    }, 80);
  }, [targetNoteId, notes, handleHighlightClick, onConsumedTarget]);

  // Scroll / chrome handling
  const handleListScroll = useCallback(({ scrollOffset }) => {
    const threshold = 50;
    if (scrollOffset < threshold) setChromeVisible(true);
    else if (scrollOffset > lastScrollY.current + 8) setChromeVisible(false);
    else if (scrollOffset < lastScrollY.current - 8) setChromeVisible(true);
    lastScrollY.current = scrollOffset;

    // current page from pageHeights accumulation
    let cum = 0, idx = 0;
    for (let i = 0; i < numPages; i++) {
      const h = getPageHeight(i);
      if (cum + h / 2 > scrollOffset) { idx = i; break; }
      cum += h;
      idx = i;
    }
    if (idx + 1 !== currentPage) setCurrentPage(idx + 1);

    if (!fileMetadata?.id) return;
    if (savePosTimer.current) clearTimeout(savePosTimer.current);
    savePosTimer.current = setTimeout(() => {
      apiService.updateReadPosition(fileMetadata.id, idx).catch(() => {});
    }, 750);
  }, [numPages, getPageHeight, currentPage, fileMetadata?.id]);

  // Chrome wake on mousemove/key/touch (in addition to scroll)
  useEffect(() => {
    const wake = () => {
      setChromeVisible(true);
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = setTimeout(() => setChromeVisible(false), 2600);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('touchstart', wake);
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, []);

  // Keyboard: arrows, Esc, zoom
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable') === 'true';
      if (inEditable) return;
      if (e.key === 'Escape') {
        if (drawer) setDrawer(null);
        else if (pendingHighlight) setPendingHighlight(null);
        else onExit();
      }
      if (e.key === 'ArrowRight' && listRef.current && numPages) {
        const next = Math.min(numPages - 1, currentPage);
        listRef.current.scrollToItem(next, 'start');
      }
      if (e.key === 'ArrowLeft' && listRef.current) {
        const prev = Math.max(0, currentPage - 2);
        listRef.current.scrollToItem(prev, 'start');
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setScale((s) => Math.min(3, s + 0.1));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.5, s - 0.1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, pendingHighlight, onExit, numPages, currentPage]);

  const notesByPage = useMemo(() => {
    const by = new Map();
    notes.forEach((n) => {
      const list = by.get(n.pageIndex) || [];
      list.push(n);
      by.set(n.pageIndex, list);
    });
    return by;
  }, [notes]);

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 16 }}>DOCUMENT ERROR</div>
          <div style={{ color: 'var(--ink-2)', marginBottom: 24 }}>{error}</div>
          <button className="btn" onClick={onExit}>Back to library</button>
        </div>
      </div>
    );
  }

  if (!fileBlob) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div className="mono-sm" style={{ color: 'var(--ink-4)' }}>Loading document…</div>
      </div>
    );
  }

  return (
    <div className="pdf-screen" style={{ position: 'fixed', inset: 0, background: 'var(--paper)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      {/* Top chrome */}
      <div
        style={{
          position: 'absolute',
          top: 16, left: 16, right: 16,
          zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: chromeVisible ? 1 : 0,
          transition: 'opacity 420ms ease',
          pointerEvents: chromeVisible ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper)', border: '1px solid var(--rule)', padding: '8px 12px', borderRadius: 'var(--rad)' }}>
          <button className="btn ghost xs" onClick={onExit}>
            <Ic.Left/> Library
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--rule)' }}/>
          {doc && <DocGlyph doc={doc} size={28}/>}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{doc?.title || 'Document'}</div>
            <div className="mono-sm" style={{ color: 'var(--ink-4)' }}>{doc?.authors || '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper)', border: '1px solid var(--rule)', padding: '6px 10px', borderRadius: 'var(--rad)' }}>
            <button
              className="btn ghost xs"
              onClick={() => listRef.current?.scrollToItem(Math.max(0, currentPage - 2), 'start')}
              aria-label="Previous page"
            >
              <Ic.Left/>
            </button>
            <div style={{ width: 140, position: 'relative' }}>
              <div style={{ height: 2, background: 'var(--rule)' }}/>
              <div style={{ position: 'absolute', top: 0, left: 0, height: 2, width: `${(currentPage / Math.max(1, numPages)) * 100}%`, background: 'var(--ink)', transition: 'width 220ms' }}/>
            </div>
            <div className="mono-sm" style={{ color: 'var(--ink-2)', minWidth: 72, textAlign: 'center' }}>{currentPage} / {numPages || '—'}</div>
            <button
              className="btn ghost xs"
              onClick={() => listRef.current?.scrollToItem(Math.min(numPages - 1, currentPage), 'start')}
              aria-label="Next page"
            >
              <Ic.Right/>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--paper)', border: '1px solid var(--rule)', padding: '3px 4px', borderRadius: 'var(--rad)' }}>
            <button
              className="btn ghost xs"
              onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 100) / 100))}
              disabled={scale <= 0.5}
              aria-label="Zoom out"
              style={{ padding: '4px 8px' }}
            >
              −
            </button>
            <button
              className="btn ghost xs"
              onClick={() => setScale(1.2)}
              title="Reset zoom"
              aria-label="Reset zoom"
              style={{ padding: '4px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', minWidth: 48, textAlign: 'center', justifyContent: 'center' }}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              className="btn ghost xs"
              onClick={() => setScale((s) => Math.min(3.0, Math.round((s + 0.1) * 100) / 100))}
              disabled={scale >= 3.0}
              aria-label="Zoom in"
              style={{ padding: '4px 8px' }}
            >
              +
            </button>
          </div>
          <div className="mono-sm" style={{ background: 'var(--paper)', border: '1px solid var(--rule)', padding: '9px 12px', borderRadius: 'var(--rad)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.Note color="var(--ink-3)"/> {notes.length}
          </div>
          {dueCount > 0 && (
            <button className="btn xs" onClick={() => onStartReview?.(docId)} title={`Review ${dueCount} due card${dueCount === 1 ? '' : 's'}`}>
              <Ic.Review/> Review {dueCount}
            </button>
          )}
        </div>
      </div>

      {/* Viewer */}
      <div
        ref={viewerRef}
        className="scroll"
        style={{ flex: 1, padding: '80px 0' }}
        onMouseUp={onViewerMouseUp}
      >
        <Document file={fileBlob} onLoadSuccess={onDocLoad}>
          {numPages > 0 && (
            <List
              ref={listRef}
              height={window.innerHeight - 0}
              itemCount={numPages}
              itemSize={getPageHeight}
              width={'100%'}
              onScroll={handleListScroll}
            >
              {({ index, style }) => (
                <PageRenderer
                  index={index}
                  style={style}
                  scale={scale}
                  highlights={highlights}
                  pendingHighlight={pendingHighlight}
                  pageNotes={notesByPage.get(index) || []}
                  activeHighlightId={activeHighlightId}
                  drawerState={drawer}
                  onPageRenderSuccess={onPageRenderSuccess}
                  onHighlightClick={handleHighlightClick}
                  onOpenNote={handleOpenNote}
                  noteRefs={noteRefs}
                />
              )}
            </List>
          )}
        </Document>
      </div>

      {/* Capture drawer — rendered at screen level so react-window row
          remounts don't tear its state down (it used to live inside
          PageRenderer and lose typed text every time the list re-measured). */}
      {drawer && (
        <DrawerFloater drawer={drawer}>
          <InlineCaptureDrawer
            variant="rail"
            title={drawer.kind === 'edit' ? 'EDITING NOTE' : 'NEW NOTE'}
            initial={drawer.kind === 'edit' ? drawer.initial : null}
            seedText={drawer.kind === 'new' ? (drawer.seedText || '') : ''}
            onSave={handleSaveDrawer}
            onCancel={handleCancelDrawer}
            onDelete={drawer.kind === 'edit' ? handleDeleteDrawer : undefined}
          />
        </DrawerFloater>
      )}

      {/* Selection bubble */}
      {pendingHighlight && pendingHighlight.bubble && (
        <div
          style={{
            position: 'fixed',
            left: pendingHighlight.bubble.x - 60,
            top: pendingHighlight.bubble.y,
            zIndex: 30,
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 'var(--rad)',
            padding: '4px',
            display: 'flex',
            gap: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={beginNewFromSelection}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--paper)',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ic.Plus/> Add note
          </button>
          <button
            onClick={() => setPendingHighlight(null)}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--paper)',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
              opacity: 0.5,
            }}
          >
            <Ic.Close/>
          </button>
        </div>
      )}
    </div>
  );
}
