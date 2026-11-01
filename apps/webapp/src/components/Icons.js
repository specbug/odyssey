import React from 'react';

// Line icons: 20×20, 1.5px stroke, round caps. Where no icon is clear, the
// UI uses a word instead.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

const icon = (path) => function Icon({ size = 20, ...rest }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" {...stroke} {...rest}>
      {path}
    </svg>
  );
};

export const Ic = {
  Library: icon(<><path d="M4 3.5h8a3 3 0 0 1 3 3v10H7a3 3 0 0 1-3-3z"/><path d="M15 16.5H7a3 3 0 0 0-3-3"/></>),
  Notes:   icon(<><path d="M4.5 3h8l3 3v11h-11z"/><path d="M7.5 8.5h5M7.5 11.5h5M7.5 14.5h3"/></>),
  Graph:   icon(<><circle cx="5" cy="6" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="11" cy="15" r="2"/><path d="M7 5.7l6-.4M6.1 7.7l3.8 5.6M14.3 6.9l-2.5 6.2"/></>),
  Review:  icon(<><path d="M6.5 3.5h10v10"/><path d="M3.5 6.5h10v10h-10z"/></>),
  Close:   icon(<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>),
  Left:    icon(<path d="M12 4.5L6.5 10l5.5 5.5"/>),
  Right:   icon(<path d="M8 4.5l5.5 5.5L8 15.5"/>),
  // Theme: system (half-filled disc), light (sun), dark (moon).
  System:  icon(<><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" stroke="none"/></>),
  Sun:     icon(<><circle cx="10" cy="10" r="3.25"/><path d="M10 2.5v1.75M10 15.75v1.75M17.5 10h-1.75M4.25 10H2.5M15.3 4.7l-1.24 1.24M5.94 14.06L4.7 15.3M15.3 15.3l-1.24-1.24M5.94 5.94L4.7 4.7"/></>),
  Moon:    icon(<path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2z"/>),
  Search:  icon(<><circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/></>),
};

export default Ic;
