import React, { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Rail from './components/Rail';
import useRouteHistory from './hooks/useRouteHistory';
import useTimeHue from './hooks/useTimeHue';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import NotesScreen from './screens/NotesScreen';
import PdfScreen from './screens/PdfScreen';
import ReviewScreen from './screens/ReviewScreen';

const LS_ROUTE = 'odyssey:route';
const LS_DOC = 'odyssey:docId';
const VALID_ROUTES = new Set(['home', 'library', 'notes', 'pdf', 'review']);
// Routes that hide the rail. Nothing on screen guarantees a way out of these,
// so they get special treatment on reload (see `initialRoute`).
const CHROMELESS_ROUTES = new Set(['pdf', 'review']);

// True when this page load came from a refresh (F5 / ⌘R / hard reload) rather
// than a fresh visit or a history navigation.
function wasReload() {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav) return nav.type === 'reload';
    return performance.navigation?.type === 1; // Safari < 15
  } catch {
    return false;
  }
}

function initialRoute() {
  const r = localStorage.getItem(LS_ROUTE);
  if (!r || !VALID_ROUTES.has(r)) return 'home';
  // A refresh is the user's universal "get me out of here" gesture. Restoring
  // a chrome-less route after one re-strands them — most visibly when a PDF
  // hangs mid-download on a slow link and refreshing drops you back into the
  // same hang. Land on home instead. library / notes keep the rail, so they
  // are never a trap and stay restored.
  if (CHROMELESS_ROUTES.has(r) && wasReload()) return 'home';
  // If the persisted route is 'pdf' but we have no docId, fall back to library
  // so the user lands somewhere real instead of an empty shell.
  if (r === 'pdf' && !localStorage.getItem(LS_DOC)) return 'library';
  // 'review' has no persisted fileId — always allow; scopeless review is fine.
  return r;
}

export default function App() {
  useTimeHue();

  const [docId, setDocId] = useState(() => {
    const v = localStorage.getItem(LS_DOC);
    return v ? Number(v) : null;
  });
  const [route, setRoute] = useState(initialRoute);
  const [targetNoteId, setTargetNoteId] = useState(null);
  // `edit` opens the drawer on the note (NotesScreen deep-link default).
  // `focus` scrolls to the note and briefly emphasizes the highlight
  // (Review → Open Source affordance). Must always be reset on every
  // `onOpenDoc` to avoid a stale focus-mode leaking into NotesScreen.
  const [targetNoteMode, setTargetNoteMode] = useState('edit');
  const [reviewFileId, setReviewFileId] = useState(null);

  useEffect(() => { localStorage.setItem(LS_ROUTE, route); }, [route]);
  useEffect(() => {
    if (docId != null) localStorage.setItem(LS_DOC, String(docId));
  }, [docId]);

  const onNav = useCallback((next) => {
    if (!VALID_ROUTES.has(next)) return;
    // Leaving review / pdf clears their transient state.
    if (next !== 'review') setReviewFileId(null);
    if (next !== 'pdf') {
      setTargetNoteId(null);
      setTargetNoteMode('edit');
    }
    setRoute(next);
  }, []);

  const onGoHome = useCallback(() => onNav('home'), [onNav]);

  // Browser Back / Forward. A popped 'pdf' entry is only honoured while we
  // still know which document it referred to — otherwise Back would land on
  // an empty shell, which is the failure this whole path exists to prevent.
  const onPopRoute = useCallback((next) => {
    if (next === 'pdf' && docId == null) {
      onNav('home');
      return;
    }
    onNav(next);
  }, [onNav, docId]);

  useRouteHistory(route, onPopRoute);

  const onOpenDoc = useCallback((id, noteId = null, mode = 'edit') => {
    setDocId(id);
    setTargetNoteId(noteId);
    setTargetNoteMode(mode);
    setRoute('pdf');
  }, []);

  const onStartReview = useCallback((fileId = null) => {
    setReviewFileId(fileId);
    setRoute('review');
  }, []);

  // Review → PDF jump-to-source. Mirrors `onOpenDoc` but always in focus mode,
  // and clears review state before navigating so the session ends cleanly.
  const onJumpToSource = useCallback((fileId, annotationBackendId) => {
    if (fileId == null) return;
    setReviewFileId(null);
    setDocId(fileId);
    setTargetNoteId(annotationBackendId);
    setTargetNoteMode('focus');
    setRoute('pdf');
  }, []);

  const onExit = useCallback(() => {
    // Pop back to home by default; the previous route isn't preserved because
    // going through pdf → library would feel non-linear. Home is the anchor.
    setReviewFileId(null);
    setTargetNoteId(null);
    setTargetNoteMode('edit');
    setRoute('home');
  }, []);

  const onConsumedTarget = useCallback(() => setTargetNoteId(null), []);

  return (
    <div className="app" data-screen-label={route}>
      {route !== 'pdf' && route !== 'review' && (
        <Rail route={route} onNav={onNav}/>
      )}
      <main className="main">
        {/* Keyed by route so navigating away from a crashed screen resets it. */}
        <ErrorBoundary key={route} onGoHome={onGoHome}>
          {route === 'home' && (
            <HomeScreen onNav={onNav} onOpenDoc={onOpenDoc} onStartReview={onStartReview}/>
          )}
          {route === 'library' && (
            <LibraryScreen onOpenDoc={onOpenDoc} onStartReview={onStartReview}/>
          )}
          {route === 'notes' && (
            <NotesScreen onOpenDoc={onOpenDoc} onStartReview={onStartReview}/>
          )}
          {route === 'pdf' && docId != null && (
            <PdfScreen
              docId={docId}
              targetNoteId={targetNoteId}
              targetNoteMode={targetNoteMode}
              onConsumedTarget={onConsumedTarget}
              onExit={() => onNav('library')}
              onGoHome={onGoHome}
              onStartReview={onStartReview}
            />
          )}
          {route === 'review' && (
            <ReviewScreen fileId={reviewFileId} onExit={onExit} onJumpToSource={onJumpToSource}/>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
