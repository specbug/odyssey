# Odyssey web app

The React front end: a library, a PDF reader with notes in the margin, a
review screen, and a graph of related notes. It talks to the
[API](../api/README.md).

## Run

Start the API first, then:

```bash
bun install
bun run start
```

The app opens at <http://localhost:3000/odyssey> and calls the API at
`http://localhost:8000`. A production build (`bun run build`) calls `/api`
on its own origin instead; the [Dockerfile](Dockerfile) and
[nginx.conf](nginx.conf) serve it that way.

Use bun, not npm. The lockfile is `bun.lock`.

## Test

```bash
CI=true bun run test --watchAll=false
CI=true bun run build
```

With `CI=true`, lint warnings fail the build, as they do in CI.

## Design

Every visual change follows [`DESIGN.md`](DESIGN.md): the type roles, the four
colour signals, layout, motion and copy. Read it before changing anything you
can see.

## Layout

| Path | What it is |
| --- | --- |
| `src/App.js` | Shell and routing |
| `src/screens/` | Home, Library, Notes, Graph, Pdf (the reader), Review |
| `src/components/` | Shared pieces, including the Comb and the Spiral, the two instruments that draw review data |
| `src/hooks/` | Route history and the theme toggle |
| `src/utils/` | Cloze parsing, formatting, rich-text rendering |
| `src/data/adapters.js` | API responses to the shapes the screens use |
| `src/styles/` | Tokens, type and controls, screen layout, the reader |
| `src/fonts/` | R Sans, Google Sans Flex, R Mono. See [its README](src/fonts/README.md) |
