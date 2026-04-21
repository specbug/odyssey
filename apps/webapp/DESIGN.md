# Odyssey Design Guide

A single-page contract for the web app's look, feel, and rhythm. Read this
before making visual changes — every surface follows the rules below, and
deviations are almost always accidents.

## Thesis

**Quiet paper, rare accent, information-dense glyphs. Reading is a ritual.**

The app is a warm-bone newsroom, not a SaaS dashboard. Paper dominates; ink
speaks in measured tones. The accent color is a reward, not a decoration —
it only appears during review, on active highlights, and briefly on hover.
Everything else is grayscale by design.

Source of truth was the design zip in `/tmp/odyssey-design/`. This doc is the
ongoing distillation so we don't rederive it every session.

## 1. Design tokens

All tokens live in `src/styles/tokens.css`. Don't hard-code color or type
elsewhere — reach for a var.

```
--paper   / paper-2 / paper-3  — oklch 96% → 88%
--rule    / rule-2              — dividers (82% / 72%)
--ink     / ink-2 / ink-3 / ink-4  — text hierarchy (14% → 64%)
--accent  / accent-soft / accent-deep  — driven by --accent-h
--grid  8px    (4 also works; 12 for display)
--rad   0px    (rams is sharp; leave radius at 0 unless there's a reason)
--sans  'R Sans'  --mono  'R Mono'  --serif  'Editorial Serif' fallback chain
```

`--accent-h` is a runtime variable. `src/hooks/useTimeHue.js` sets it from
the hour of day: morning 28, midday 225, dusk 295, night 250. Don't hard-code
hues for accent — always derive from the var.

## 2. Typography

Three families, three roles. Mixing them is the voice of the app.

| Family | When | Examples |
|---|---|---|
| **R Sans** (`--sans`) | All prose, UI controls, buttons, form elements, **all note authoring and preview surfaces** | Hero headlines, body copy, button labels, search input, drawer textareas, sticky note bodies, NotesScreen rows |
| **R Mono** (`--mono`) | Metadata, numerics, labels, dates, intervals | `p. 18 / 301`, `MORNING — TUE APR 21`, `INTERVAL — 9d · STABILITY 12d`, tag chips `#quantum`, `⌘⏎` hint |
| **Editorial Serif** (`--serif`) | **The review ritual only**, plus occasional empty-state italics | Review prompt + answer (the card moment), "An empty voyage.", "No notes yet." |

Rule of thumb: **serif is reserved for the review ritual.** Authoring and
preview — drawer textareas, sticky notes in the PDF rail, the rows in
NotesScreen — are all sans, because the user's own voice comes in through
sans and the preview should echo that voice, not swap fonts on them.
Serif arrives only when a note *becomes* a card under review; that font
swap is the "ritual" cue that you're reading, not writing.

Numerical / taxonomic text (anything counted, dated, or labeled) is mono.
Everything else structural is sans.

Utility classes for the mono role: `.mono` (11.5px) and `.mono-sm` (10.5px,
uppercase, letter-spaced). Both in `src/styles/base.css`.

### Why buttons need explicit font

Browsers give form elements their own UA font stack. `src/styles/base.css`
has a global `button, input, textarea, select { font-family: inherit; }`
— if you add a new form control and you're seeing system-ui leak in, you
probably clobbered inherit with an inline style. Check there first.

## 3. Color discipline

1. **Paper + ink handle everything non-active.** Library rows, home metrics,
   note rails — all grayscale.
