# Odyssey design contract

The web app follows the rishit-design system. This file is the contract for
anything the user can see: read it before a visual change. Values live in
`src/styles/tokens.css` and the inks in `src/data/inks.js`; type roles and
controls in `base.css`; per-screen layout and every responsive rule in
`screens.css` and `pdf.css`.

## Principles, as they apply here

- **Restraint.** A surface shows the content and what directly extends it.
  Navigation aids, progress and metadata stay hidden until asked for, with
  one exception: the review Comb is always shown (see below).
- **Finish.** Real characters (× − ° ’ “ ” –), a no-break space between a
  number and its unit (`9 d`, `p. 4`), tabular figures wherever numbers
  update or sit in a column.
- **Earn the space.** Cut from this redesign for failing the test: the home
  memory tiles (retention, stability, sessions, streak), per-document glyphs,
  the note count in the reader chrome, the page progress bar
  that duplicated the page number, the date on each note card, and later the
  reader's page Rule (a hidden page scale in the left margin), which the
  reader didn't need.
- **Draw what is true.** The Comb and the spiral plot real intervals at real
  proportion.
- **Never explain the design on the surface.** No colour keys, no legends.

## Colour

A proof with a trace of warmth for the ground, a softened ink for running
text, and colour as inks: marks and fields, never body text. Light and dark
follow
`prefers-color-scheme` unless the person pins one with the theme button at
the foot of the rail (system → light → dark). The choice is `data-theme` on
`<html>`, remembered in localStorage `odyssey:theme` by `hooks/useTheme.js`
and applied before first paint by an inline script in `public/index.html`.
Dark values live in `tokens.css` twice, once under the media query and once
under `[data-theme="dark"]`; change both together.

Changing the theme plays one flicker around the button
(`components/ThemeEcho.js`), drawn from the logo: two pairs of brackets
spring outward from the icon one after the other, reading as `[[ ]]` for a
moment, while the orange blank flashes under it and the icon flashes the
logo's orange before settling back to ink. About 560ms. It is the only other
place the logo's orange appears, and it doesn't render under
`prefers-reduced-motion`.

| Token | Use |
|---|---|
| `--ground` | the app background: oklch 0.983 0.003 95 in light |
| `--sheet` | a card, plate or page sitting on the ground |
| `--ink` / `--ink-2` / `--ink-3` | running text, secondary text, folios and key hints |
| `--rule` | 1px hairlines |
| `--grid` | chart gridlines |

### Inks

All colour comes from one box of 20 inks (`src/data/inks.js`), pooled from
eight palettes (Highlighter, Risograph, Memphis, Bauhaus, Gouache, Tropic,
Nippon, Neon) with near-duplicates merged. They are luminous on purpose:
OKLCH lightness about 0.6–0.9, chroma near the edge of sRGB. An ink is a
mark or a field; text in an ink uses a darker step of the same hue.

Every ink has the same tones, all one hue: `mark` (dots, edges, highlights,
underlines), `paper` (text on the light ground, darkened just enough to
clear 4.5:1), `dark` (text on the dark ground, lightened just enough),
`markDark` (the mark, lifted where it would sink into the dark ground),
`field` and `fieldFg` (the review screen and the type on it), and
`darkField` (the review screen in dark mode). `inks.test.js` holds every text
tone to 4.5:1.

Two kinds, each with one job:

**Role inks** say what a thing is, the same everywhere. Three are kept out of
the document set:

| Token | Ink | Means | Where |
|---|---|---|---|
| `--link`, `--link-mark` | Periwinkle | follow or act on | links, `Review 3`, `Open p. 4`, `2 links`, focus rings, selection |
| `--data` | Mint | intervals and counts | the interval each grade would set, `p. 2 of 4`, `5 notes`, graded Comb bars |
| `--you` | Tangerine | where you are | the rail's current route, the current Comb bar, the page dial's index, the selected graph node |

**Document inks** say which document. The other 17 are assigned one per PDF
on upload (`PDFFile.ink`, `apps/api/app/inks.py`: the least-used ink, lowest
index first) and never change: there is no way to pick or switch one, so a
document's colour is something you learn. `DOC_INKS` is stored data: append
to it, never reorder it. Its order steps round the colour wheel by seven of
17, so consecutive uploads look unrelated. A document's ink marks:

- its dot beside its title (library, home, notes filter) and its author line;
- the 2px edge of every note card from it, in Notes, the reader's margin and
  the graph, with the note type as a word (`Cloze`, `Recall`, `Note`);
- its highlights on the page and its cloze underlines;
- its node in the graph and its ticks on the home spiral;
- the review screen while one of its cards is up.

An element sets a document context with `inkProps(index)` (`data-ink` plus
`--ink-*`); `tokens.css` turns those into `--doc-mark`, `--doc-text`,
`--note` and `--note-on-page` for the theme. Custom properties resolve where
they are declared, so derived names must be set on the `[data-ink]` element
itself, not on `:root`. Without a document, the same names fall back to
neutral.

