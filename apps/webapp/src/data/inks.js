// Inks: the app's colour, as marks and fields, never as running text.
//
// DOC_INKS are the document inks. Each PDF gets one when it's created
// (PDFFile.ink on the server, app/inks.py) and keeps it for good, so the
// index into this list is stored data: append to it, never reorder or remove.
// The order skips round the colour wheel (seven steps of 17), so documents
// uploaded one after another get unrelated colours.
//
// Every ink has the same tones:
//   mark      the ink itself: dots, card edges, highlights, cloze underlines
//   paper     text in the ink on the light ground, darkened to clear 4.5:1
//   dark      text in the ink on the dark ground, lightened to clear 4.5:1
//   markDark  the mark lifted where it would sink into the dark ground
//   field     the review screen in light mode (nudged so its type clears 4.5:1)
//   fieldFg   'dark' or 'light' type on that field, whichever contrasts more
//   darkField the review screen in dark mode: graphite tinted towards the ink
//
// ROLE_INKS are kept out of the document set and mean the same thing
// everywhere: link (follow or act), data (intervals and counts), you (where
// you are). tokens.css carries their values as --link, --data and --you.

export const DOC_INKS = [
  { key: 'bubblegum', name: 'Bubblegum', mark: '#ff6b9a', paper: '#cc3b70', dark: '#ff6b9a', markDark: '#ff84a7', field: '#ff6b9a', fieldFg: 'dark', darkField: '#261117' },
  { key: 'green', name: 'Green', mark: '#5fe08a', paper: '#018341', dark: '#5fe08a', markDark: '#5fe08a', field: '#5fe08a', fieldFg: 'dark', darkField: '#0b1d10' },
  { key: 'orchid', name: 'Orchid', mark: '#d46cff', paper: '#a940d2', dark: '#d46cff', markDark: '#db8afe', field: '#d46cff', fieldFg: 'dark', darkField: '#1e1323' },
  { key: 'lemon', name: 'Lemon', mark: '#ffd23f', paper: '#8a6e02', dark: '#ffd23f', markDark: '#ffd23f', field: '#ffd23f', fieldFg: 'dark', darkField: '#1e1804' },
  { key: 'cobalt', name: 'Cobalt', mark: '#2a5bd7', paper: '#2a5bd7', dark: '#457bfa', markDark: '#8ab0ff', field: '#2a5bd7', fieldFg: 'light', darkField: '#101828' },
  { key: 'coral', name: 'Coral', mark: '#ff5d5d', paper: '#d5343b', dark: '#ff5d5d', markDark: '#fe8a85', field: '#ff5d5d', fieldFg: 'dark', darkField: '#261210' },
  { key: 'emerald', name: 'Emerald', mark: '#00a95c', paper: '#058447', dark: '#00a95c', markDark: '#47ce7f', field: '#00a95c', fieldFg: 'dark', darkField: '#0a1d11' },
  { key: 'magenta', name: 'Magenta', mark: '#ff3ec9', paper: '#d502a4', dark: '#ff3ec9', markDark: '#ff7ad2', field: '#ff3ec9', fieldFg: 'dark', darkField: '#23121d' },
  { key: 'acid', name: 'Acid', mark: '#c6ff3d', paper: '#5e7d04', dark: '#c6ff3d', markDark: '#c6ff3d', field: '#c6ff3d', fieldFg: 'dark', darkField: '#141b08' },
  { key: 'lilac', name: 'Lilac', mark: '#b994ff', paper: '#845fc4', dark: '#b994ff', markDark: '#bd9cff', field: '#b994ff', fieldFg: 'dark', darkField: '#1a1526' },
  { key: 'red', name: 'Red', mark: '#e63322', paper: '#dd2717', dark: '#f13f2d', markDark: '#fe8c7a', field: '#e22f1e', fieldFg: 'light', darkField: '#26120f' },
  { key: 'sky', name: 'Sky', mark: '#4cc9f0', paper: '#087c9a', dark: '#4cc9f0', markDark: '#4cc9f0', field: '#4cc9f0', fieldFg: 'dark', darkField: '#031c24' },
  { key: 'quinacridone', name: 'Quinacridone', mark: '#d23d7c', paper: '#cd3878', dark: '#e04b88', markDark: '#fe83af', field: '#d03b7b', fieldFg: 'light', darkField: '#251118' },
  { key: 'moegi', name: 'Moegi', mark: '#7bbd3e', paper: '#498000', dark: '#7bbd3e', markDark: '#85c749', field: '#7bbd3e', fieldFg: 'dark', darkField: '#121c0a' },
  { key: 'violet', name: 'Violet', mark: '#9d7ad2', paper: '#8360b6', dark: '#9d7ad2', markDark: '#c09cf7', field: '#9d7ad2', fieldFg: 'dark', darkField: '#1b1426' },
  { key: 'mango', name: 'Mango', mark: '#ffb238', paper: '#9d6802', dark: '#ffb238', markDark: '#ffb238', field: '#ffb238', fieldFg: 'dark', darkField: '#221605' },
  { key: 'cerulean', name: 'Cerulean', mark: '#2f9fd6', paper: '#047bac', dark: '#2f9fd6', markDark: '#53bdf6', field: '#2f9fd6', fieldFg: 'dark', darkField: '#061b26' },
];

export const ROLE_INKS = {
  link: { name: 'Periwinkle', mark: '#7b7cff', paper: '#6461e1', dark: '#7b7cff', markDark: '#a1a8fe' },
  data: { name: 'Mint', mark: '#3bceac', paper: '#08816a', dark: '#3bceac', markDark: '#3bceac' },
  you: { name: 'Tangerine', mark: '#ff8c42', paper: '#b75602', dark: '#ff8c42', markDark: '#ff904a' },
};

// Colour comes from tones, chosen by CSS for the current theme (tokens.css),
// so a component only sets these variables and the data-ink attribute.
export function inkStyle(index) {
  const ink = Number.isInteger(index) ? DOC_INKS[((index % DOC_INKS.length) + DOC_INKS.length) % DOC_INKS.length] : null;
  if (!ink) return {};
  return {
    '--ink-mark': ink.mark,
    '--ink-paper': ink.paper,
    '--ink-dark': ink.dark,
    '--ink-mark-dark': ink.markDark,
    '--ink-field': ink.field,
    '--ink-field-fg': ink.fieldFg === 'light' ? '#ffffff' : '#1c1917',
    '--ink-dark-field': ink.darkField,
  };
}

// Props for an element that sets a document context: <li {...inkProps(doc.ink)}>.
export function inkProps(index) {
  const style = inkStyle(index);
  return Object.keys(style).length ? { 'data-ink': '', style } : {};
}
