import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
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

// US Letter height at 72pt/in = 11 × 72 = 792pt. Used as the placeholder-
// height fallback only during the microtask between Document load and
// pdf.js returning page 1's real viewport. PDFs may actually be A4 (842pt)
// or something else — the goal isn't pixel-accuracy for this window, just
// "close enough to a real page so a single frame of wrong layout doesn't
// shove the scroller around visibly."
const DEFAULT_PAGE_HEIGHT_PT = 792;
// 24px inter-page gap — matches padding-bottom on .page-and-notes-container.
const PAGE_GAP_PX = 24;

const MemoizedPage = memo(Page);

// Stable callback for react-pdf's text-layer renderer. Kept at module scope so
// the reference doesn't change across PageRenderer renders — an inline arrow
// here would invalidate MemoizedPage's props on every scroll tick, which was
// causing react-pdf to re-mount canvases during scroll and the fade-in to
// replay (visible as a continuous "refresh" feel while scrolling).
const escapeTextLayer = (text) => text.str.replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Shared empty array for PageRenderer's `pageNotes` prop when a page has no
// notes. Using a constant reference means pages without notes never see a
// prop-reference change just because the parent re-rendered.
const EMPTY_NOTES = Object.freeze([]);

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

// Parse an annotation's serialized position_data once; the result is handed to
// PageRenderer which resolves to actual pixel rects lazily at render time.
function parsePositionData(ann) {
  let pd;
  try { pd = JSON.parse(ann.position_data); }
  catch { pd = { pixel_rects: ann.position_data }; }
  if (Array.isArray(pd)) pd = { pixel_rects: pd };
  return {
    normalizedRects: Array.isArray(pd?.normalized_rects) ? pd.normalized_rects : [],
    textAnchor: pd?.text_anchor || null,
    pixelRectsFallback: Array.isArray(pd?.pixel_rects) ? pd.pixel_rects : [],
  };
}

