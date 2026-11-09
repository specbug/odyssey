# Odyssey web app

The React client: a library of PDFs, a reader with notes in the margin, a
review screen, and a graph of linked notes. It needs the
[API](../api/README.md) running.

## Run

```bash
bun install
bun run start
```

The development server opens <http://localhost:3000/odyssey> and calls the API
at `http://localhost:8000`. A production build (`bun run build`) calls `/api`
on its own origin instead, which is how the [Dockerfile](Dockerfile) and
[nginx.conf](nginx.conf) serve it: nginx passes `/api/*` to the server with
the prefix removed.

Use bun. The lockfile is `bun.lock`, and npm would write a second one.

## Test

```bash
CI=true bun run test --watchAll=false
CI=true bun run build
```

`CI=true` turns lint warnings into build errors, as CI does. The Jest suite
covers route history, the theme toggle, the reader bar's auto-hide, and the
formatting helpers, including the log scale the Comb and the spiral share.

## Design

[`DESIGN.md`](DESIGN.md) is the contract for anything visible: type, the four
colour signals, layout, motion and copy. Read it before a visual change;
reviews are made against it.

## Source layout

| Path | Contents |
| --- | --- |
| `src/App.js` | Shell and routing |
| `src/screens/` | Home, Library, Notes, Graph, Pdf (the reader), Review |
| `src/components/` | Shared pieces, including the two instruments: the Comb in review and the spiral on Home |
| `src/hooks/` | Route history, the theme, the reader bar |
| `src/utils/` | Cloze parsing, formatting, rich-text rendering |
| `src/data/adapters.js` | API responses mapped to the shapes the screens use |
| `src/styles/` | Tokens, type and controls, screen layout, the reader |
| `src/fonts/` | R Sans, Google Sans Flex, R Mono; [sources and licenses](src/fonts/README.md) |
