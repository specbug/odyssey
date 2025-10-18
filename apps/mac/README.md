# Odyssey macOS Client

## Goals
- Deliver a native SwiftUI experience that mirrors Odyssey’s Orbit-inspired typography, spacing, and gradient accents defined in `apps/webapp/src/App.css`.
- Treat the macOS app as a pure client: all scheduling, review logic, and persistence remain in the FastAPI backend.
- Maintain existing backend conventions for migrations (`migrate.py` with `migrate()`/`downgrade()` functions) when adding any desktop-supporting fields.

## High-Level Architecture
- **App Shell**: SwiftUI `OdysseyApp` entry point managing window scenes, app state hydration, deep links, and background refresh triggers.
- **Screens**
  - Library: lists documents with status badges (`StudyCard`/`Annotation` summaries).
  - Reader: PDFKit-backed view embedding highlight overlays; annotation creation flows call `/annotations` endpoints.
  - Review Desk: fetches `/reviews/due` batches, renders FSRS prompts, posts results via `/reviews/submit`.
  - Capture Composer: rich text + cloze editor using SwiftUI `TextEditor` with custom inline styling.
- **Networking**
  - Shared TypeScript client logic extracted into `packages/odyssey-sdk` for parity with web; Swift app consumes a generated OpenAPI client plus lightweight Swift wrappers.
  - Authentication via PAT or existing token exchange, stored securely in keychain.
- **Storage**
  - Local cache leverages `URLCache` + optional `CoreData`/`SQLite` for offline snapshots; sync routines delegate conflict resolution to backend timestamps.
- **Design System**
  - Recreate color tokens (`--orbit-*` from web CSS) as Swift `Color` extensions.
  - Custom font registration for Dr family shipped with app bundle.
  - Component primitives (Toolbar, GradientButton, CardSurface) mirror React implementations.

## Roadmap
1. Scaffold Swift Package-based SwiftUI project (`OdysseyMacApp`) with configurable environments and shared styling layer.
2. Extract web design tokens into `packages/ui-foundation` and consume via JS (web) + generated JSON for Swift.
3. Implement auth & library flows; ensure backend endpoints cover bulk fetch/sync without branching logic.
4. Build reader & annotation UI, followed by review session experience.
5. Add desktop-friendly touches (menu commands, keyboard shortcuts, haptics) and polish animations.

## Backend Considerations
- Introduce optional `client_version`, `last_synced_at`, and `device_id` fields via manually managed `migrate.py` scripts in API app modules.
- Provide batch sync endpoints (`/annotations/sync`, `/reviews/batch`) with idempotent payloads to reduce chattiness.
- Extend FastAPI schemas for any new metadata while keeping business logic server-side.

## Build & Run (future)
- Requires Swift 5.9+/macOS 14+ toolchain.
- Build via `xcodebuild -scheme OdysseyMacApp -destination 'platform=macOS,arch=arm64'` (project file committed in subsequent steps).
- Run with `open OdysseyMacApp.xcodeproj` or `swift run OdysseyMacApp` once SPM scaffolding is complete.

## Maintenance
- Keep `packages/ui-foundation/tokens.json` as the single design-token source; sync into the mac app bundle with `./scripts/sync-design-tokens.sh`.
- When adding new fonts, place `.ttf/.otf` sources under `apps/mac/OdysseyMacApp/Sources/OdysseyMacApp/Resources/Fonts` and register them in Swift via `Font.register`.