**The review field.** In light mode the review screen is a field of the
card's document ink, and every mark on it (source line, intervals, links,
the Comb) takes the field's type colour, dark or white, whichever contrasts
more. In dark mode the screen stays dark, tinted towards the ink, with a 3px
edge along the top and the ink lifted for the source line, intervals, links
and the current card. A note without a document reviews on plain paper.

Signals stay small everywhere else: an underline, a 2px edge, a dot, a tick.
Highlights on a PDF page are a marker stroke in the document's light mark
(36%, 52% while selected, multiplied into the page), since the canvas stays
white in dark mode.

**The logo** is a cloze: square brackets in ink around one orange blank,
`[_]`, the app's own syntax for the thing it does. `public/logo.svg` is the
master (100-unit grid, 10-unit strokes, the blank sitting just above the
bracket foot). In the files the logo is always black brackets (`#1f2124`)
around the orange blank (`#ff4d06`), whatever the theme; there is no dark
variant. `public/favicon.svg` is the same mark redrawn on the 16px grid with
2px strokes, so every edge lands on a pixel. The PNGs are
exported from those two: `favicon-16x16` and `favicon-32x32` from the 16px
drawing (32 is it doubled), and `apple-touch-icon` (180), `logo-192` and
`logo` (512) from the master, centred on `--ground` with 18% padding so they
survive maskable cropping; `favicon.ico` bundles 16 and 32. Re-export them
whenever the SVGs change, and bump the `?v=` on every icon link in
`index.html` and `manifest.json`: browsers keep a favicon long after the
file behind it changes.

In the app, `components/Mark.js` draws the master at the top of the rail as
the Home button: the brackets take `--ink`, the blank takes `--mark`
(`#ff4d06`), the one colour outside the inks, by decision. Inside
the app the brackets go light only when the app itself is dark, because
black brackets would vanish on the dark rail; everywhere else (favicon, app
icon, link previews) the logo is black. Apart from the rail, it appears only
in the theme flicker. The original starburst logo was
retired because it sat too close to Claude's mark.

## Type

| Face | Job | Notes |
|---|---|---|
| R Sans | all running text | `ss03`, optical sizing on. Body weight 410, 395 in dark. |
| Google Sans Flex | small text and every number | 11–13px, sentence case, natural tracking, `tabular-nums`. GRAD/ROND/slnt/wdth pinned at build. |
| JetBrains Mono | code | variable, ligatures on; `pre code` inherits it (the UA default is the system monospace) |
| TeX Gyre Pagella Math | maths | KaTeX renders MathML (`utils/math.js`), the browser lays it out in Pagella at 1.15em, which levels its x-height with R Sans |
| R Mono | ⌘ and ↵ | only those glyphs in key hints, which the others lack |

Roles (`base.css`): `.t-display` (opsz 40, 440, −0.024em, 1.02, balanced),
`.t-h` (21px, 560, −0.012em), `.t-body` (18.5 / 1.62), `.t-note`
(13.5 / 1.48, ink-2), `.t-small` (Google Sans Flex 12px; `.lg` 13, `.xs` 11).
No uppercase letter-spaced labels, no monospace for words.

## Layout

8px grid: 8 / 16 / 24 / 32 / 48 / 64 / 96. Radius 0. Elevation is `--sheet`
plus a 1px rule, never a shadow. Empty space stays empty.

- **Shell:** a 64px rail (logo/Home, Library, Notes, Graph, Review, and the
  theme button at its foot) and the main column. Under 640px the rail moves
  to the bottom edge.
- **App screens** have one focal object. Page frame: 880px max, 48px gutters.
- **Reader:** a 48px bar across the top, then each page with its 216px notes
  column 48px to the right, the pair centred together. Never add width beside
  the page to balance it: a row wider than the window gives the reader a
  horizontal scrollbar (a 216px balancing column did exactly that below
  1310px). Under 1100px the notes column goes away, since at the default 120%
  zoom a page and its notes need 1046px.
- **Reader bar:** one full-width strip on `--ground` with a 1px rule under
  it, in three columns: `Library` on the left; the title (15px / 540) and
  author centred; the page dial, zoom and `Review N` on the right. It hides
  while you read (`hooks/useReaderChrome.js`), fading over 280ms as it
  slides up, and returns on scroll up, pointer or focus. On phones the title
  gives way.

## Components

### Comb: the review instrument (`components/Comb.js`)

One bar per card in queue order; bar length is the card's interval on a log
scale from now to one year, with gridlines at a day, a week, a month and a
year. A graded card's bar is redrawn at the new interval (from the API's
`scheduled_days`) in `--data` over a dotted trace of the old length, so a
session reads as cards pushed out, or pulled back on Again. The spine is ink
as far as the session has come; the current card's bar is `--you`. Pointing
at a bar reads it out (`9 d → 27 d`). Readout below: `6 of 12`.