2. **Accent emerges only at three moments:**
   - Review cards (prompt context dots, cloze reveal, Again button)
   - Active highlight (drawer open on it)
   - Sticky note left border (because it's a live reference to a highlight)
3. **Doc hues are decorative**, tied to `PDFFile.color_hue` (0–360). Used
   on DocGlyph backgrounds + small source dots in NotesScreen / PdfScreen
   crumb. Never on text. Deterministic fallback via `hashToHue(file_hash)`
   in `src/utils/hue.js` if the column is null.
4. Mixing with `color-mix(in oklab, var(--accent) X%, transparent)` keeps
   accent tints on the same axis as the CSS var — use this pattern for
   highlights and drawer borders. Don't compute your own `rgba(...)`.

## 4. Layout rhythm

- **Density is 8px.** Padding / gaps / offsets are all multiples (8 / 16 / 24 / 32 / 48).
- **Sharp corners.** `--rad: 0`. Rounded-pill exceptions exist — cloze blanks
  in NotesScreen, tag chips — and they use `border-radius: 999px`. Otherwise, no
  radii.
- **Dividers are 1px.** The "three-up divider" pattern (Reading strip, Memory
  tiles) uses `background: var(--rule)` on the grid + `gap: 1` — that 1px
  gap reveals the rule color between cards. When a row has <2 items, drop
  the backdrop (see `HomeScreen.js` Reading strip).
- **Meta strips are 40px tall.** Cards sit on paper with 1px rule borders or
  `box-shadow: 0 0 0 1px var(--rule)` for subtlety. Never both.
- **Side rails.** Left rail is fixed 72px (`.rail`). Right sticky-note rail
  is 320–340px. The grid between them flexes.

## 5. Motion

- **Easing is always `cubic-bezier(.2,.7,.2,1)`.** That's the feel of the
  app — quick lead-out, soft landing. Don't reach for `ease` or `ease-in-out`.
- **Durations:**
  - 160–220ms for small hover/press transitions (button backgrounds, icon colors)
  - 280–420ms for mid-size reveals (drawer fade, card-change animations)
  - 520ms for starburst tick rotations (slower = feels ceremonial)
  - 2600ms idle-before-fade for PDF chrome
- **`enter` + `enter-stagger`** in `src/styles/base.css` are the default
  mount animations. Apply on screen-level wrappers; children get staggered
  40ms delays for up to 8 items.
- **`@media (prefers-reduced-motion: reduce)`** kills the above animations.
  Honor it — the token file already handles it.

## 6. Key components

### Starburst (`src/components/Starburst.js`)

The signature glyph. **Every stroke = one prompt.** Length encodes interval
days on a log scale, opacity encodes state (new / learning / review / retired),
accentColor marks completed. Used at three sizes:
- 72 px in note rows (stability visualization)
- 200–300 px in home hero + review progress
- 16–48 px as inline micro (DocGlyph)

`tickAngle` rotates the whole figure clockwise during review — this is the
"session progressing" cue.

### Mark (`Starburst.js` named export)

The brand mark: 15 trapezoidal spikes on a central circle, same geometry
as `public/logo.svg`. Used in the rail and `DocGlyph` implicitly. Parametric;
call it with `size` and `color`.

### DocGlyph (`src/components/DocGlyph.js`)

Per-doc tapered mark with a tinted square wash. Hue comes from the doc's
`color_hue` or hash fallback. Appears wherever a doc is represented (Library
rows, Home reading cards, PdfScreen chrome).

### StickyNote (`src/components/StickyNote.js`)

Collapsed note preview in the right rail. Left border is always 3px accent;
content is serif; metadata row on top is mono. Answer preview is clamped to
2 lines with a dashed separator above it.

### InlineCaptureDrawer (`src/components/InlineCaptureDrawer.js`)

Two variants (`rail` in PdfScreen, `modal` in NotesScreen standalone notes).
Three modes: `cloze` (with `[[brackets]]`), `recall` (Q/A), `note` (freeform).
`cmd+Enter` commits, Esc cancels. Image paste → `/images/upload` →
`[image:UUID]` marker in the prompt/answer.

## 7. Per-screen intent

| Screen | File | One-line intent |
|---|---|---|
| Home | `screens/HomeScreen.js` | The ritual — today's queue as a starburst, what you're reading, what you're retaining |
| Library | `screens/LibraryScreen.js` | Editorial index of docs. Sort by recent/progress/due. Hover for review + delete. |
| Notes | `screens/NotesScreen.js` | Cross-doc passage browser with source + tag filters + search |
| PDF | `screens/PdfScreen.js` | Immersive reader with top chrome (auto-hide 2.6s), per-page sticky rail, inline capture drawer |
| Review | `screens/ReviewScreen.js` | Centered prompt, reveal on SPACE, grade 1–4, starburst ticks left |

## 8. Pitfalls learned (things that will burn again)

- **SQLite rowid reuse + immutable cache.** After a delete, a new upload can
  reuse `id=1`. If the download response is `Cache-Control: immutable`, the
  browser serves the previous file's bytes for the reused id. Current code
  uses `max-age=3600, must-revalidate` on the backend *and* `?v=<hash>` on
  the frontend URL. Don't restore `immutable` without also making the URL
  contain the hash.
- **Bare `<button>` loses R Sans.** Browsers give form elements their own
  UA font stack. The global `font-family: inherit` in `base.css` handles
  this — if you write a button with `font-family: ...` don't set it to a
  literal; reach for `var(--sans)` / `var(--mono)`.
- **react-pdf + react-window + a continuous right rail don't mix.** The
  design mock shows one unbroken sticky rail beside a scroll column — real
  PDFs are virtualized. PdfScreen renders the rail **per page** (inside
  `PageRenderer`) so notes stay in their page's cell. It reads continuous
  because pages stack. Do not try to lift the rail outside the virtualizer.
- **Text anchoring is fragile.** Keep the fallback chain in
  `resolveAnnotationLocation`: text_anchor → normalized_rects → pixel_rects.
  Each method lives in PdfScreen; preserve all three when touching highlight
  resolution.
- **Cloze is `[[word]]`, one card per annotation.** Multi-blank prompts
  reveal + grade together. The old Anki `{{c1::...}}` with per-index cards
  is gone; don't reintroduce `cloze_index` on `StudyCard`.

## 9. How to extend without breaking the voice

Before adding a new surface, check the doc for analogous patterns. If none
exists, ask:

1. **Is this reading or structure?** Picks your font family.
2. **Does this earn accent?** If it's not review or an active highlight, no.
3. **Does it need a divider or a shadow?** Pick one — never both at once.
4. **Does the empty state speak in serif italics?** All three empty states
   today do (Home, Library, Notes). Keep that pattern.
5. **Is motion on the `.2,.7,.2,1` curve at a duration from §5?** If yes, it
   will feel like the rest of the app.

New features that would need a deliberate aesthetic conversation before
shipping:
- Dark mode (design hints at "paper turns graphite, ink turns bone" — not
  yet implemented; tokens.css is the only place to touch)
- Voyage / Editorial variants (infra is there — `--accent-h`, `--rad`
  vars — but we ship rams only)
- A tweaks / settings panel (design has one; we dropped it for v1)

## 10. Don'ts

- Don't reach for `px` on colors — use oklch vars.
- Don't set `font-family` to a literal string — always a var.
- Don't animate layout (`width`, `height`, `padding`) without a reason.
  Transforms and opacity only, per §5.
- Don't mix font families within a single text run (sans + mono in one line
  is fine as adjacent spans; serif + sans is not).
- Don't add new routes without also persisting `odyssey:route` in
  localStorage via `App.js` — the shell relies on round-tripping.
- Don't introduce external font CDNs. All type is bundled from `src/fonts/`.
