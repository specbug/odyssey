import Foundation
import SwiftUI

// MARK: - Content Parser
// Parses card text to extract and render cloze deletions, LaTeX, and images

struct ContentParser {

    // MARK: - Content Types

    enum ContentSegment {
        case text(String)
        case cloze(String, index: Int)
        case latex(String, isBlock: Bool)
        case image(String)  // UUID
    }

    // MARK: - Parsing

    /// Parse card text into segments (text, cloze, latex, images)
    static func parse(_ text: String) -> [ContentSegment] {
        var segments: [ContentSegment] = []
        var remaining = text

        // Process text sequentially, looking for special patterns
        while !remaining.isEmpty {
            // Try to find the earliest occurrence of any special pattern
            let patterns: [(range: Range<String.Index>?, type: PatternType)] = [
                (findNextCloze(in: remaining), .cloze),
                (findNextLatex(in: remaining), .latex),
                (findNextImage(in: remaining), .image)
            ]

            // Find the earliest pattern
            let earliest = patterns.compactMap { range, type -> (Range<String.Index>, PatternType)? in
                guard let r = range else { return nil }
                return (r, type)
            }.min { $0.0.lowerBound < $1.0.lowerBound }

            if let (range, type) = earliest {
                // Add text before pattern
                let textBefore = String(remaining[..<range.lowerBound])
                if !textBefore.isEmpty {
                    segments.append(.text(textBefore))
                }

                // Add pattern segment
                let patternText = String(remaining[range])
                switch type {
                case .cloze:
                    if let (content, index) = extractCloze(from: patternText) {
                        segments.append(.cloze(content, index: index))
                    }
                case .latex:
                    let (content, isBlock) = extractLatex(from: patternText)
                    segments.append(.latex(content, isBlock: isBlock))
                case .image:
                    if let uuid = extractImageUUID(from: patternText) {
                        segments.append(.image(uuid))
                    }
                }

                // Continue with remainder
                remaining = String(remaining[range.upperBound...])
            } else {
                // No more patterns, add remaining text
                segments.append(.text(remaining))
                break
            }
        }

        return segments
    }

    // MARK: - Pattern Finding

    private enum PatternType {
        case cloze, latex, image
    }

    private static func findNextCloze(in text: String) -> Range<String.Index>? {
        // Match {{c\d+::content}}
        let pattern = #"\{\{c\d+::[^}]+\}\}"#
        return text.range(of: pattern, options: .regularExpression)
    }

    private static func findNextLatex(in text: String) -> Range<String.Index>? {
        // Match $$...$$ or $...$
        // Try block first ($$), then inline ($)
        // Improved: Handle nested braces and complex expressions
        if let range = text.range(of: #"\$\$.+?\$\$"#, options: .regularExpression) {
            return range
        }
        // Match $...$ but avoid matching $$ boundaries
        return text.range(of: #"\$(?!\$).+?\$(?!\$)"#, options: .regularExpression)
    }

    private static func findNextImage(in text: String) -> Range<String.Index>? {
        // Match [image:UUID]
        let pattern = #"\[image:[^\]]+\]"#
        return text.range(of: pattern, options: .regularExpression)
    }

    // MARK: - Content Extraction

    private static func extractCloze(from text: String) -> (content: String, index: Int)? {
        // Extract from {{c1::content}}
        let pattern = #"\{\{c(\d+)::([^}]+)\}\}"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else {
            return nil
        }

        guard let indexRange = Range(match.range(at: 1), in: text),
              let contentRange = Range(match.range(at: 2), in: text),
              let index = Int(String(text[indexRange])) else {
            return nil
        }

        return (String(text[contentRange]), index)
    }

    private static func extractLatex(from text: String) -> (content: String, isBlock: Bool) {
        // Remove $$ or $
        if text.hasPrefix("$$") && text.hasSuffix("$$") {
            let content = String(text.dropFirst(2).dropLast(2))
            return (content, true)
        } else if text.hasPrefix("$") && text.hasSuffix("$") {
            let content = String(text.dropFirst().dropLast())
            return (content, false)
        }
        return (text, false)
    }

    private static func extractImageUUID(from text: String) -> String? {
        // Extract from [image:UUID]
        let pattern = #"\[image:([^\]]+)\]"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[range])
    }

    // MARK: - LaTeX to Unicode