In review it sits in the left margin, always shown at full strength: no
fade and no hover reveal, by decision, since watching the bars move is part
of the session. Under 1100px it runs across the top instead, bars hanging
down. On the done screen it is shown at full strength as the session's
summary.

### Spiral: today's queue on Home (`components/Spiral.js`)

The same log time axis wound into an Archimedean spiral: centre is now,
the outer end one year. Each due card is a tick at its current interval, so
new cards sit near the centre and well-learned ones far out. Each tick is in
its card's document ink, so the queue reads as a scatter of the documents
it came from. Scale labels
(1 d, 1 wk, 1 mo, 1 yr) appear on hover; pointing at a tick reads the card.
With no cards due there is nothing to plot, so the logo (176px, 112px on a
phone) takes the spiral's 272px box and the page keeps its shape.

### Page dial: the reader's page readout (`components/PageDial.js`)

In the reader bar, a 112 × 32 window onto a tape of pages that slides
under a fixed index, like the scale on a lens: a tick per page, longer every
5, numbered every 10, edges faded. The index is 1.5px in `--you`; the
current page sits above it as a figure (Google Sans Flex 11 / 560, ink),
and numbered ticks fade out as they near it. The tape follows the scroll
continuously: PdfScreen hands it a fractional page from the scroll handler
(`ref.setPosition`) and the dial moves its own DOM, so scrolling never
re-renders the reader. `round(pos)` is the same page as the reader's
midpoint counter. Drag the tape to scrub (4px a page); click a tick to jump
there. It's a `role="slider"`; ←/→ already turn pages.

### Cards

Only for things the person made and can act on: notes in the Notes list,
notes in the reader margin, the capture drawer. `.card`: `--sheet`, 1px
rule on three sides, a 2px left edge in the card's document ink (neutral
for a standalone note), padding 12 / 14. The note type is a word,
`.card-type` (`Cloze`, `Recall`, `Note`), in ink-3 at 11px, so the edge has
one meaning. In the reader margin cards rest at 72%
opacity and come up to full on hover, on focus, or when their highlight is
selected. Text that only extends content stays a borderless note.

### Controls

- Buttons: `.btn` (1px rule), `.btn.primary` (solid ink), `.btn.ghost`
  (text only), `.btn.link` (link colour). Shortcuts sit inside in `.key`:
  `Reveal Space`, `Save ⌘↵`, `Review R`, `End session Esc`.
- Grades: one bordered strip of four cells, each label, key and consequence
  (`Good 3 / 13 d`, the interval in `--data`).
- Choices (sort order, capture mode, graph filter): `.tabs`, text with the
  current one underlined in ink.

### Cloze

`[[word]]`. One card per blank. In review only the active blank hides, as an
empty slot with a 2px underline in the document's ink, sized to the answer;
on reveal the answer appears, weight 560 with the same underline. Other blanks show their
answers underlined. Linked notes shown after reveal mask every blank as
`[…]`, since a neighbour may come up later in the session.

## Motion

One living element per surface, tied to real state: Comb bars easing to
their new interval, the reader bar sliding away, a note settling level with
its highlight. Curve `cubic-bezier(.2,.7,.2,1)` (`--ease`) at 200–400ms. No
load-in choreography. `prefers-reduced-motion` turns transitions off.

## Words

Plain is the floor. Status lines are noun phrases (`12 cards due`,
`No documents.`, `Linking off. Set META_API_KEY to enable.`). Errors say
what failed and why (`failText` in `utils/format.js`: "Couldn’t load
library. Server not responding." plus Retry). Buttons say what happens. One
name per concept: library, document, note, card, cloze, link.

The marquee line, in the README, meta description and manifest:
**A PDF reader with a long memory.** / Spaced repetition for every
highlight.

Run the skill's last pass on every new string: delete words that add
nothing, use the term instead of a paraphrase, don't repeat a control, and
scan for the bestiary (not / — / yet / quiet / just / simply).

## Pitfalls that will burn again

- **SQLite rowid reuse + immutable cache.** Never mark
  `/files/{id}/download` immutable; the frontend also busts with
  `?v=<file_hash>`.
- **Bare `<button>` loses the type.** `base.css` sets `font-family: inherit`
  on form controls; don't override it with a literal.
- **The notes column is per page**, inside each lazily mounted row. Don't
  lift it out.
- **Text anchoring is fragile.** Keep the chain in PdfScreen:
  text_anchor → normalized_rects → pixel_rects.
- **Chrome-less routes** (`pdf`, `review`) need a visible way out in every
  loading and error state; `escapeHatch` in PdfScreen is the pattern.
- **No font CDNs.** All type is bundled from `src/fonts/`.
