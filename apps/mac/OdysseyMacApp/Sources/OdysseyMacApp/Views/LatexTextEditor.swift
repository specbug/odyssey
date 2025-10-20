import SwiftUI
import AppKit

/// A text editor that highlights LaTeX syntax in violet color (#ad89fb)
/// Supports both inline ($...$) and block ($$...$$) LaTeX
struct LatexTextEditor: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let font: NSFont
    let textColor: NSColor
    let latexColor: NSColor
    var focusState: FocusState<Bool>.Binding?

    init(
        text: Binding<String>,
        placeholder: String = "",
        font: NSFont = .systemFont(ofSize: 22),
        textColor: NSColor = NSColor(red: 0, green: 0, blue: 0, alpha: 0.8),
        latexColor: NSColor = NSColor(red: 0xad/255.0, green: 0x89/255.0, blue: 0xfb/255.0, alpha: 1.0),
        focusState: FocusState<Bool>.Binding? = nil
    ) {
        self._text = text
        self.placeholder = placeholder
        self.font = font
        self.textColor = textColor
        self.latexColor = latexColor
        self.focusState = focusState
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        guard let textView = scrollView.documentView as? NSTextView else {
            return scrollView
        }

        // Configure text view
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.font = font
        textView.textColor = textColor
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false

        // Set initial text with syntax highlighting
        updateTextViewContent(textView, with: text)

        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? NSTextView else { return }

        // Only update if text changed from outside
        if textView.string != text {
            let selectedRange = textView.selectedRanges.first as? NSRange ?? NSRange(location: 0, length: 0)
            updateTextViewContent(textView, with: text)

            // Restore cursor position if possible
            if selectedRange.location <= textView.string.count {
                textView.setSelectedRange(selectedRange)
            }
        }
    }

    private func updateTextViewContent(_ textView: NSTextView, with text: String) {
        let attributedString = highlightLatex(in: text)
        textView.textStorage?.setAttributedString(attributedString)
    }

    private func highlightLatex(in text: String) -> NSAttributedString {
        let attributed = NSMutableAttributedString(string: text)

        // Set default attributes
        let range = NSRange(location: 0, length: text.count)
        attributed.addAttribute(.font, value: font, range: range)
        attributed.addAttribute(.foregroundColor, value: textColor, range: range)

        // Find and highlight display math ($$...$$)
        let displayPattern = #"\$\$[\s\S]*?\$\$"#
        if let displayRegex = try? NSRegularExpression(pattern: displayPattern, options: []) {
            let matches = displayRegex.matches(in: text, options: [], range: range)
            for match in matches {
                attributed.addAttribute(.foregroundColor, value: latexColor, range: match.range)
            }
        }

        // Find and highlight inline math ($...$), but not those inside display math
        let inlinePattern = #"\$[^\$\n]+?\$"#
        if let inlineRegex = try? NSRegularExpression(pattern: inlinePattern, options: []) {
            let matches = inlineRegex.matches(in: text, options: [], range: range)

            // Get display math ranges to avoid double-highlighting
            var displayRanges: [NSRange] = []
            if let displayRegex = try? NSRegularExpression(pattern: displayPattern, options: []) {
                displayRanges = displayRegex.matches(in: text, options: [], range: range).map { $0.range }
            }

            for match in matches {
                // Check if this inline match is inside a display math block
                let isInsideDisplay = displayRanges.contains { displayRange in
                    match.range.location >= displayRange.location &&
                    match.range.location < displayRange.location + displayRange.length
                }

                if !isInsideDisplay {
                    attributed.addAttribute(.foregroundColor, value: latexColor, range: match.range)
                }
            }
        }

        return attributed
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: LatexTextEditor

        init(_ parent: LatexTextEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }

            let newText = textView.string
            if parent.text != newText {
                parent.text = newText

                // Reapply syntax highlighting
                let selectedRange = textView.selectedRanges.first as? NSRange ?? NSRange(location: 0, length: 0)
                let highlighted = parent.highlightLatex(in: newText)
                textView.textStorage?.setAttributedString(highlighted)

                // Restore cursor position
                if selectedRange.location <= textView.string.count {
                    textView.setSelectedRange(selectedRange)
                }
            }
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }

            // Update focus state if provided
            if let focusState = parent.focusState {
                let isFirstResponder = textView.window?.firstResponder == textView
                if focusState.wrappedValue != isFirstResponder {
                    focusState.wrappedValue = isFirstResponder
                }
            }
        }
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var text = """
        This is inline math: $v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}$

        And this is block math:
        $$
        v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}
        $$

        More text here with another inline: $E=mc^2$
        """

        var body: some View {
            VStack {
                Text("LaTeX Text Editor (Edit Mode)")
                    .font(.headline)

                LatexTextEditor(text: $text, placeholder: "Enter text with LaTeX...")
                    .frame(height: 300)
                    .padding()
            }
        }
    }

    return PreviewWrapper()
}
