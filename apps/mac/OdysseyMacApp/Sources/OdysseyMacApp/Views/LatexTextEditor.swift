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
    let imageColor: NSColor
    var focusState: FocusState<Bool>.Binding?
    var heightBinding: Binding<CGFloat>?
    var onImagePasted: ((NSImage, String) -> Void)?  // Callback with image and UUID

    init(
        text: Binding<String>,
        placeholder: String = "",
        font: NSFont = .systemFont(ofSize: 22),
        textColor: NSColor = NSColor(red: 0, green: 0, blue: 0, alpha: 0.8),
        latexColor: NSColor = NSColor(red: 0xf5/255.0, green: 0x6b/255.0, blue: 0xb5/255.0, alpha: 1.0),
        clozeColor: NSColor = NSColor(red: 0x72/255.0, green: 0xae/255.0, blue: 0xf8/255.0, alpha: 1.0),
        imageColor: NSColor = NSColor(red: 0x4a/255.0, green: 0xb8/255.0, blue: 0x7f/255.0, alpha: 1.0),
        focusState: FocusState<Bool>.Binding? = nil,
        heightBinding: Binding<CGFloat>? = nil,
        onImagePasted: ((NSImage, String) -> Void)? = nil
    ) {
        self._text = text
        self.placeholder = placeholder
        self.font = font
        self.textColor = textColor
        self.latexColor = latexColor
        self.clozeColor = clozeColor
        self.imageColor = imageColor
        self.focusState = focusState
        self.heightBinding = heightBinding
        self.onImagePasted = onImagePasted
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

        // Create custom text view that handles image pasting
        let textView = ImagePasteTextView(frame: .zero)
        textView.coordinator = context.coordinator

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
        guard let textView = nsView.documentView as? ImagePasteTextView else { return }

        // Update coordinator reference
        textView.coordinator = context.coordinator

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

        // Find and highlight image markers [image:uuid]
        let imagePattern = #"\[image:[a-fA-F0-9\-]+\]"#
        if let imageRegex = try? NSRegularExpression(pattern: imagePattern, options: []) {
            let matches = imageRegex.matches(in: text, options: [], range: range)
            for match in matches {
                attributed.addAttribute(.foregroundColor, value: imageColor, range: match.range)
            }
        }

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

    // Custom NSTextView subclass that handles image pasting
    class ImagePasteTextView: NSTextView {
        weak var coordinator: Coordinator?

        override func readSelection(from pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
            // Check explicitly for image types
            let imageTypes: [NSPasteboard.PasteboardType] = [
                .png,
                .tiff,
                NSPasteboard.PasteboardType("public.jpeg"),
                NSPasteboard.PasteboardType("public.png"),
                NSPasteboard.PasteboardType("public.tiff")
            ]

            // Check if pasteboard has any image type
            var foundImage: NSImage?
            for imageType in imageTypes {
                if let _ = pboard.availableType(from: [imageType]) {
                    if let data = pboard.data(forType: imageType),
                       let image = NSImage(data: data) {
                        foundImage = image
                        break
                    }
                }
            }

            // Also try the generic NSImage initializer
            if foundImage == nil {
                foundImage = NSImage(pasteboard: pboard)
            }

            // If we found an image, handle it
            if let image = foundImage, let coordinator = coordinator {
                // DEBUG: Log image properties
                print("🖼️ PASTE: NSImage.size = \(image.size)")
                if let bitmapRep = image.representations.compactMap({ $0 as? NSBitmapImageRep }).first {
                    print("🖼️ PASTE: Bitmap pixels = \(bitmapRep.pixelsWide)x\(bitmapRep.pixelsHigh)")
                } else {
                    print("⚠️ PASTE: No bitmap representation found!")
                }

                // Generate UUID for this image
                let uuid = UUID().uuidString

                // Insert marker at cursor position
                let cursorPosition = self.selectedRange().location
                let imageMarker = "[image:\(uuid)]"

                // Insert the marker
                if let textStorage = self.textStorage {
                    let insertRange = NSRange(location: cursorPosition, length: 0)
                    textStorage.replaceCharacters(in: insertRange, with: imageMarker)

                    // Update coordinator's parent text
                    coordinator.parent.text = self.string

                    // Call callback to store the image
                    coordinator.parent.onImagePasted?(image, uuid)

                    // Reapply syntax highlighting
                    let newCursorPosition = cursorPosition + imageMarker.count
                    let highlighted = coordinator.parent.highlightLatex(in: self.string)
                    textStorage.setAttributedString(highlighted)

                    // Move cursor after the marker
                    self.setSelectedRange(NSRange(location: newCursorPosition, length: 0))

                    // Update height
                    coordinator.parent.updateTextViewHeight(self)
                }
                return true // Image handled
            }

            // No image, use default behavior for text
            return super.readSelection(from: pboard, type: type)
        }

        override var readablePasteboardTypes: [NSPasteboard.PasteboardType] {
            var types = super.readablePasteboardTypes
            // Add image types
            types.append(NSPasteboard.PasteboardType.png)
            types.append(NSPasteboard.PasteboardType.tiff)
            types.append(NSPasteboard.PasteboardType("public.jpeg"))
            types.append(NSPasteboard.PasteboardType("public.png"))
            return types
        }
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: LatexTextEditor

        init(_ parent: LatexTextEditor) {
            self.parent = parent
            super.init()
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
