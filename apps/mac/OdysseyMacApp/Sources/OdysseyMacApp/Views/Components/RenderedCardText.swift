import SwiftUI

// MARK: - Rendered Card Text
// Smart text renderer that handles cloze deletions, LaTeX, and images

struct RenderedCardText: View {
    let text: String
    let maxLines: Int
    let palette: OdysseyColorPalette
    let fontSize: CGFloat

    init(
        text: String,
        maxLines: Int = 3,
        fontSize: CGFloat = 14,
        palette: OdysseyColorPalette
    ) {
        self.text = text
        self.maxLines = maxLines
        self.fontSize = fontSize
        self.palette = palette
    }

    var body: some View {
        Text(renderedContent)
            .font(OdysseyFont.dr(fontSize, weight: .medium))  // Use Dr font
            .lineLimit(maxLines)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Content Rendering

    private var renderedContent: AttributedString {
        let segments = ContentParser.parse(text)
        var attributedString = AttributedString()

        for segment in segments {
            switch segment {
            case .text(let content):
                var textSegment = AttributedString(content)
                textSegment.foregroundColor = Color(OdysseyColor.ink)
                attributedString.append(textSegment)

            case .cloze(let content, _):
                var clozeSegment = AttributedString(content)
                clozeSegment.foregroundColor = Color(hex: "#ff4d06")  // Accent color
                clozeSegment.underlineStyle = .single
                attributedString.append(clozeSegment)

            case .latex(let content, let isBlock):
                let rendered = renderLatex(content, isBlock: isBlock)
                var latexSegment = AttributedString(rendered)
                latexSegment.foregroundColor = Color(palette.secondaryAccentColor)
                latexSegment.font = .system(size: fontSize, design: .monospaced)
                attributedString.append(latexSegment)

            case .image(let uuid):
                let placeholder = renderImagePlaceholder(uuid)
                attributedString.append(placeholder)
            }
        }

        return attributedString
    }

    // MARK: - LaTeX Rendering

    private func renderLatex(_ latex: String, isBlock: Bool) -> String {
        if isBlock {
            // Block LaTeX: show truncated with math prefix
            let truncated = ContentParser.truncateLatex(latex, maxLength: 15)
            return "𝑓(𝑥) = " + truncated
        } else {
            // Inline LaTeX: try to convert to Unicode
            let unicode = ContentParser.latexToUnicode(latex)
            if unicode.count > 25 {
                return String(unicode.prefix(25)) + "..."
            }
            return unicode
        }
    }

    // MARK: - Image Placeholder

    private func renderImagePlaceholder(_ uuid: String) -> AttributedString {
        // Show a geometric image indicator using Unicode
        // Using camera emoji as a visible placeholder
        var placeholder = AttributedString(" [📷] ")
        placeholder.foregroundColor = Color(hex: "#ff4d06")  // Accent color
        placeholder.font = .system(size: fontSize + 2)  // Slightly larger
        return placeholder
    }
}

// MARK: - Preview

#Preview {
    let palette = OdysseyColorPalette.named(.red)

    VStack(spacing: 24) {
        // Cloze example
        RenderedCardText(
            text: "{{c1::Kinematics}} is the study of force, matter and motion.",
            palette: palette
        )

        // LaTeX example
        RenderedCardText(
            text: "The formula is $a=b+c$ where $a$ is the sum.",
            palette: palette
        )

        // Block LaTeX
        RenderedCardText(
            text: "This is an inline latex block: $$\\sum_{i=1}^{n} x_i$$",
            palette: palette
        )

        // Image example
        RenderedCardText(
            text: "Photo of Mona Lisa [image:5BB62O44-911E-45O3-8D67-7D00C18539AC]",
            palette: palette
        )

        // Mixed example
        RenderedCardText(
            text: "{{c1::Newton's}} second law states $F=ma$ [image:ABC123] where force equals mass times {{c2::acceleration}}.",
            palette: palette
        )
    }
    .padding()
    .frame(width: 300)
}
