import { useCallback, useEffect, useState } from 'react';

// Light, dark, or follow the system. Remembered per browser in localStorage.
// 'system' removes the attribute so tokens.css falls back to
// prefers-color-scheme; 'light' / 'dark' pin it via data-theme on <html>.
// public/index.html applies the stored choice before first paint, so a
// pinned theme never flashes the system one on load.

export const THEME_KEY = 'odyssey:theme';
export const THEMES = ['system', 'light', 'dark'];

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

// Browser chrome colour (mobile address bar, PWA title bar), matching --ground.
const GROUND = { light: '#f5f6f7', dark: '#0f1112' };

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  // index.html carries one theme-color per scheme; a pinned theme sets both.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const scheme = /dark/.test(m.media) ? 'dark' : 'light';
    m.content = GROUND[theme === 'system' ? scheme : theme];
  });
}

export default function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch { /* private mode: the choice lasts for this page only */ }
  }, [theme]);

  // system → light → dark → system
  const cycle = useCallback(() => {
    setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  }, []);

  return { theme, setTheme, cycle };
}