// Resolve a highlight's rects in normalized page coordinates (0..1). Prefers
// server-stored normalized_rects; falls back to dividing legacy pixel_rects
// by the mounted page's measured size. Returns [] when neither format
// produces a usable rect so the sticky-rail gracefully treats the highlight
// as "not yet placed" rather than snapping to (0,0).
//
// `pageSize` is an optional pre-computed `{ width, height }` — callers that
// loop over multiple highlights on the same page should pass it in so we
// measure the page exactly once per render pass.
//
// Accepts both legacy `{top,left,width,height}` and modern `{x,y,width,height}`.
// Malformed rects (missing or non-finite size) are skipped per-rect.
function resolveRectsFromPage(h, pageElOrSize) {
  if (h.normalizedRects?.length) return h.normalizedRects;
  if (!h.pixelRectsFallback?.length || !pageElOrSize) return [];
  let width, height;
  if (typeof pageElOrSize.getBoundingClientRect === 'function') {
    const r = pageElOrSize.getBoundingClientRect();
    width = r.width; height = r.height;
  } else {
    width = pageElOrSize.width; height = pageElOrSize.height;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 10 || height < 10) return [];
  const out = [];
  for (const r of h.pixelRectsFallback) {
    const left = Number.isFinite(r?.left) ? r.left : (Number.isFinite(r?.x) ? r.x : null);
    const top = Number.isFinite(r?.top) ? r.top : (Number.isFinite(r?.y) ? r.y : null);
    const w = Number.isFinite(r?.width) ? r.width : null;
    const hh = Number.isFinite(r?.height) ? r.height : null;
    if (left == null || top == null || w == null || hh == null) continue;
    if (w <= 0 || hh <= 0) continue;
    out.push({
      x: left / width,
      y: top / height,
      width: w / width,
      height: hh / height,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// PageRenderer — one page + its right-column sticky notes
// ──────────────────────────────────────────────────────────────────

const PageRenderer = memo(function PageRenderer({
  index, scale,
  highlights, pendingHighlight, pageNotes,
  activeHighlightId, focusPulseId, drawerState,
  onPageRenderSuccess, onHighlightClick, onOpenNote, onPulseEnd, noteRefs,
}) {
  // Highlights for this specific page, with a helper to get the top-of-first-
  // rect as a fraction of page height (used below to anchor stickies).
  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.pageIndex === index),
    [highlights, index]
  );

  // Refs / state need to exist before `sortedNotes` reads them via
  // resolveRectsFromPage (which consults the mounted `<Page>` element to
  // normalize legacy pixel_rects).
  const noteElRefs = React.useRef({});
  const pageWrapperRef = React.useRef(null);
  const [notePositions, setNotePositions] = React.useState({});
  // Bumped whenever react-pdf paints this page so the layout effect below
  // re-reads the page's measured height. Without this, the first layout pass
  // runs against a 0-height page (canvas hasn't drawn yet) and stickies pin
  // to the column's top.
  const [renderTick, setRenderTick] = React.useState(0);

  // Sort notes by their highlight's first rect top (normalized 0..1) so they
  // flow down the rail in the same order as the highlights on the page.
  // For modern highlights we skip the DOM read entirely — `normalizedRects[0].y`
  // is already a page-relative fraction. Only legacy pixel_rects-only
  // highlights need a `getBoundingClientRect` read, and those are rare. The
  // `renderTick` dep keeps the sort fresh for legacy pages once the canvas
  // paints; for modern pages the memo is effectively deps-[pageNotes,
  // pageHighlights] and won't re-run on scroll.
  const sortedNotes = useMemo(() => {
    let pageSize = null;
    const topOf = (id) => {
      const hl = pageHighlights.find((h) => h.id === id);
      if (!hl) return 0;
      if (hl.normalizedRects?.length) return hl.normalizedRects[0]?.y ?? 0;
      // Lazy page-size read — only for legacy highlights.
      if (pageSize === null) {
        const pageEl = pageWrapperRef.current?.querySelector('.react-pdf__Page');
        if (pageEl) {
          const { width, height } = pageEl.getBoundingClientRect();
          pageSize = { width, height };
        } else {
          pageSize = { width: 0, height: 0 };
        }
      }
      return resolveRectsFromPage(hl, pageSize)[0]?.y ?? 0;
    };
    return [...pageNotes].sort((a, b) => topOf(a.id) - topOf(b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNotes, pageHighlights, renderTick]);

  const handleLocalPageRender = useCallback((page) => {
    setRenderTick((t) => t + 1);
    onPageRenderSuccess?.(page);
  }, [onPageRenderSuccess]);

  React.useLayoutEffect(() => {
    const pageEl = pageWrapperRef.current?.querySelector('.react-pdf__Page');
    if (!pageEl) return;
    const pageHeight = pageEl.getBoundingClientRect().height;
    if (pageHeight < 10) return; // page hasn't rendered its canvas yet
    const positions = {};
    let lastBottom = 0;
    sortedNotes.forEach((note) => {
      const hl = pageHighlights.find((h) => h.id === note.id);
      if (!hl) return;
      const topFrac = resolveRectsFromPage(hl, pageEl)[0]?.y;
      if (topFrac == null) return;
      const el = noteElRefs.current[note.id];
      const noteHeight = el?.offsetHeight || 80;
      const desired = Math.max(0, topFrac * pageHeight);
      const top = Math.max(desired, lastBottom + 10);
      positions[note.id] = top;
      lastBottom = top + noteHeight;
    });
    setNotePositions((prev) => {
      const keys = Object.keys(positions);
      if (keys.length === Object.keys(prev).length && keys.every((k) => Math.abs((prev[k] ?? -1) - positions[k]) < 0.5)) {
        return prev;
      }
      return positions;
    });
  }, [sortedNotes, pageHighlights, scale, renderTick]);

  const drawerHere = drawerState && drawerState.pageIndex === index;

  return (
    // Normal block flow. No virtualizer, no absolute positioning — the stack
    // of pages is just a long document. This means `margin: 0 auto` on the
    // inner container centers naturally. `data-page-row` lets the scroll
    // handler + restore path find this row by index via DOM query.
    <div data-page-row={index}>
      <div className="page-and-notes-container">
      <div className="page-wrapper" ref={pageWrapperRef}>
        {/* Page is rendered with *no children*. Putting overlays as children
            caused Page to re-render on every scroll tick (react-window hands
            PageRenderer a fresh `style` object per tick → PageRenderer
            re-renders → inline JSX children are fresh refs → memo(Page) skip
            fails → Page re-renders and its text-layer rebuilds → visible as
            a flicker on scroll). Making Page childless keeps its memo intact
            so scrolling touches nothing inside it. */}
        <MemoizedPage
          pageNumber={index + 1}
          scale={scale}
          renderAnnotationLayer
          renderTextLayer
          onRenderSuccess={handleLocalPageRender}
          customTextRenderer={escapeTextLayer}
        />

        {/* Highlight overlay — sibling of Page. page-wrapper has
            `position: relative` (see styles/pdf.css) and is sized by its
            content (the Page), so percentage positioning here resolves to
            the same box as if the overlay lived inside Page. */}
        {(() => {
          // Skip the DOM read entirely on pages where every highlight has
          // modern normalized_rects — getBoundingClientRect is a forced
          // layout read, and doing it on every scroll tick for every visible
          // page would churn layout. Only measure the page when at least
          // one highlight actually needs the legacy pixel_rects → normalized
          // fallback.
          const needsPageSize = pageHighlights.some((h) => !h.normalizedRects?.length && h.pixelRectsFallback?.length);
          let pageSize = null;
          if (needsPageSize) {
            const pageEl = pageWrapperRef.current?.querySelector('.react-pdf__Page');
            if (pageEl) {
              const { width, height } = pageEl.getBoundingClientRect();
              pageSize = { width, height };
            }
          }
          return pageHighlights.map((h) => {
            const rects = resolveRectsFromPage(h, pageSize);
            return (
              <React.Fragment key={h.id}>
                {rects.map((rect, i) => {
                  const isActive = h.id === activeHighlightId;
                  const hasNote = !!h.noteBackendId;
                  const isPulsing = h.id === focusPulseId;
                  // Marginalia-style mark: a thin accent underline reads as
                  // "a note lives here", with a gentle fill only when the
                  // highlight is the user's active focus. Keeps the accent
                  // rare per DESIGN.md §3 — the page reads as a page, not a
                  // UI state.
                  return (
                    <div
                      key={i}
                      onClick={(e) => { e.stopPropagation(); onHighlightClick(h.id); }}
                      data-annotation-id={h.id}
                      className={isPulsing ? 'highlight-focus-pulse' : undefined}
                      onAnimationEnd={isPulsing ? (e) => {
                        // Clear the pulse state when the CSS animation finishes
                        // playing. Earlier we used a fixed 1200ms timer, which
                        // raced with slow page paints — if the rect appeared
                        // after the timer fired, the class never attached.
                        // Animation-end is paint-synchronized, so it fires
                        // exactly when the pulse is done regardless of when
                        // the rect actually painted.
                        if (e.animationName === 'odyssey-focus-pulse') onPulseEnd?.(h.id);
                      } : undefined}
                      style={{
                        position: 'absolute',
                        top: `${rect.y * 100}%`,
                        left: `${rect.x * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                        cursor: 'pointer',
                        // pdf.js stamps z-index: 2 on its .textLayer; sit
                        // above so clicks reach this handler rather than
                        // getting swallowed by the text spans.
                        zIndex: 3,
                        background: isActive
                          ? 'color-mix(in oklab, var(--accent) 18%, transparent)'
                          : hasNote
                            ? 'color-mix(in oklab, var(--accent) 7%, transparent)'
                            : 'color-mix(in oklab, var(--accent) 10%, transparent)',
                        boxShadow: hasNote
                          ? isActive
                            ? 'inset 0 -2px 0 color-mix(in oklab, var(--accent) 78%, transparent)'
                            : 'inset 0 -1px 0 color-mix(in oklab, var(--accent) 45%, transparent)'
                          : 'none',
                        transition: 'background 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms cubic-bezier(.2,.7,.2,1)',
                        mixBlendMode: 'multiply',
                      }}
                    />
                  );
                })}
              </React.Fragment>
            );
          });
        })()}

        {pendingHighlight && pendingHighlight.pageIndex === index && pendingHighlight.rects.map((rect, i) => (
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
              zIndex: 3,
            }}
          />
        ))}
      </div>

      <div className="notes-column">
        {sortedNotes.map((note) => {
          const openedInDrawer = drawerHere && drawerState.kind === 'edit' && drawerState.noteId === note.id;
          const top = notePositions[note.id];
          if (openedInDrawer) {
            // Drawer is rendered at PdfScreen top level via DrawerFloater —
            // keep a placeholder in the normal flow only for measurement.
            return (
              <div key={`ph-${note.id}`} data-drawer-placeholder={note.id} style={{ minHeight: 1 }} />
            );
          }
          return (
            <div
              key={note.id}
              ref={(el) => {
                noteElRefs.current[note.id] = el;
                noteRefs.current[note.id] = el;
              }}
              style={{
                position: 'absolute',
                top: top != null ? `${top}px` : undefined,
                left: 0,
                right: 0,
                // Until positions are computed on the first layout pass,
                // don't render at (0,0) — let the fade cover the flash.
                opacity: top != null ? 1 : 0,
                transition: 'top 200ms cubic-bezier(.2,.7,.2,1), opacity 160ms',
              }}
            >
              <StickyNote
                note={note}
                active={note.id === activeHighlightId}
                onOpen={() => onOpenNote(note)}
              />
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────
// LazyPageRow — "mount once, never unmount" wrapper around PageRenderer
//
// The user's requirement was a book-reader feel: zero re-renders during
// normal scroll. Virtualization (react-window) unmounted pages beyond
// overscan, so scrolling back to them triggered a fresh canvas paint —
// visible as the "refresh" the user complained about. We removed the
// virtualizer entirely and replaced it with this: every page has a
// placeholder reserving its estimated height immediately, and an
// IntersectionObserver mounts the real PageRenderer content the first
// time the placeholder comes within 1500px of the viewport. Once
// mounted, we never unmount — the page's canvas lives for the rest of
// the session, so scrolling back to it is instant.
//
// Memory cost: ~3–5MB per rendered page canvas. A reader working
// through a 50-page chapter uses ~150–250MB; on a modern browser this
// is a non-issue. Very long documents (300+ pages, fully read) could
// push 1GB+ — if that becomes a real problem we can add an LRU cap
// later (unmount pages 100+ pages away from current).
// ──────────────────────────────────────────────────────────────────

const LazyPageRow = memo(function LazyPageRow({ index, estimatedHeight, ...pageRendererProps }) {
  const [mounted, setMounted] = useState(false);
  const placeholderRef = useRef(null);

  useEffect(() => {
    if (mounted) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      // 1500px lead on each side. On a 900-tall viewport that's ~1.5
      // pages of prefetch in both directions. Pages finish painting
      // well before the user's eyes reach them, even on fast scrolls.
      { rootMargin: '1500px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted) {
    return (
      <div
        ref={placeholderRef}
        data-page-row={index}
        data-page-placeholder={index}
        style={{ height: estimatedHeight }}
      />
    );
  }

  return <PageRenderer index={index} {...pageRendererProps} />;
});

// ──────────────────────────────────────────────────────────────────
// DrawerFloater
// Positions its child absolute-fixed on screen, tracking the target page's
// current viewport rect. Rendering the drawer here (instead of inside
// PageRenderer) keeps it mounted across page re-layouts so typed text
// persists through annotation reloads and height measurements.
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
      if (!pageEl) { setAnchor((prev) => (prev == null ? prev : null)); return; }
      const r = pageEl.getBoundingClientRect();
      const top = Math.max(80, Math.min(window.innerHeight - 320, r.top + 16));
      const left = r.right + 24;
      // Skip setState if nothing meaningful changed — the 400ms interval
      // would otherwise thrash a re-render twice a second for no reason.
      setAnchor((prev) => {
        if (prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5) return prev;
        return { top, left };
      });
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

export default function PdfScreen({ docId, targetNoteId, targetNoteMode = 'edit', onConsumedTarget, onExit, onStartReview }) {
  const [fileBlob, setFileBlob] = useState(null);
  const [fileMetadata, setFileMetadata] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  // When set, the matching highlight renders with `.highlight-focus-pulse`
  // — a one-shot outline pulse to tell the user "this is where you came
  // from." Cleared automatically after the animation settles.
  const [focusPulseId, setFocusPulseId] = useState(null);
  // Page 1's height at scale 1.0 (the PDF's intrinsic height). Fetched
  // once via `pdf.getPage(1).getViewport({scale: 1})` in onDocLoad — this
  // means we know accurate placeholder heights *before* any canvas is
  // painted, so the initial layout is correct and read-position restore
  // lands on the right page. Falls back to onPageRenderSuccess if the
  // viewport fetch fails.
  const [baseHeight, setBaseHeight] = useState(null);
  const [drawer, setDrawer] = useState(null); // null | {kind:'new', pageIndex, seedText, rects, normalizedRects, textAnchor, highlightedText} | {kind:'edit', pageIndex, noteId, initial}
  const [dueCount, setDueCount] = useState(0);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Chrome is always visible. Earlier iterations tried scroll-based hiding +
  // idle auto-hide; both felt like the viewer was refreshing. A persistent
  // 64px strip is cheaper than the cognitive cost of a toolbar that vanishes
  // mid-read.
  const chromeVisible = true;

  const scrollerRef = useRef(null);
  const viewerRef = useRef(null);
  const pageHeights = useRef({});
  const noteRefs = useRef({});
  const lastScrollY = useRef(0);
  const savePosTimer = useRef(null);
  const consumedTargetRef = useRef(false);
  // If the user had a saved `last_read_position > 0`, we hold it here
  // until page 1 has painted so the scroll math uses a real height
  // estimate (not the wild-guess fallback).
  const pendingRestoreRef = useRef(null);

  // Scroll to a given page index via DOM — each row carries its index in
  // `data-page-row={i}`, and the browser already knows where each element
  // sits in the scroller. No per-page height arithmetic (which drifts
  // with bad estimates); we just point at the element and let the native
  // scrollIntoView land on it.
  const scrollToPageIndex = useCallback((idx, align = 'start') => {
    const scroller = scrollerRef.current;
    if (!scroller || !Number.isFinite(idx) || idx < 0) return;
    const row = scroller.querySelector(`[data-page-row="${idx}"]`);
    if (!row) return;
    const block = align === 'center' ? 'center' : align === 'end' ? 'end' : 'start';
    row.scrollIntoView({ block, behavior: 'auto' });
  }, []);

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

  // Document loaded. In addition to wiring numPages, we fetch page 1's
  // intrinsic dimensions (scale=1.0) synchronously with pdf.js so every
  // placeholder row reserves the correct height on its first render.
  // Without this, every placeholder would fall back to DEFAULT_PAGE_HEIGHT_PT
  // (US Letter), which is off by hundreds of pixels for A4/Crown/etc, and
  // the scroll column would be the wrong length — which makes read-position restore
  // land on the wrong page and the current-page counter read wrong too.
  //
  // The saved read position is held in `pendingRestoreRef` and executed
  // once `baseHeight` is in state (see useEffect below), so we scroll
  // only after the accurate estimate propagates to placeholders.
  const onDocLoad = useCallback(async (pdf) => {
    const np = pdf.numPages;
    setNumPages(np);
    if (fileMetadata && np !== fileMetadata.total_pages) {
      apiService.updateTotalPages(docId, np).catch(() => {});
    }
    try {
      const page1 = await pdf.getPage(1);
      const vp = page1.getViewport({ scale: 1.0 });
      setBaseHeight(vp.height);
    } catch {
      // fall through — page-1 paint in onPageRenderSuccess will set baseHeight
    }
    // Only restore last-read position when the user isn't being routed to
    // a specific note (NotesScreen deep-link or Review → Open source).
    // Otherwise the restore scroll would race against the note-focus scroll
    // and sometimes win, stranding the user on the wrong page.
    const saved = fileMetadata?.last_read_position || 0;
    if (saved > 0 && saved < np && targetNoteId == null) {
      pendingRestoreRef.current = saved;
    }
  }, [docId, fileMetadata, targetNoteId]);

  // Execute pending read-position restore once baseHeight is set (so
  // placeholder heights are accurate) and the target row is in the DOM.
  useEffect(() => {
    if (baseHeight == null) return;
    const target = pendingRestoreRef.current;
    if (target == null) return;
    pendingRestoreRef.current = null;
    // One frame for placeholders to re-render at the new estimate.
    requestAnimationFrame(() => {
      const row = scrollerRef.current?.querySelector(`[data-page-row="${target}"]`);
      if (row) row.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }, [baseHeight]);

  // Load annotations once the doc + metadata are ready. We store raw parsed
  // position data on each highlight; PageRenderer resolves to actual pixel
  // rects lazily using the currently-mounted page's dimensions. That way
  // resolution is correct regardless of which pages react-window has in DOM
  // at load time, and stays correct through zoom changes.
  useEffect(() => {
    if (!numPages || !docId) return;
    let alive = true;
    (async () => {
      try {
        const anns = await apiService.getAnnotations(docId);
        if (!alive) return;
        const hs = [];
        const ns = [];
        for (const ann of anns) {
          const localId = ann.annotation_id || `ann_${ann.id}`;
          const pd = parsePositionData(ann);
          hs.push({
            id: localId,
            pageIndex: ann.page_index,
            normalizedRects: pd.normalizedRects,
            textAnchor: pd.textAnchor,
            pixelRectsFallback: pd.pixelRectsFallback,
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

  // Per-page height. Painted pages use their measured height; unpainted
  // ones use baseHeight (page 1's intrinsic height at scale 1.0) × current
  // scale. DEFAULT_PAGE_HEIGHT_PT is the tiny-window fallback — see the
  // comment where that constant is declared.
  const getPageHeight = useCallback((i) => {
    const cached = pageHeights.current[i];
    if (cached != null) return cached;
    const basePt = baseHeight ?? DEFAULT_PAGE_HEIGHT_PT;
    return Math.round(basePt * scale) + PAGE_GAP_PX;
  }, [scale, baseHeight]);

  // When a page finishes rendering, cache its measured height. Also fill
  // in baseHeight from page 1 if onDocLoad's getViewport read failed.
  const onPageRenderSuccess = useCallback((page) => {
    const pageNumber = page?.pageNumber;
    if (!pageNumber) return;
    const idx = pageNumber - 1;
    const h = Math.round(page.height) + PAGE_GAP_PX;
    if (pageHeights.current[idx] !== h) {
      pageHeights.current[idx] = h;
    }
    if (idx === 0 && baseHeight == null) {
      // page.height is at current scale; store the scale=1 equivalent.
      setBaseHeight(page.height / scale);
    }
  }, [baseHeight, scale]);

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
    const existing = drawer.kind === 'edit'
      ? highlights.find((h) => h.id === drawer.highlightId)
      : null;
    const enriched = {
      pixel_rects: drawer.kind === 'new' ? drawer.rects : (existing?.pixelRectsFallback || []),
      normalized_rects: drawer.kind === 'new' ? drawer.normalizedRects : (existing?.normalizedRects || []),
      text_anchor: drawer.kind === 'new' ? drawer.textAnchor : (existing?.textAnchor || null),
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
          normalizedRects: drawer.normalizedRects,
          textAnchor: drawer.textAnchor,
          pixelRectsFallback: drawer.rects,
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

  // Click the highlight on the PDF: emphasize the linked sticky (activeHighlightId
  // toggles its "active" state). No drawer — user clicks the sticky to edit.
  const handleHighlightClick = useCallback((id) => {
    setActiveHighlightId((prev) => (prev === id ? null : id));
  }, []);

  // Fires when the CSS pulse animation ends — clear focusPulseId so the
  // class detaches and the rect is eligible to be pulsed again if the
  // user jumps to it a second time.
  const handlePulseEnd = useCallback((id) => {
    setFocusPulseId((prev) => (prev === id ? null : prev));
  }, []);

  // Click the sticky: open the capture drawer in edit mode.
  const handleOpenNote = useCallback((note) => {
    setActiveHighlightId(note.id);
    setDrawer({
      kind: 'edit',
      pageIndex: note.pageIndex,
      noteId: note.id,
      highlightId: note.id,
      initial: {
        type: note.type,
        prompt: note.prompt,
        answer: note.answer,
        tags: note.tags,
      },
    });
  }, []);

  // Target-note deep link — branches on mode:
  //   `edit`  (default, from NotesScreen row click) opens the capture drawer.
  //   `focus` (from Review → Open source) scrolls the page into view and
  //           emphasizes the highlight with a one-shot pulse, no drawer.
  useEffect(() => {
    if (!targetNoteId || consumedTargetRef.current) return;
    if (!notes.length) return;
    const note = notes.find((n) => n.backendId === targetNoteId || n.id === String(targetNoteId));
    if (!note) return;
    consumedTargetRef.current = true;

    if (targetNoteMode === 'focus') {
      setTimeout(() => {
        if (note.pageIndex != null) {
          scrollToPageIndex(note.pageIndex, 'center');
        }
        setActiveHighlightId(note.id);
        setFocusPulseId(note.id);
        // NOTE: we don't clear focusPulseId on a timer any more. The CSS
        // animation runs once (520ms) when the class first attaches to
        // the rect and settles naturally; leaving focusPulseId set doesn't
        // cause the rect to keep pulsing. Clearing it on a fixed timer
        // caused a race: if the target page's canvas painted slowly (which
        // happens on first load of a doc with many annotations), the rect
        // didn't render until *after* focusPulseId was cleared, and the
        // pulse class never attached at all.
        onConsumedTarget?.();
      }, 80);
      return;
    }

    setTimeout(() => {
      if (note.pageIndex != null) {
        scrollToPageIndex(note.pageIndex, 'start');
      }
      // Deep-link from NotesScreen opens the note for edit.
      handleOpenNote(note);
      onConsumedTarget?.();
    }, 80);
  }, [targetNoteId, targetNoteMode, notes, handleOpenNote, onConsumedTarget, scrollToPageIndex]);

  // Native scroll handler on the scroller div. Tracks current page index
  // from pageHeights and debounces a read-position save. No react-window
  // machinery to coordinate with — just the real scrollTop of the real div.
  const onScrollerScroll = useCallback((e) => {
    const scrollOffset = e.currentTarget.scrollTop;
    lastScrollY.current = scrollOffset;

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

  // Chrome visibility is driven purely by scroll position (see handleListScroll).
  // Originally it also auto-hid on idle and woke on every mousemove / keypress
  // / touchstart — the continuous opacity cycle that caused made the whole
  // viewer feel like it was refreshing constantly.

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
      if (e.key === 'ArrowRight' && numPages) {
        const next = Math.min(numPages - 1, currentPage);
        scrollToPageIndex(next, 'start');
      }
      if (e.key === 'ArrowLeft') {
        const prev = Math.max(0, currentPage - 2);
        scrollToPageIndex(prev, 'start');
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
              onClick={() => scrollToPageIndex(Math.max(0, currentPage - 2), 'start')}
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
              onClick={() => scrollToPageIndex(Math.min(numPages - 1, currentPage), 'start')}
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

      {/* Viewer — native-scroll container. This is the only thing that
          scrolls; each LazyPageRow lives in normal block flow inside. */}
      <div
        ref={(el) => { scrollerRef.current = el; viewerRef.current = el; }}
        className="scroll"
        style={{ flex: 1, padding: '80px 0' }}
        onMouseUp={onViewerMouseUp}
        onScroll={onScrollerScroll}
      >
        <Document file={fileBlob} onLoadSuccess={onDocLoad}>
          {numPages > 0 && (
            // Plain stacked list — no virtualizer. Each LazyPageRow mounts
            // its page on first proximity to the viewport and never
            // unmounts. That's what makes scrolling feel like reading:
            // every page you've passed stays painted, so scrolling back
            // is instant.
            Array.from({ length: numPages }, (_, index) => (
              <LazyPageRow
                key={index}
                index={index}
                estimatedHeight={getPageHeight(index)}
                scale={scale}
                highlights={highlights}
                pendingHighlight={pendingHighlight}
                pageNotes={notesByPage.get(index) || EMPTY_NOTES}
                activeHighlightId={activeHighlightId}
                focusPulseId={focusPulseId}
                drawerState={drawer}
                onPageRenderSuccess={onPageRenderSuccess}
                onHighlightClick={handleHighlightClick}
                onOpenNote={handleOpenNote}
                onPulseEnd={handlePulseEnd}
                noteRefs={noteRefs}
              />
            ))
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
