# Self-Hosted Fonts

This directory contains self-hosted font files to replace external Google Fonts imports.

## Font Files Required

### Inter Font (Sans-serif)
- inter-light.woff2 / inter-light.woff (300 weight)
- inter-regular.woff2 / inter-regular.woff (400 weight)  
- inter-medium.woff2 / inter-medium.woff (500 weight)
- inter-semibold.woff2 / inter-semibold.woff (600 weight)
- inter-bold.woff2 / inter-bold.woff (700 weight)

### IBM Plex Mono (Monospace)
- ibm-plex-mono-regular.woff2 / ibm-plex-mono-regular.woff (400 weight)
- ibm-plex-mono-medium.woff2 / ibm-plex-mono-medium.woff (500 weight)

### Material Icons
- material-symbols-outlined.woff2 / material-symbols-outlined.woff
- material-icons.woff2 / material-icons.woff

## Installation

To install the actual font files:

1. Download fonts from their respective sources:
   - Inter: https://rsms.me/inter/
   - IBM Plex Mono: https://github.com/IBM/plex
   - Material Icons: https://fonts.google.com/icons

2. Convert to WOFF/WOFF2 format for web optimization
   
3. Place files in this directory matching the names referenced in fonts.css

## Benefits

- Eliminates external font requests to Google Fonts CDN
- Reduces DNS lookups and connection overhead
- Improves performance in offline scenarios
- Better privacy (no external tracking)
- Consistent font loading behavior
- Reduced CLS (Cumulative Layout Shift)

## Performance Impact

- Reduces external HTTP requests from 3 to 0
- Eliminates render-blocking font requests
- Enables better font caching strategy
- Improves First Contentful Paint (FCP) times