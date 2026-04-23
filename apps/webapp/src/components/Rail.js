import React from 'react';
import { Mark } from './Starburst';
import { Ic } from './Icons';

// Left navigation rail. Hidden on PDF and review routes (App decides).
export default function Rail({ route, onNav }) {
  const btn = (target, title, Icon) => (
    <button
      className="rail-btn"
      aria-current={route === target ? 'page' : undefined}
      onClick={() => onNav(target)}
      title={title}
    >
      <Icon/>
    </button>
  );

  return (
    <nav className="rail">
      <div className="rail-mark" title="Odyssey">
        <Mark size={26}/>
      </div>
      <div className="rail-group">
        {btn('home', 'Ritual', Ic.Home)}
        {btn('library', 'Library', Ic.Book)}
        {btn('notes', 'Notes', Ic.Note)}
        {btn('review', 'Review', Ic.Review)}
      </div>
      <div className="rail-spacer"/>
    </nav>
  );
}
