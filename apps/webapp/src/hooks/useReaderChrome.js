import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_MS = 2600;
const SCROLL_THRESHOLD = 12;
const NAVIGATION_SETTLE_MS = 600;

// Keep chrome changes independent of page layout and rendering. Ordinary
// pointer movement over the document must not wake the controls repeatedly.
export default function useReaderChrome(documentId, ready) {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const scroll = useRef({ y: 0, anchor: 0, direction: 0 });
  const ignoreScrollUntil = useRef(0);

  const cancelHide = useCallback(() => clearTimeout(timer.current), []);
  const scheduleHide = useCallback(() => {
    cancelHide();
    if (ready && !hovered.current && !focused.current) {
      timer.current = setTimeout(() => setVisible(false), IDLE_MS);
    }
  }, [ready, cancelHide]);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scroll.current = { y: 0, anchor: 0, direction: 0 };
    reveal();
    return cancelHide;
  }, [documentId, reveal, cancelHide]);

  // Page buttons and zoom can move the scroll position without a reading
  // gesture. Keep their feedback visible while the browser settles; genuine
  // wheel/touch/keyboard scrolling takes over immediately.
  const onNavigate = useCallback(() => {
    ignoreScrollUntil.current = Date.now() + NAVIGATION_SETTLE_MS;
    scroll.current.anchor = scroll.current.y;
    scroll.current.direction = 0;
    reveal();
  }, [reveal]);

  const resumeScroll = useCallback(() => {
    ignoreScrollUntil.current = 0;
  }, []);

  const onScroll = useCallback((element) => {
    // Clamp overscroll on touch devices and ignore horizontal scrolling.
    const y = Math.max(0, Math.min(element.scrollTop, element.scrollHeight - element.clientHeight));
    const delta = y - scroll.current.y;
    if (Date.now() < ignoreScrollUntil.current) {
      scroll.current = { y, anchor: y, direction: 0 };
      return;
    }
    if (!delta) return;
    let { anchor, direction } = scroll.current;
    // Measure a reversal from the furthest point, not from the last event:
    // a few noisy trackpad deltas must not swallow a real upward gesture.
    if (direction >= 0 && y <= anchor - SCROLL_THRESHOLD) {
      direction = -1;
      anchor = y;
    } else if (direction <= 0 && y >= anchor + SCROLL_THRESHOLD) {
      direction = 1;
      anchor = y;
    } else if (direction > 0) {
      anchor = Math.max(anchor, y);
    } else if (direction < 0) {
      anchor = Math.min(anchor, y);
    }
    scroll.current = { y, anchor, direction };

    if (y <= 8 || (direction < 0 && delta < 0)) {
      reveal();
    } else if (direction > 0 && delta > 0 && ready && !hovered.current && !focused.current) {
      cancelHide();
      setVisible(false);
    }
  }, [ready, reveal, cancelHide]);

  const revealAtTop = useCallback((event) => {
    if (event.clientY - event.currentTarget.getBoundingClientRect().top <= 64) reveal();
  }, [reveal]);

  return {
    visible,
    onScroll,
    onNavigate,
    readerProps: {
      onPointerMove: (event) => {
        if (event.pointerType !== 'touch') revealAtTop(event);
      },
      onPointerDown: revealAtTop,
      onWheelCapture: (event) => {
        if (!event.ctrlKey) resumeScroll();
      },
      onTouchMoveCapture: resumeScroll,
      onKeyDownCapture: (event) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) resumeScroll();
      },
    },
    chromeProps: {
      onPointerEnter: (event) => {
        // Touch pointerenter has no matching hover interaction to preserve.
        if (event.pointerType === 'touch') return;
        hovered.current = true;
        reveal();
      },
      onPointerLeave: () => {
        hovered.current = false;
        scheduleHide();
      },
      onFocusCapture: (event) => {
        // Mouse/touch clicks also focus buttons. Only keyboard focus should
        // pin chrome after the pointer leaves, otherwise it never fades again.
        focused.current = event.target.matches(':focus-visible');
        reveal();
      },
      onPointerDownCapture: () => {
        focused.current = false;
        scheduleHide();
      },
      onKeyDownCapture: () => {
        focused.current = true;
        reveal();
      },
      onBlurCapture: (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        focused.current = false;
        scheduleHide();
      },
    },
  };
}
