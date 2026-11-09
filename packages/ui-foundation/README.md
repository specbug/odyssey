# @odyssey/ui-foundation

Design tokens for the macOS client: colours, type, spacing and radii in
[`tokens.json`](tokens.json), re-exported for JavaScript by `index.js`.

These are the tokens of Odyssey's earlier design. The web app has since moved
to the system in [`apps/webapp/DESIGN.md`](../../apps/webapp/DESIGN.md), whose
tokens are in `apps/webapp/src/styles/tokens.css`. The macOS client has not
followed yet.

## Syncing into the macOS client

```bash
./scripts/sync-design-tokens.sh
```

The script copies `tokens.json` into the client's resources. A new token also
needs a matching constant in `DesignTokens.swift`, added by hand.
