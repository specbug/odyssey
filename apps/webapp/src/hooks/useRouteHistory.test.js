import React, { useCallback, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import useRouteHistory from './useRouteHistory';

// Minimal stand-in for App.js's router: a route in state, driven by
// useRouteHistory on the way back.
function Harness({ boot = 'home' }) {
  const [route, setRoute] = useState(boot);
  const onPopRoute = useCallback((next) => setRoute(next), []);
  useRouteHistory(route, onPopRoute);
  return (
    <div>
      <div data-testid="route">{route}</div>
      <button onClick={() => setRoute('library')}>library</button>
      <button onClick={() => setRoute('pdf')}>pdf</button>
    </div>
  );
}

// jsdom implements pushState/replaceState but never fires popstate for them,
// so we model the stack ourselves and dispatch popstate on `back()`.
function stubHistory(initial = [{ state: null }]) {
  const stack = [...initial];
  let i = stack.length - 1;
  const real = window.history;
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: {
      pushState: (state) => { stack.splice(i + 1); stack.push({ state }); i = stack.length - 1; },
      replaceState: (state) => { stack[i] = { state }; },
      get state() { return stack[i].state; },
    },
  });
  return {
    stack,
    depth: () => stack.length,
    back: () => {
      if (i === 0) return;
      i -= 1;
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: stack[i].state }));
      });
    },
    restore: () => Object.defineProperty(window, 'history', { configurable: true, value: real }),
  };
}

describe('useRouteHistory', () => {
  let h;
  afterEach(() => h?.restore());

  test('seeds home under a deep boot route so Back reaches the main page', () => {
    h = stubHistory();
    render(<Harness boot="pdf"/>);
    expect(screen.getByTestId('route')).toHaveTextContent('pdf');

    h.back();
    expect(screen.getByTestId('route')).toHaveTextContent('home');
  });

  test('booting on home does not seed a redundant entry', () => {
    h = stubHistory();
    render(<Harness boot="home"/>);
    expect(h.depth()).toBe(1);
  });

  test('pushes one entry per route change and walks back through them', () => {
    h = stubHistory();
    render(<Harness boot="home"/>);

    act(() => { screen.getByText('library').click(); });
    act(() => { screen.getByText('pdf').click(); });
    expect(h.depth()).toBe(3);

    h.back();
    expect(screen.getByTestId('route')).toHaveTextContent('library');
    h.back();
    expect(screen.getByTestId('route')).toHaveTextContent('home');
  });

  test('a popstate-driven route change does not re-push the popped entry', () => {
    h = stubHistory();
    render(<Harness boot="home"/>);

    act(() => { screen.getByText('library').click(); });
    const depthAfterPush = h.depth();

    h.back();
    expect(screen.getByTestId('route')).toHaveTextContent('home');
    // The stack must not have grown; a feedback loop here would re-append
    // 'home' and make Back a no-op that never escapes.
    expect(h.depth()).toBe(depthAfterPush);
  });

  test('ignores a stateless popstate so the browser can leave the SPA', () => {
    h = stubHistory();
    render(<Harness boot="library"/>);

    // An entry we never stamped (anything from before the app booted).
    // Swallowing it into a route change would trap the user in the app.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(screen.getByTestId('route')).toHaveTextContent('library');
  });
});
