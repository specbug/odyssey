# Contributing to Odyssey

Thanks for your interest. Bug reports, fixes, documentation and ideas are all
welcome. This page covers how to propose a change and what a pull request
needs before it can merge.

## Before you start

- **Bugs.** Search [existing issues](https://github.com/specbug/odyssey/issues)
  first. If it isn't there, open one with the steps to reproduce it.
- **Features and larger changes.** Open an issue to discuss the idea before
  writing code. It saves you building something that doesn't fit.
- **Security issues.** Don't open a public issue. Follow
  [SECURITY.md](SECURITY.md).

Everyone taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).

## Setting up

The repository holds three apps that share one API.

### API (`apps/api`)

Python 3.11. The pinned pydantic does not build on 3.13.

```bash
cd apps/api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python run.py          # http://localhost:8000, docs at /docs
python -m pytest       # tests
```

The tests use a throwaway SQLite database and a fake LLM, so they need no
network or API key.

### Web app (`apps/webapp`)

React, built with Create React App. Use [bun](https://bun.sh), not npm: the
lockfile is `bun.lock`.

```bash
cd apps/webapp
bun install
bun run start                       # http://localhost:3000/odyssey
CI=true bun run test --watchAll=false
CI=true bun run build               # warnings fail the build, as in CI
```

### macOS app (`apps/mac/OdysseyMacApp`)

macOS 14 and Swift 5.9 or later.

```bash
cd apps/mac/OdysseyMacApp
swift build
swift test
```

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep each pull request to one change. Unrelated fixes go in their own.
3. Add or update tests for behaviour you change. API changes need a pytest
   case; web changes with logic worth testing need a Jest case.
4. Run the checks above for every app you touched.
5. Update the docs that describe what you changed: the README, an app's
   README, or [`CLAUDE.md`](CLAUDE.md), which is the detailed architecture
   reference.
6. Open a pull request and fill in the template.

CI runs the API tests and the web app's tests and production build on every
pull request. A pull request merges once CI passes and a maintainer has
approved it.

## Conventions

- **Visual changes.** Read [`apps/webapp/DESIGN.md`](apps/webapp/DESIGN.md)
  first. It sets the type, the colour signals, layout and motion, and pull
  requests are reviewed against it. Include before and after screenshots, in
  light and dark mode.
- **Copy.** Plain and specific, in sentence case: "No documents.", "Couldn't
  load library. Server not responding."
- **Cloze syntax** is `[[word]]`. Each blank is its own card.
- **Database.** Tables are created by SQLAlchemy on startup. A change to an
  existing table needs a migration path for existing databases; say how in
  the pull request.
- **Commit messages.** A short summary line in the imperative ("Add page dial
  keyboard control"), then a body that explains why.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE), the project's license.
