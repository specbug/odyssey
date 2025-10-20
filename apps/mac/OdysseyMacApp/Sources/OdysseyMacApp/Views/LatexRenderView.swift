import SwiftUI
import WebKit

/// A view that renders LaTeX content using KaTeX
/// Supports both inline ($...$) and block ($$...$$) LaTeX
/// Supports cloze deletions ({{c1::text}}, {{c2::text}}, etc.)
struct LatexRenderView: NSViewRepresentable {
    let text: String
    let clozeColor: String
    var heightBinding: Binding<CGFloat>?

    init(text: String, clozeColor: String = "rgba(114, 174, 248, 0.35)", heightBinding: Binding<CGFloat>? = nil) {
        self.text = text
        self.clozeColor = clozeColor
        self.heightBinding = heightBinding
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> WKWebView {
        let prefs = WKPreferences()
        prefs.javaScriptEnabled = true

        let config = WKWebViewConfiguration()
        config.preferences = prefs

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = context.coordinator
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        let html = generateHTML(with: text)
        nsView.loadHTMLString(html, baseURL: Bundle.module.resourceURL)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: LatexRenderView

        init(_ parent: LatexRenderView) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Calculate content height after page loads
            webView.evaluateJavaScript("document.body.scrollHeight") { [weak self] result, error in
                guard let self = self,
                      let height = result as? CGFloat else { return }

                // Add some padding
                let contentHeight = height + 40

                // Update SwiftUI
                if let heightBinding = self.parent.heightBinding {
                    DispatchQueue.main.async {
                        heightBinding.wrappedValue = contentHeight
                    }
                }
            }
        }
    }

    private func generateHTML(with text: String) -> String {
        // Escape the text content for safe HTML embedding
        let escapedText = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")

        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="katex.min.css">
            <script defer src="katex.min.js"></script>
            <style>
                body {
                    padding: 20px;
                    margin: 0;
                    background-color: transparent !important;
                    color: rgba(0, 0, 0, 0.8);
                    font-family: "Dr", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-size: 22px;
                    line-height: 1.6;
                }

                /* Style for inline LaTeX */
                .katex {
                    font-size: 1.1em;
                }

                /* Style for block LaTeX */
                .katex-display {
                    margin: 1em 0;
                }

                /* Preserve whitespace and line breaks */
                #content {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                /* Style for cloze deletions */
                .cloze-highlight {
                    background-color: \(clozeColor);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
            </style>
        </head>
        <body>
            <div id="content"></div>
            <script>
                // Process text with LaTeX and cloze deletions
                function renderLatex() {
                    let text = `\(escapedText)`;
                    const contentDiv = document.getElementById('content');

                    // First, process cloze deletions: {{c1::text}} -> <span class="cloze-highlight">text</span>
                    const clozeRegex = /\\{\\{c\\d+::([^}]+)\\}\\}/g;
                    text = text.replace(clozeRegex, '<span class="cloze-highlight">$1</span>');

                    // Process the text, replacing LaTeX with rendered versions
                    let processedText = text;

                    // First, handle display (block) math: $$...$$
                    const displayMathRegex = /\\$\\$([\\s\\S]*?)\\$\\$/g;
                    const displayMatches = [];
                    let match;

                    while ((match = displayMathRegex.exec(text)) !== null) {
                        displayMatches.push({
                            full: match[0],
                            latex: match[1].trim(),
                            index: match.index,
                            type: 'display'
                        });
                    }

                    // Then handle inline math: $...$
                    const inlineMathRegex = /\\$([^\\$]+?)\\$/g;
                    const inlineMatches = [];

                    while ((match = inlineMathRegex.exec(text)) !== null) {
                        // Check if this match is inside a display math block
                        let isInsideDisplay = false;
                        for (const dm of displayMatches) {
                            if (match.index >= dm.index && match.index < dm.index + dm.full.length) {
                                isInsideDisplay = true;
                                break;
                            }
                        }

                        if (!isInsideDisplay) {
                            inlineMatches.push({
                                full: match[0],
                                latex: match[1].trim(),
                                index: match.index,
                                type: 'inline'
                            });
                        }
                    }

                    // Combine and sort all matches by index (in reverse order for replacement)
                    const allMatches = [...displayMatches, ...inlineMatches].sort((a, b) => b.index - a.index);

                    // Replace LaTeX with rendered HTML
                    let result = text;
                    for (const match of allMatches) {
                        try {
                            const rendered = katex.renderToString(match.latex, {
                                throwOnError: false,
                                displayMode: match.type === 'display'
                            });

                            const before = result.substring(0, match.index);
                            const after = result.substring(match.index + match.full.length);
                            result = before + rendered + after;
                        } catch (e) {
                            console.error('Error rendering LaTeX:', e);
                        }
                    }

                    contentDiv.innerHTML = result;
                }

                document.addEventListener("DOMContentLoaded", renderLatex);
            </script>
        </body>
        </html>
        """
    }
}

#Preview {
    LatexRenderView(text: """
    {{c1::Scalar}} product is denoted with a {{c2::$\\cdot$}} notation.

    This is inline math: $v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}$

    And this is block math:
    $$
    v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}
    $$

    More text with cloze: {{c3::Important concept}}
    """)
    .frame(width: 600, height: 400)
}
