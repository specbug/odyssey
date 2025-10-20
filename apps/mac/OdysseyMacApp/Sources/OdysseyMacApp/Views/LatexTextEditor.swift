import SwiftUI
import AppKit

/// A text editor that highlights LaTeX syntax in pink color (#f56bb5)
/// and cloze deletions in blue color (#72aef8)
/// Supports both inline ($...$) and block ($$...$$) LaTeX
/// Supports cloze deletions ({{c1::text}}, {{c2::text}}, etc.)
struct LatexTextEditor: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let font: NSFont
    let textColor: NSColor
    let latexColor: NSColor
    let clozeColor: NSColor
    var focusState: FocusState<Bool>.Binding?
    var heightBinding: Binding<CGFloat>?

    init(
        text: Binding<String>,
        placeholder: String = "",
        font: NSFont = .systemFont(ofSize: 22),
        textColor: NSColor = NSColor(red: 0, green: 0, blue: 0, alpha: 0.8),
        latexColor: NSColor = NSColor(red: 0xf5/255.0, green: 0x6b/255.0, blue: 0xb5/255.0, alpha: 1.0),
        clozeColor: NSColor = NSColor(red: 0x72/255.0, green: 0xae/255.0, blue: 0xf8/255.0, alpha: 1.0),
        focusState: FocusState<Bool>.Binding? = nil,
        heightBinding: Binding<CGFloat>? = nil
    ) {
        self._text = text
        self.placeholder = placeholder
        self.font = font
        self.textColor = textColor
        self.latexColor = latexColor
        self.clozeColor = clozeColor
        self.focusState = focusState
        self.heightBinding = heightBinding
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        // Create scroll view manually (not using convenience method)
        let scrollView = NSScrollView()
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = false
        scrollView.drawsBackground = false

        // Create text view manually
        let textView = NSTextView(frame: .zero)

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

        // Make text view expand vertically with content (no scrolling)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)

        // Configure text container for unlimited height
        if let textContainer = textView.textContainer {
            textContainer.widthTracksTextView = true
            textContainer.heightTracksTextView = false
            textContainer.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        }

        // Set text view as document view
        scrollView.documentView = textView

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

        // Update text view frame to fit content
        updateTextViewHeight(textView)
    }

    private func updateTextViewHeight(_ textView: NSTextView) {
        guard let layoutManager = textView.layoutManager,
              let textContainer = textView.textContainer else { return }

        // Ensure layout is up to date
        layoutManager.ensureLayout(for: textContainer)

        // Calculate the height needed for all text
        let usedRect = layoutManager.usedRect(for: textContainer)
        var contentHeight = usedRect.height

        // Add some padding for better appearance
        contentHeight += 10

        // Set the text view's frame to match content height
        let currentWidth = textView.frame.width
        textView.frame = NSRect(x: 0, y: 0, width: currentWidth, height: contentHeight)

        // Notify SwiftUI about the height change
        if let heightBinding = heightBinding {
            DispatchQueue.main.async {
                heightBinding.wrappedValue = contentHeight
            }
        }
    }

    private func highlightLatex(in text: String) -> NSAttributedString {
        let attributed = NSMutableAttributedString(string: text)

        // Set default attributes
        let range = NSRange(location: 0, length: text.count)
        attributed.addAttribute(.font, value: font, range: range)
        attributed.addAttribute(.foregroundColor, value: textColor, range: range)

        // Find and highlight cloze deletions ({{c1::text}}, {{c2::text}}, etc.)
        let clozePattern = #"\{\{c\d+::[^}]+\}\}"#
        if let clozeRegex = try? NSRegularExpression(pattern: clozePattern, options: []) {
            let matches = clozeRegex.matches(in: text, options: [], range: range)
            for match in matches {
                attributed.addAttribute(.foregroundColor, value: clozeColor, range: match.range)
            }
        }

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

                // Update text view height to fit new content
                parent.updateTextViewHeight(textView)
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
        {{c1::Scalar}} product is denoted with a {{c2::$\\cdot$}} notation.

        This is inline math: $v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}$

        And this is block math:
        $$
        v=\\frac{x_{1}-x_{0}}{t_{1}-t_{0}}
        $$

        More text with cloze: {{c3::Important concept}}
        """

        var body: some View {
            VStack {
                Text("LaTeX Text Editor (Edit Mode)")
                    .font(.headline)

                LatexTextEditor(text: $text, placeholder: "Enter text with LaTeX and clozes...")
                    .frame(height: 300)
                    .padding()
            }
        }
    }

    return PreviewWrapper()
}
