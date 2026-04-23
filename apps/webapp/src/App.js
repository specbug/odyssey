import React, { useState, useEffect, useCallback } from 'react';
import Rail from './components/Rail';
import useTimeHue from './hooks/useTimeHue';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import NotesScreen from './screens/NotesScreen';
import PdfScreen from './screens/PdfScreen';
import ReviewScreen from './screens/ReviewScreen';

const LS_ROUTE = 'odyssey:route';
const LS_DOC = 'odyssey:docId';
const VALID_ROUTES = new Set(['home', 'library', 'notes', 'pdf', 'review']);

export default function App() {
  useTimeHue();

  const [docId, setDocId] = useState(() => {
    const v = localStorage.getItem(LS_DOC);
    return v ? Number(v) : null;
  });
  const [route, setRoute] = useState(() => {
    const r = localStorage.getItem(LS_ROUTE);
    if (r && VALID_ROUTES.has(r)) {
      // If the persisted route is 'pdf' but we have no docId, fall back to library
      // so the user lands somewhere real instead of an empty shell.
      if (r === 'pdf' && !localStorage.getItem(LS_DOC)) return 'library';
      // 'review' has no persisted fileId — always allow; scopeless review is fine.
      return r;
    }
    return 'home';
  });
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
            onStartReview={onStartReview}
          />
        )}
        {route === 'review' && (
          <ReviewScreen fileId={reviewFileId} onExit={onExit} onJumpToSource={onJumpToSource}/>
        )}
      </main>
    </div>
  );
}