    /// Convert common LaTeX symbols to Unicode equivalents
    static func latexToUnicode(_ latex: String) -> String {
        var result = latex

        // Handle fractions first (before removing braces)
        result = result.replacingOccurrences(of: #"\\frac\{([^}]+)\}\{([^}]+)\}"#, with: "($1)/($2)", options: .regularExpression)
        result = result.replacingOccurrences(of: #"\\text\{([^}]+)\}"#, with: "$1", options: .regularExpression)

        // Greek letters (lowercase)
        result = result.replacingOccurrences(of: "\\alpha", with: "α")
        result = result.replacingOccurrences(of: "\\beta", with: "β")
        result = result.replacingOccurrences(of: "\\gamma", with: "γ")
        result = result.replacingOccurrences(of: "\\delta", with: "δ")
        result = result.replacingOccurrences(of: "\\epsilon", with: "ε")
        result = result.replacingOccurrences(of: "\\theta", with: "θ")
        result = result.replacingOccurrences(of: "\\lambda", with: "λ")
        result = result.replacingOccurrences(of: "\\mu", with: "μ")
        result = result.replacingOccurrences(of: "\\pi", with: "π")
        result = result.replacingOccurrences(of: "\\sigma", with: "σ")
        result = result.replacingOccurrences(of: "\\tau", with: "τ")
        result = result.replacingOccurrences(of: "\\phi", with: "φ")
        result = result.replacingOccurrences(of: "\\omega", with: "ω")

        // Greek letters (uppercase)
        result = result.replacingOccurrences(of: "\\Gamma", with: "Γ")
        result = result.replacingOccurrences(of: "\\Delta", with: "Δ")
        result = result.replacingOccurrences(of: "\\Theta", with: "Θ")
        result = result.replacingOccurrences(of: "\\Lambda", with: "Λ")
        result = result.replacingOccurrences(of: "\\Sigma", with: "Σ")
        result = result.replacingOccurrences(of: "\\Phi", with: "Φ")
        result = result.replacingOccurrences(of: "\\Omega", with: "Ω")

        // Math operators
        result = result.replacingOccurrences(of: "\\sum", with: "∑")
        result = result.replacingOccurrences(of: "\\prod", with: "∏")
        result = result.replacingOccurrences(of: "\\int", with: "∫")
        result = result.replacingOccurrences(of: "\\infty", with: "∞")
        result = result.replacingOccurrences(of: "\\partial", with: "∂")
        result = result.replacingOccurrences(of: "\\nabla", with: "∇")
        result = result.replacingOccurrences(of: "\\pm", with: "±")
        result = result.replacingOccurrences(of: "\\times", with: "×")
        result = result.replacingOccurrences(of: "\\div", with: "÷")
        result = result.replacingOccurrences(of: "\\neq", with: "≠")
        result = result.replacingOccurrences(of: "\\leq", with: "≤")
        result = result.replacingOccurrences(of: "\\geq", with: "≥")
        result = result.replacingOccurrences(of: "\\approx", with: "≈")
        result = result.replacingOccurrences(of: "\\equiv", with: "≡")
        result = result.replacingOccurrences(of: "\\to", with: "→")
        result = result.replacingOccurrences(of: "\\rightarrow", with: "→")
        result = result.replacingOccurrences(of: "\\leftarrow", with: "←")
        result = result.replacingOccurrences(of: "\\lim", with: "lim")
        result = result.replacingOccurrences(of: "\\sqrt", with: "√")

        // Superscripts (simple cases)
        result = result.replacingOccurrences(of: "^2", with: "²")
        result = result.replacingOccurrences(of: "^3", with: "³")
        result = result.replacingOccurrences(of: "^1", with: "¹")

        // Subscripts (simple cases)
        result = result.replacingOccurrences(of: "_0", with: "₀")
        result = result.replacingOccurrences(of: "_1", with: "₁")
        result = result.replacingOccurrences(of: "_2", with: "₂")
        result = result.replacingOccurrences(of: "_i", with: "ᵢ")
        result = result.replacingOccurrences(of: "_n", with: "ₙ")

        // Remove remaining LaTeX commands
        result = result.replacingOccurrences(of: #"\\[a-zA-Z]+"#, with: "", options: .regularExpression)

        // Clean up braces
        result = result.replacingOccurrences(of: "{", with: "")
        result = result.replacingOccurrences(of: "}", with: "")

        return result.trimmingCharacters(in: .whitespaces)
    }

    /// Truncate LaTeX for display in chip
    static func truncateLatex(_ latex: String, maxLength: Int = 20) -> String {
        let unicode = latexToUnicode(latex)
        if unicode.count <= maxLength {
            return unicode
        }
        let truncated = String(unicode.prefix(maxLength))
        return truncated + "..."
    }
}
