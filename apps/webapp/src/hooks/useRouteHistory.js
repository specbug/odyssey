import { useEffect, useRef } from 'react';

const KEY = 'odysseyRoute';

// Bridges the app's state-based router (App.js: useState + localStorage) to
// the browser's history stack, so Back / Forward do what the browser chrome
// promises.
//
// Why this exists: without a history entry per route change, Back walks
// straight *out* of the app — which is the wrong escape hatch when the user
// is stranded on a chrome-less route (pdf / review hide the rail) and wants
// to get back to the main page.
//
// `home` is seeded underneath the boot route so the first Back always lands
// somewhere real instead of leaving the app, even on a deep boot.
//
// `syncingRef` breaks the feedback loop: a popstate-driven setRoute would
// otherwise re-enter the push effect and re-append the entry we just popped.
export default function useRouteHistory(route, onPopRoute) {
  const syncingRef = useRef(false);
  const currentRef = useRef(route);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    try {
      window.history.replaceState({ [KEY]: 'home' }, '');
      if (route !== 'home') window.history.pushState({ [KEY]: route }, '');
    } catch {
      // history unavailable (sandboxed iframe) — rail nav still works.
    }
    // Seed once at mount; `route` is read as the boot value on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const next = e.state?.[KEY];
      // No state means an entry from before the app booted — let the
      // browser navigate away rather than trapping the user in the SPA.
      if (!next || next === currentRef.current) return;
      syncingRef.current = true;
      onPopRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onPopRoute]);

  useEffect(() => {
    if (currentRef.current === route) return;
    currentRef.current = route;
    if (syncingRef.current) {
      syncingRef.current = false;
      return;
    }
    try { window.history.pushState({ [KEY]: route }, ''); } catch { /* see above */ }
  }, [route]);
}
