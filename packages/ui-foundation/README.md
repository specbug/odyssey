# @odyssey/ui-foundation

Design tokens for the macOS app: colours, type, spacing and radii, in
[`tokens.json`](tokens.json), with a JavaScript export in `index.js`.

These are the tokens of Odyssey's earlier design. The web app has since moved
to the system in [`apps/webapp/DESIGN.md`](../../apps/webapp/DESIGN.md), whose
tokens live in `apps/webapp/src/styles/tokens.css`. Bringing the macOS app
across is open work.

## Sync into the macOS app

```bash
./scripts/sync-design-tokens.sh
```

This copies `tokens.json` into the app's resources. Update
`DesignTokens.swift` by hand when you add a token.
