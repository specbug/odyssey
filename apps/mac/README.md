# Odyssey for macOS

A native SwiftUI client for the Odyssey [API](../api/README.md). It browses
documents and notes, runs review sessions, and captures notes with LaTeX and
images. Scheduling and storage stay on the server, and the app keeps no data
of its own.

## Requirements

- macOS 14 or later
- Swift 5.9 or later (Xcode 15 or later)
- A running Odyssey server, `http://localhost:8000` by default

## Build and run

```bash
cd OdysseyMacApp
swift build
swift run OdysseyMacApp
swift test
```

The server address is set in the app's Settings and kept between launches.

## Source layout

| Path | Contents |
| --- | --- |
| `Sources/OdysseyMacApp/App/` | Entry point, app state, menu commands |
| `Sources/OdysseyMacApp/Services/` | API client and server address |
| `Sources/OdysseyMacApp/Models/` | Codable types matching the API's schemas |
| `Sources/OdysseyMacApp/ViewModels/` | Browse and study view models |
| `Sources/OdysseyMacApp/Views/` | Browse, study, capture and settings screens |
| `Sources/OdysseyMacApp/DesignSystem/` | Colours, type and button styles |

## Status

The client predates the web app's current design
([`DESIGN.md`](../webapp/DESIGN.md)). It still draws with the earlier tokens
in [`packages/ui-foundation`](../../packages/ui-foundation) and the retired
starburst logo. CI does not build it.
