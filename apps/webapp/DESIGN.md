# Odyssey design contract

The web app follows the rishit-design system. This file is the contract for
anything the user can see: read it before a visual change. Values live in
`src/styles/tokens.css`; type roles and controls in `base.css`; per-screen
layout and every responsive rule in `screens.css` and `pdf.css`.

## Principles, as they apply here

- **Restraint.** A surface shows the content and what directly extends it.
  Navigation aids, progress and metadata stay hidden until asked for, with
  one exception: the review Comb is always shown (see below).
- **Finish.** Real characters (× − ° ’ “ ” –), a no-break space between a
  number and its unit (`9 d`, `p. 4`), tabular figures wherever numbers
  update or sit in a column.
- **Earn the space.** Cut from this redesign for failing the test: the home
  memory tiles (retention, stability, sessions, streak), per-document glyphs
  and colours, the note count in the reader chrome, the page progress bar
  that duplicated the page number, the date on each note card, and later the
  reader's page Rule (a hidden page scale in the left margin), which the
  reader didn't need.
- **Draw what is true.** The Comb and the spiral plot real intervals at real
  proportion.
- **Never explain the design on the surface.** No colour keys, no legends.

## Colour

Cool neutral ground, ink for everything. Light and dark follow
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
| `--ground` | the app background |
| `--sheet` | a card, plate or page sitting on the ground |
| `--ink` / `--ink-2` / `--ink-3` | text, secondary text, folios and key hints |
| `--rule` | 1px hairlines |
| `--grid` | chart gridlines |

Four signals, one meaning each, everywhere:

| Signal | Means | Where it appears |
|---|---|---|
| `--link` | something to follow or act on | links, "Review 3", "Open p. 4", "2 links", focus rings, text selection |
| `--note` | the person's own marks | highlights, cloze underlines and blanks, graph nodes |
| `--data` | computed values | the interval each grade would set, graded bars in the Comb |
| `--you` | where the person is | current route in the rail, the current card's bar, the selected graph node |

One more code, on card edges only: the note's **type**. `--type-cloze`
(crimson, kept off the you red), `--type-recall` (violet), `--type-note`
(teal), set by `data-type` on `.card`. It lives on the 2px edge and nowhere
else, so it never competes with the signals. The capture drawer's edge
follows the selected mode. The old time-of-day accent was considered for
this and rejected: four of its five hours land on the link blue or the you
red.

Signals stay small: an underline, a 2px edge, a numeral, a tick. Marks drawn
on a PDF page use `--note-on-page` / `--link-on-page`, which keep their
light-mode values because the canvas stays white in dark mode.

**The logo** is a cloze: square brackets in ink around one orange blank,
`[_]`, the app's own syntax for the thing it does. `public/logo.svg` is the
master (100-unit grid, 10-unit strokes, the blank sitting just above the
bracket foot). The logo is always black brackets (`#1f2124`) with the
orange blank (`#ff4d06`), whatever the system or app theme: no dark variant in
the files. `public/favicon.svg` is the same mark redrawn on
the 16px grid with 2px strokes so every edge lands on a pixel. The PNGs are
exported from those two: `favicon-16x16` and `favicon-32x32` from the 16px
drawing (32 is it doubled), and `apple-touch-icon` (180), `logo-192` and
`logo` (512) from the master, centred on `--ground` with 18% padding so they
survive maskable cropping; `favicon.ico` bundles 16 and 32. Re-export them
whenever the SVGs change.

In the app, `components/Mark.js` draws the master at the top of the rail as
the Home button: the brackets take `--ink`, the blank takes `--mark`
(`#ff4d06`), the one colour outside the four signals, by decision. Inside
the app the brackets go light only when the app itself is dark, because
black brackets would vanish on the dark rail; everywhere else (favicon, app
icon, link previews) the logo is black. It
appears nowhere else but the theme flicker. The original starburst logo was
retired because it sat too close to Claude's mark.

## Type

| Face | Job | Notes |
|---|---|---|
| R Sans | all running text | `ss03`, optical sizing on. Body weight 450, 425 in dark. |
| Google Sans Flex | small text and every number | 11–13px, sentence case, natural tracking, `tabular-nums`. GRAD/ROND/slnt/wdth pinned at build. |
| R Mono | code only | also supplies ⌘ and ↵, which the other two lack |

Roles (`base.css`): `.t-display` (opsz 40, 520, −0.02em, 1.02, balanced),
`.t-h` (21px, 620, −0.012em), `.t-body` (18.5 / 1.62), `.t-note`
(13.5 / 1.48, ink-2), `.t-small` (Google Sans Flex 12px; `.lg` 13, `.xs` 11).
No uppercase letter-spaced labels, no monospace for words.

## Layout

8px grid: 8 / 16 / 24 / 32 / 48 / 64 / 96. Radius 0. Elevation is `--sheet`
plus a 1px rule, never a shadow. Empty space stays empty.

- **Shell:** a 64px rail (logo/Home, Library, Notes, Graph, Review, and the
  theme button at its foot) and the main column. Under 640px the rail moves to the bottom edge.
- **App screens** have one focal object. Page frame: 880px max, 48px gutters.
- **Reader:** a 48px bar across the top, then each page with its 216px notes
  column 48px to the right, the pair centred together. Never add width beside
  the page to balance it: a row wider than the window gives the reader a
  horizontal scrollbar (a 216px balancing column did exactly that below
  1310px). Under 1100px the notes column goes away, since at the default 120%
  zoom a page and its notes need 1046px.
- **Reader bar:** one full-width strip on `--ground` with a 1px rule under
  it, in three columns: `Library` on the left; the title (15px / 540) and
  author centred; the page dial, zoom and `Review N` on the right. It hides while you read (`hooks/useReaderChrome.js`): a 280ms
  fade with a slide up out of the way, back on scroll up, pointer or focus.
  On phones the title gives way.

## Components

### Comb (`components/Comb.js`) — the review instrument

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

### Spiral (`components/Spiral.js`) — today's queue on Home

The same log time axis wound into an Archimedean spiral: centre is now,
the outer end one year. Each due card is a tick at its current interval, so
new cards sit near the centre and well-learned ones far out. Scale labels
(1 d, 1 wk, 1 mo, 1 yr) appear on hover; pointing at a tick reads the card.
With no cards due there is nothing to plot, so the logo (176px, 112px on a
phone) takes the spiral's 272px box and the page keeps its shape.

### Page dial (`components/PageDial.js`) — the reader's page readout

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
rule on three sides, a 2px left edge in the type colour (`--note` when a
card has no type), padding 12 / 14. Cards show
the content only, no type label; the edge colour carries the type. In the reader margin they rest at 72%
opacity and come up to full on hover, focus or when their highlight is
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
empty slot with a 2px note underline sized to the answer; on reveal the
answer appears, weight 600 with the same underline. Other blanks show their
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

Run the skill's last pass on every new string: delete words that carry
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
