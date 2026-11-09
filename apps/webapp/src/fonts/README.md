# Fonts

The web app bundles its fonts, so it renders the same offline and asks no
font CDN for anything. All three families are under the SIL Open Font
License 1.1; [OFL.txt](OFL.txt) holds their copyright notices and the full
license.

| Files | Family | Source | Changes |
| --- | --- | --- | --- |
| `RSans-*.woff2` | R Sans | A modified version of [DM Sans](https://github.com/googlefonts/dm-fonts) | Renamed and adjusted; variable `opsz` 9–40, `wght` 100–1000 |
| `RMono-*.woff2` | R Mono | A custom build of [Iosevka](https://github.com/be5invis/Iosevka) | Renamed; Regular and Medium only |
| `GoogleSansFlex-*.woff2` | Google Sans Flex | [Google Fonts](https://fonts.google.com/specimen/Google+Sans+Flex) | Latin and Latin Extended subsets, instanced with fontTools to pin `GRAD`, `ROND`, `slnt` and `wdth` |

KaTeX's math fonts are not here: they load from the `katex` package, which is
MIT-licensed.
