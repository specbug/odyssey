# Contributing to Odyssey

Odyssey is three programs that share one API: a FastAPI server, a React web
app, and a SwiftUI client for macOS. This page covers how to propose a
change and what a pull request needs before it merges.

## Before writing code

- **Bugs.** Search the [issues](https://github.com/specbug/odyssey/issues)
  first. A new report needs the steps that reproduce it; a bug that can't be
  reproduced can't be confirmed fixed.
- **Features and larger changes.** Open an issue first. A paragraph of
  discussion costs less than a pull request that doesn't fit.
- **Security issues.** Report them privately, as [SECURITY.md](SECURITY.md)
  describes.

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setting up

### API (`apps/api`)

Python 3.11. The pinned pydantic does not build on 3.13.

```bash
cd apps/api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python run.py          # http://localhost:8000, docs at /docs
python -m pytest
```

The tests use a throwaway SQLite database and a scripted fake in place of the
language model, so they need neither a network nor an API key.

### Web app (`apps/webapp`)

React, built with Create React App and managed with [bun](https://bun.sh).
The lockfile is `bun.lock`; npm would write a second one.

```bash
cd apps/webapp
bun install
bun run start                       # http://localhost:3000/odyssey
CI=true bun run test --watchAll=false
CI=true bun run build
```

`CI=true` turns lint warnings into build errors, as CI does.

### macOS client (`apps/mac/OdysseyMacApp`)

macOS 14 and Swift 5.9 or later.

```bash
cd apps/mac/OdysseyMacApp
swift build
swift test
```

## Making a change

1. Fork the repository and branch from `main`.
2. Make one change per pull request. An unrelated fix goes in its own.
3. Test the behaviour you change: a pytest case for the API, a Jest case for
   web logic.
4. Run the checks above for every app you touched.
5. Update the documentation that describes the old behaviour: the README, the
   app's README, or [`CLAUDE.md`](CLAUDE.md), the full architecture reference.
6. Open the pull request and fill in its template.

CI runs the API tests and the web app's tests and production build on every
pull request. A pull request merges when CI passes and a maintainer approves
it.

## Conventions

- **Visual changes** follow [`apps/webapp/DESIGN.md`](apps/webapp/DESIGN.md),
  which sets the type, the four colour signals, layout and motion. Attach
  before and after screenshots in light and dark mode.
- **Interface copy** is plain and in sentence case. An empty library says
  "No documents." A failed load says "Couldn't load library. Server not
  responding." and offers Retry.
- **Cloze syntax** is `[[word]]`, and each blank is a separate card.
- **Database.** SQLAlchemy creates missing tables on startup, but it never
  alters an existing one. A schema change needs an idempotent migration
  function in `app/main.py`, called at startup, so databases created before
  the change still open; `_migrate_study_card_cloze_index` is an example.
- **Commit messages** start with a short summary in the imperative ("Add page
  dial keyboard control"), followed by a body that says why.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE), the
project's license.
