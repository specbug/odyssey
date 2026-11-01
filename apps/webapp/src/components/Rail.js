import React from 'react';
import Mark from './Mark';
import { Ic } from './Icons';

// Left navigation. The logo is the Home button. Hidden on the PDF and review
// routes (App decides).
export default function Rail({ route, onNav }) {
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
    </nav>
  );
}
