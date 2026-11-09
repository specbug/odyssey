# Fonts

The web app bundles its fonts, so it renders the same offline and asks no
font CDN for anything. Four families are under the SIL Open Font License
1.1, with their copyright notices and the full license in
[OFL.txt](OFL.txt). The maths font is under the GUST Font License, in
[TeXGyrePagellaMath-GUST-FONT-LICENSE.txt](TeXGyrePagellaMath-GUST-FONT-LICENSE.txt).

| Files | Family | Used for | Source | Changes |
| --- | --- | --- | --- | --- |
| `RSans-*.woff2` | R Sans | running text | A modified version of [DM Sans](https://github.com/googlefonts/dm-fonts) | Renamed and adjusted; variable `opsz` 9–40, `wght` 100–1000 |
| `GoogleSansFlex-*.woff2` | Google Sans Flex | small text and numbers | [Google Fonts](https://fonts.google.com/specimen/Google+Sans+Flex) | Latin and Latin Extended subsets, instanced with fontTools to pin `GRAD`, `ROND`, `slnt` and `wdth` |
| `JetBrainsMono-*.woff2` | JetBrains Mono | code | [JetBrains](https://github.com/JetBrains/JetBrainsMono), via [Fontsource](https://fontsource.org/fonts/jetbrains-mono) | Latin and Latin Extended subsets; variable `wght` |
| `RMono-*.woff2` | R Mono | the ⌘ and ↵ glyphs in key hints | A custom build of [Iosevka](https://github.com/be5invis/Iosevka) | Renamed; Regular and Medium only |
| `TeXGyrePagellaMath.woff2` | TeX Gyre Pagella Math | maths | [GUST](https://www.gust.org.pl/projects/e-foundry/tg-math) | None: the whole font, compressed |

KaTeX itself (MIT) renders the MathML; none of its fonts or styles are
loaded.
