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
  const [reviewFileId, setReviewFileId] = useState(null);

  useEffect(() => { localStorage.setItem(LS_ROUTE, route); }, [route]);
  useEffect(() => {
    if (docId != null) localStorage.setItem(LS_DOC, String(docId));
  }, [docId]);

  const onNav = useCallback((next) => {
    if (!VALID_ROUTES.has(next)) return;
    // Leaving review / pdf clears their transient state.
    if (next !== 'review') setReviewFileId(null);
    if (next !== 'pdf') setTargetNoteId(null);
    setRoute(next);
  }, []);

  const onOpenDoc = useCallback((id, noteId = null) => {
    setDocId(id);
    setTargetNoteId(noteId);
    setRoute('pdf');
  }, []);

  const onStartReview = useCallback((fileId = null) => {
    setReviewFileId(fileId);
    setRoute('review');
  }, []);

  const onExit = useCallback(() => {
    // Pop back to home by default; the previous route isn't preserved because
    // going through pdf → library would feel non-linear. Home is the anchor.
    setReviewFileId(null);
    setTargetNoteId(null);
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
            onConsumedTarget={onConsumedTarget}
            onExit={() => onNav('library')}
            onStartReview={onStartReview}
          />
        )}
        {route === 'review' && (
          <ReviewScreen fileId={reviewFileId} onExit={onExit}/>
        )}
      </main>
    </div>
  );
}
