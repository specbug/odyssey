# Odyssey design contract

The web app follows the rishit-design system. This file is the contract for
anything the user can see: read it before a visual change. Values live in
`src/styles/tokens.css`; type roles and controls in `base.css`; per-screen
layout and every responsive rule in `screens.css` and `pdf.css`.

## Principles, as they apply here

- **Restraint.** A surface shows the content and what directly extends it.
  Navigation aids, progress and metadata stay hidden until asked for.
- **Finish.** Real characters (× − ° ’ “ ” –), a no-break space between a
  number and its unit (`9 d`, `p. 4`), tabular figures wherever numbers
  update or sit in a column.
- **Earn the space.** Cut from this redesign for failing the test: the home
  memory tiles (retention, stability, sessions, streak), per-document glyphs
  and colours, the note count in the reader chrome, the page progress bar
  that duplicated the page number, and the date on each note card.
- **Draw what is true.** The Comb, the spiral and the page Rule plot real
  intervals and pages at real proportion.
- **Never explain the design on the surface.** No colour keys, no legends.

## Colour

Cool neutral ground, ink for everything. Light and dark follow
`prefers-color-scheme`.

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
| `--note` | the person's own marks | highlights, card edges, cloze underlines and blanks, graph nodes, note ticks on the Rule |
| `--data` | computed values | the interval each grade would set, graded bars in the Comb |
| `--you` | where the person is | current route in the rail, the current card's bar, the page Rule's position line, the selected graph node |

Signals stay small: an underline, a 2px edge, a numeral, a tick. Marks drawn
on a PDF page use `--note-on-page` / `--link-on-page`, which keep their
light-mode values because the canvas stays white in dark mode.

**The logo** (`public/logo.svg`, the orange starburst) is kept as the
favicon / app icon and drawn from its own geometry at the top of the rail
(`components/Mark.js`), where it is the Home button. Its orange (`--mark`)
is the one colour outside the four signals, by decision. It appears nowhere
else: no starburst charts, no per-document glyphs.

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

- **Shell:** a 64px rail (logo/Home, Library, Notes, Graph, Review) and the
  main column. Under 640px the rail moves to the bottom edge.
- **App screens** have one focal object. Page frame: 880px max, 48px gutters.
- **Reader:** page centred on the optical axis, a 216px notes column on the
  right (balanced by an empty 216px column on the left), and the page Rule in
  the 168px left margin. Under 1024px the notes column and the Rule go away
  and the page readout moves into the chrome.

## Components

### Comb (`components/Comb.js`) — the review instrument

One bar per card in queue order; bar length is the card's interval on a log
scale from now to one year, with gridlines at a day, a week, a month and a
year. A graded card's bar is redrawn at the new interval (from the API's
`scheduled_days`) in `--data` over a dotted trace of the old length, so a
session reads as cards pushed out, or pulled back on Again. The spine is ink
as far as the session has come; the current card's bar is `--you`. Pointing
at a bar reads it out (`9 d → 27 d`). Readout below: `6 of 12`.

In review it sits in the left margin, hidden (opacity 0) until the pointer
enters the margin or it takes focus; on touch screens (no hover) it rests at
half strength. Under 1100px it runs across the top instead, bars hanging
down. On the done screen it is shown at full strength as the session's
summary.

### Spiral (`components/Spiral.js`) — today's queue on Home

The same log time axis wound into an Archimedean spiral: centre is now,
the outer end one year. Each due card is a tick at its current interval, so
new cards sit near the centre and well-learned ones far out. Scale labels
(1 d, 1 wk, 1 mo, 1 yr) appear on hover; pointing at a tick reads the card.

### Page Rule (`components/PageRule.js`) — the reader's instrument

A vertical scale in the left margin: one tick per page (every tenth
longer), note-colour ticks on the other side for pages with notes, ink for
pages behind you, a 1.5px `--you` line at the current page and a readout
(`p. 12 of 120`). Hidden until the pointer enters the margin or it takes
keyboard focus; fades over 400ms. Click to jump; ↑ / ↓ when focused. It is
the reader's only page display.

### Cards

Only for things the person made and can act on: notes in the Notes list,
notes in the reader margin, the capture drawer. `.card`: `--sheet`, 1px
rule on three sides, a 2px `--note` left edge, padding 12 / 14. Cards show
the content only, no type label. In the reader margin they rest at 72%
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
their new interval, the Rule's position line, a note settling level with its
highlight. Curve `cubic-bezier(.2,.7,.2,1)` (`--ease`) at 200–400ms. No
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
