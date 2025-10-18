# @odyssey/ui-foundation

Centralized design tokens for Odyssey clients (web, macOS, future surfaces). Tokens mirror the values in `apps/webapp/src/App.css` and are meant to stay source-of-truth for colors, typography, spacing, and radii.

## Usage

```bash
npm install --save-dev @odyssey/ui-foundation
```

```ts
import { colors, spacing } from "@odyssey/ui-foundation";

const toolbarStyle = {
  background: `linear-gradient(135deg, ${colors.background}, ${colors.secondaryBackground})`,
  padding: spacing.lg,
};
```

## Swift Integration

- A build step will export `tokens.json` into the macOS app bundle.
- `DesignTokens.swift` can decode the JSON for runtime updates (currently hard-coded with the same values until the pipeline lands).

## Updating Tokens

1. Modify `tokens.json`.
2. Update any Swift constants (`DesignTokens.swift`) and CSS variables if new tokens are introduced.
3. Bump the package version if publishing outside the monorepo.
