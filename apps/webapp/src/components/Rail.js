import React, { useState } from 'react';
import Mark from './Mark';
import { Ic } from './Icons';
import useTheme from '../hooks/useTheme';
import ThemeEcho from './ThemeEcho';

// The label names the current setting; clicking moves to the next.
const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
const THEME_ICON = { system: Ic.System, light: Ic.Sun, dark: Ic.Moon };

// Left navigation. The logo is the Home button. Hidden on the PDF and review
// routes (App decides).
export default function Rail({ route, onNav }) {
  const { theme, cycle } = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  // Bumped on each click; keys a fresh flicker so rapid clicks restart it.
  const [flick, setFlick] = useState(0);
  const btn = (target, label, Icon) => (
    <button
      className="rail-btn"
      aria-current={route === target ? 'page' : undefined}
      aria-label={label}
      title={label}
      onClick={() => onNav(target)}
    >
      <Icon/>
    </button>
  );

  return (
    <nav className="rail" aria-label="Main">
      <button
        className="rail-btn rail-mark"
        aria-current={route === 'home' ? 'page' : undefined}
        aria-label="Home"
        title="Home"
        onClick={() => onNav('home')}
      >
        <Mark/>
      </button>
      {btn('library', 'Library', Ic.Library)}
      {btn('notes', 'Notes', Ic.Notes)}
      {btn('graph', 'Graph', Ic.Graph)}
      {btn('review', 'Review', Ic.Review)}
      <button
        className="rail-btn rail-theme"
        aria-label={`${THEME_LABEL[theme]}. Change theme`}
        title={THEME_LABEL[theme]}
        onClick={() => { cycle(); setFlick((n) => n + 1); }}
      >
        {flick > 0 && <ThemeEcho key={flick}/>}
        <ThemeIcon key={`icon-${flick}`} className={flick > 0 ? 'theme-flash' : undefined}/>
      </button>
    </nav>
  );
}
