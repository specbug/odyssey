import SwiftUI

/// Card content renderer supporting LaTeX, cloze deletions, and images
struct StudyCardContent: View {
    let content: String
    let imageStore: [String: NSImage]
    let isClozeCard: Bool
    let clozeIndex: Int
    let showAnswer: Bool
    let clozeColor: String
    let textColor: Color

    var body: some View {
        if isClozeCard {
            // Cloze card: render with cloze highlighting
            ClozeCardRenderer(
                content: content,
                imageStore: imageStore,
                clozeIndex: clozeIndex,
                showAnswer: showAnswer,
                clozeColor: clozeColor
            )
        } else {
            // Basic card: render normally
            BasicCardRenderer(
                content: content,
                imageStore: imageStore,
                clozeColor: clozeColor
            )
        }
    }
}

// MARK: - Basic Card Renderer

private struct BasicCardRenderer: View {
    let content: String
    let imageStore: [String: NSImage]
    let clozeColor: String

    var body: some View {
        InlineContentRenderer(
            text: content,
            imageStore: imageStore,
            clozeColor: clozeColor,
            clozeIndex: nil,
            showClozeAnswer: true
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Cloze Card Renderer

private struct ClozeCardRenderer: View {
    let content: String
    let imageStore: [String: NSImage]
    let clozeIndex: Int
    let showAnswer: Bool
    let clozeColor: String

    var body: some View {
        InlineContentRenderer(
            text: content,
            imageStore: imageStore,
            clozeColor: clozeColor,
            clozeIndex: clozeIndex,
            showClozeAnswer: showAnswer
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Inline Content Renderer

/// Renders mixed content: text with LaTeX, cloze deletions, and inline images
private struct InlineContentRenderer: View {
    let text: String
    let imageStore: [String: NSImage]
    let clozeColor: String
    let clozeIndex: Int?
    let showClozeAnswer: Bool

    var body: some View {
        let segments = parseContent()

        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                switch segment {
                case .text(let content):
                    TextSegmentRenderer(
                        text: content,
                        clozeColor: clozeColor,
                        clozeIndex: clozeIndex,
                        showClozeAnswer: showClozeAnswer
                    )

                case .image(let uuid):
                    if let image = imageStore[uuid] {
                        ImageSegmentRenderer(image: image)
                    } else {
                        Text("[Image not loaded: \(uuid.prefix(8))...]")
                            .font(.system(size: 12))
                            .foregroundColor(.gray.opacity(0.6))
                            .padding(8)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
        }
    }

    private enum ContentSegment {
        case text(String)
        case image(String) // UUID
    }

    private func parseContent() -> [ContentSegment] {
        let imagePattern = "\\[image:([a-fA-F0-9\\-]+)\\]"

        guard let regex = try? NSRegularExpression(pattern: imagePattern, options: []) else {
            return [.text(text)]
        }

        let nsString = text as NSString
        let range = NSRange(location: 0, length: nsString.length)
        let matches = regex.matches(in: text, options: [], range: range)

        var segments: [ContentSegment] = []
        var lastIndex = 0
        var accumulatedText = ""

        for match in matches {
            // Add text before the match
            if match.range.location > lastIndex {
                let textRange = NSRange(location: lastIndex, length: match.range.location - lastIndex)
                accumulatedText += nsString.substring(with: textRange)
            }

            // Flush accumulated text
            if !accumulatedText.isEmpty {
                segments.append(.text(accumulatedText))
                accumulatedText = ""
            }

            // Add the image
            if match.numberOfRanges > 1 {
                let uuidRange = match.range(at: 1)
                let uuid = nsString.substring(with: uuidRange)
                segments.append(.image(uuid))
            }

            lastIndex = match.range.location + match.range.length
        }

        // Add any remaining text
        if lastIndex < nsString.length {
            let textRange = NSRange(location: lastIndex, length: nsString.length - lastIndex)
            accumulatedText += nsString.substring(with: textRange)
        }

        if !accumulatedText.isEmpty {
            segments.append(.text(accumulatedText))
        }

        return segments.isEmpty ? [.text(text)] : segments
    }
}

// MARK: - Text Segment Renderer

private struct TextSegmentRenderer: View {
    let text: String
    let clozeColor: String
    let clozeIndex: Int?
    let showClozeAnswer: Bool

    @State private var contentHeight: CGFloat = 100

    var body: some View {
        if let clozeIndex = clozeIndex {
            // Render with cloze support
            ClozeAwareLatexView(
                text: text,
                clozeIndex: clozeIndex,
                showAnswer: showClozeAnswer,
                clozeColor: clozeColor,
                heightBinding: $contentHeight
            )
            .frame(height: max(contentHeight, 50))
            .frame(maxWidth: .infinity, alignment: .topLeading)
        } else {
            // Regular LaTeX rendering
            LatexRenderView(
                text: text,
                clozeColor: clozeColor,
                heightBinding: $contentHeight
            )
            .frame(height: max(contentHeight, 50))
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Cloze-Aware LaTeX View

/// Renders text with LaTeX and cloze deletion support
private struct ClozeAwareLatexView: View {
    let text: String
    let clozeIndex: Int
    let showAnswer: Bool
    let clozeColor: String
    @Binding var heightBinding: CGFloat

    var body: some View {
        // For now, delegate to LatexRenderView with cloze processing
        // In a full implementation, this would parse cloze syntax and render appropriately
        LatexRenderView(
            text: processedText,
            clozeColor: clozeColor,
            heightBinding: $heightBinding
        )
    }

    private var processedText: String {
        // Process cloze deletions
        let clozePattern = "\\{\\{c(\\d+)::(.+?)\\}\\}"
        guard let regex = try? NSRegularExpression(pattern: clozePattern, options: []) else {
            return text
        }

        let nsString = text as NSString
        let range = NSRange(location: 0, length: nsString.length)
        var result = text

        let matches = regex.matches(in: text, options: [], range: range).reversed()

        for match in matches {
            guard match.numberOfRanges > 2 else { continue }

            let indexRange = match.range(at: 1)
            let contentRange = match.range(at: 2)

            let idx = Int(nsString.substring(with: indexRange)) ?? 0
            let content = nsString.substring(with: contentRange)

            let matchRange = match.range

            if idx == clozeIndex {
                // This is the cloze we're testing
                let replacement: String
                if showAnswer {
                    // Show answer with highlight
                    replacement = "<span style='background-color: \(clozeColor); padding: 2px 4px; border-radius: 3px;'>\(content)</span>"
                } else {
                    // Show blank
                    replacement = "<span style='border-bottom: 3px solid \(clozeColor); display: inline-block; min-width: 80px; height: 1.2em;'></span>"
                }

                let nsResult = result as NSString
                result = nsResult.replacingCharacters(in: matchRange, with: replacement)
            } else {
                // Other clozes - just show content
                let nsResult = result as NSString
                result = nsResult.replacingCharacters(in: matchRange, with: content)
            }
        }

        return result
    }
}

// MARK: - Image Segment Renderer

private struct ImageSegmentRenderer: View {
    let image: NSImage

    private var displaySize: CGSize {
        let imageSize = image.size
        let maxWidth: CGFloat = 450
        let maxHeight: CGFloat = 350

        let widthRatio = maxWidth / imageSize.width
        let heightRatio = maxHeight / imageSize.height
        let scale = min(widthRatio, heightRatio, 1.0) // Don't upscale

        return CGSize(
            width: imageSize.width * scale,
            height: imageSize.height * scale
        )
    }

    var body: some View {
        Image(nsImage: image)
            .resizable()
            .scaledToFit()
            .frame(width: displaySize.width, height: displaySize.height)
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.black.opacity(0.1), lineWidth: 1)
            )
            .padding(.vertical, 4)
    }
}

#Preview("Basic Card") {
    ZStack {
        Color(hex: "#3778BF")
            .ignoresSafeArea()

        VStack {
            StudyCardContent(
                content: "This is a test note with **bold** text and $E = mc^2$ LaTeX.",
                imageStore: [:],
                isClozeCard: false,
                clozeIndex: 1,
                showAnswer: false,
                clozeColor: "rgba(114, 174, 248, 0.35)",
                textColor: .white
            )
            .padding(40)
        }
        .frame(maxWidth: 700)
    }
}

#Preview("Cloze Card - Hidden") {
    ZStack {
        Color(hex: "#69D84F")
            .ignoresSafeArea()

        VStack {
            StudyCardContent(
                content: "The capital of {{c1::France}} is {{c2::Paris}}.",
                imageStore: [:],
                isClozeCard: true,
                clozeIndex: 1,
                showAnswer: false,
                clozeColor: "rgba(255, 235, 59, 0.6)",
                textColor: .white
            )
            .padding(40)
        }
        .frame(maxWidth: 700)
    }
}

#Preview("Cloze Card - Revealed") {
    ZStack {
        Color(hex: "#69D84F")
            .ignoresSafeArea()

        VStack {
            StudyCardContent(
                content: "The capital of {{c1::France}} is {{c2::Paris}}.",
                imageStore: [:],
                isClozeCard: true,
                clozeIndex: 1,
                showAnswer: true,
                clozeColor: "rgba(255, 235, 59, 0.6)",
                textColor: .white
            )
            .padding(40)
        }
        .frame(maxWidth: 700)
    }
}
