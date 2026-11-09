# Odyssey

[![CI](https://github.com/specbug/odyssey/actions/workflows/ci.yml/badge.svg)](https://github.com/specbug/odyssey/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

**A PDF reader with a long memory.**
Spaced repetition for every highlight.

Reading usually happens in a PDF viewer, notes in a notes app, and review in
Anki, and the three rarely meet. Odyssey is a self-hosted PDF reader in which
a note written in the margin is also a flashcard. Select a passage, write a
cloze or a question beside it, and the scheduler brings it back on the day
your predicted recall of it falls to 90%.

![The reader: a page with three highlights in its document's colour, each with its note in the margin](docs/screenshots/reader.png)

## Reading and writing

Select text on a page and choose **Add note**. The drawer that opens has
three tabs:

- **Cloze.** Wrap the words to recall in double brackets:
  `Retention falls fast, then flattens: the [[forgetting curve]].` A note with
  *n* blanks makes *n* cards, each on its own schedule.
- **Recall.** A question with an answer.
- **Note.** Text with neither. It comes back for rereading, graded like any
  other card.

Notes render LaTeX (`$…$` inline, `$$…$$` on a line of its own), set in TeX
Gyre Pagella, and images. Each note stays anchored to the passage it was
written against, and during review `O` opens that page.

Every document is given its own colour when you add it, and keeps it. Its
highlights, the edges of its notes, its ticks on the home spiral and its
review screen all use it, so a card tells you where it came from before you
read a word.

## Scheduling

Cards are scheduled with [FSRS](https://github.com/open-spaced-repetition),
which models each card's memory with two numbers: *stability* $S$ and
*difficulty* $D$. Stability is measured in days. In the FSRS version Odyssey
uses, the probability of recalling a card $t$ days after its last review is

$$R(t) = \left(1 + \frac{t}{9S}\right)^{-1}$$

A card falls due when $R$ reaches 0.9, which by construction is $t = S$: a
card with a stability of 12 days comes back in 12 days. Each grade (Again,
Hard, Good, Easy) moves $S$ and $D$, and the review screen shows the interval
each grade would set before you press it. Intervals are capped at 36,500 days.
Nobody has tested the cap.

The model's 17 weights are FSRS's published defaults. Odyssey does not yet fit
them to your own review history; until it does, the curve above describes an
average learner.

### The review queue

A session runs most-overdue first, with three rules that come from cloze
notes:

1. A cloze card shows the note's other blanks filled in, so sibling cards give
   each other away. A session holds at most one card per note.
2. After any card from a note is reviewed, its New and Review siblings are held
   back for 12 hours. Learning and Relearning cards are exempt, because their
   short steps are the point.
3. Linked notes, shown under a card once it is revealed, are kept at least
   three positions apart in the queue.

`R` starts a review from Home, `Space` reveals, `1`–`4` grade, and `Esc` ends
the session.

| Home | Review |
| --- | --- |
| ![Home: cards due, with the queue drawn on a spiral of intervals, each tick in its document's colour](docs/screenshots/home.png) | ![Review: a recall card on its document's colour, its answer revealed above the four grades and their intervals](docs/screenshots/review.png) |

Home draws the due queue on a spiral: a logarithmic time axis wound outward
from today to one year, with a tick for each card at its current interval.
Review keeps the same quantity in the left margin, one bar per card, and
redraws a bar at its new length when you grade it.

## Linked notes

Linking two notes by hand requires remembering the older one, which is the
problem spaced repetition exists to solve. Odyssey can link them for you,
using a language model (optional; see [Privacy](#privacy)). Every 60 seconds a
background worker takes notes that changed and have been left alone for 90
seconds, and runs four steps:

1. **Digest.** The model summarises the note and marks fragments and test text
   as not worth linking.
2. **Retrieve.** Local TF-IDF ranks the archive and keeps the top 8 candidates.
   No model is involved.
3. **Judge.** The model rates each candidate against the note and names the
   relation: same concept, elaboration, example, contrast, prerequisite, or
   cause and effect.
4. **Verify.** Each strong pair is asked again, alone. A link is made only if
   both answers agree, and the verifier's reason is stored with it.

A note gets at most 6 links, and at most 2 within one document. Links appear
in the Graph view with their reasons. Removed links stay removed.

## Getting started

You need Docker or Podman with Compose.

```bash
git clone https://github.com/specbug/odyssey.git
cd odyssey
docker compose up -d --build api web    # or: podman compose up -d --build api web
```

Open <http://localhost:3000>. The API listens on <http://localhost:8000>, with
interactive docs at `/docs`, and the data lives in the `odyssey-data` volume.
To try the reader without a PDF of your own, upload
[`docs/samples/notes-on-forgetting.pdf`](docs/samples/notes-on-forgetting.pdf).

The compose file also defines `cloudflared`, which publishes the app through a
Cloudflare Tunnel. Leave it out, as above, unless you have a tunnel. Settings
live in `.env`; [`.env.example`](.env.example) documents each one.

### macOS app

The native client needs macOS 14 and Swift 5.9 or later, and a running server:

```bash
cd apps/mac/OdysseyMacApp
swift run OdysseyMacApp
```

### Local development

```bash
# API, Python 3.11
cd apps/api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python run.py                  # http://localhost:8000

# Web app, in a second terminal
cd apps/webapp
bun install
bun run start                  # http://localhost:3000/odyssey
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the tests and conventions.

## Privacy

Odyssey stores everything on the machine that runs it, and makes outbound
requests only for the features below, each off until you set its variable in
`.env`. Two use the [Meta Model API](https://dev.meta.ai) and need
`META_API_KEY`:

- **Metadata.** On upload, the text of a PDF's first 10 pages, capped at
  24,000 characters, is sent to extract its title, author and an excerpt.
- **Linked notes.** Note text is sent for the digest, judge and verify steps
  above. `LINKER_ENABLED=false` turns linking off and keeps metadata.

The default model, `muse-spark-1.3-contributor`, is on Meta's Contributor
tier, priced low because Meta may train on what it receives. The Standard
tier, `META_MODEL=muse-spark-1.3`, is not trained on and costs about 12 times
as much per input token.

The third, `HEALTHCHECKS_URL`, sends a bare `GET` to an uptime monitor every
60 seconds.

## Repository layout

| Path | Contents |
| --- | --- |
| [`apps/api`](apps/api) | FastAPI server: documents, notes, scheduling, the review queue, the linker |
| [`apps/webapp`](apps/webapp) | React web app. Its design rules are in [`DESIGN.md`](apps/webapp/DESIGN.md) |
| [`apps/mac`](apps/mac) | SwiftUI client for macOS |
| [`packages/ui-foundation`](packages/ui-foundation) | Design tokens for the macOS client |
| [`docs`](docs) | Screenshots, the sample PDF, and archived implementation notes |

## Contributing

Bug reports, fixes and ideas are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Everyone
taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report
security issues privately, as [SECURITY.md](SECURITY.md) describes.

## Acknowledgements

Odyssey owes its premise to Andy Matuschak's work on the mnemonic medium and
[Orbit](https://github.com/andymatuschak/orbit), and its scheduler to the
[open-spaced-repetition](https://github.com/open-spaced-repetition) project.

## License

[Apache License 2.0](LICENSE). The bundled fonts are under the SIL Open Font
License 1.1; see [`apps/webapp/src/fonts`](apps/webapp/src/fonts/README.md).
