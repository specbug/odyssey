import Foundation
import SwiftUI

enum OdysseyColor {
    static let ink = DesignTokens.shared.color(for: \DesignTokens.Colors.ink)
    static let white = DesignTokens.shared.color(for: \DesignTokens.Colors.white)
    static let accent = DesignTokens.shared.color(for: \DesignTokens.Colors.accent)
    static let background = DesignTokens.shared.color(for: \DesignTokens.Colors.background)
    static let secondaryBackground = DesignTokens.shared.color(for: \DesignTokens.Colors.secondaryBackground)
    static let secondaryText = DesignTokens.shared.color(for: \DesignTokens.Colors.secondaryText)
    static let yellowAccent = DesignTokens.shared.color(for: \DesignTokens.Colors.yellowAccent)
}

enum OdysseySpacing {
    case xxs
    case xs
    case sm
    case md
    case lg
    case xl
    case xxl

    var value: CGFloat {
        switch self {
        case .xxs: return DesignTokens.shared.spacing.xxs
        case .xs: return DesignTokens.shared.spacing.xs
        case .sm: return DesignTokens.shared.spacing.sm
        case .md: return DesignTokens.shared.spacing.md
        case .lg: return DesignTokens.shared.spacing.lg
        case .xl: return DesignTokens.shared.spacing.xl
        case .xxl: return DesignTokens.shared.spacing.xxl
        }
    }
}

enum OdysseyRadius {
    case sm
    case md
    case lg

    var value: CGFloat {
        switch self {
        case .sm: return DesignTokens.shared.radius.sm
        case .md: return DesignTokens.shared.radius.md
        case .lg: return DesignTokens.shared.radius.lg
        }
    }
}

enum OdysseyFont {
    static func dr(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Dr", size: size).weight(weight)
    }
}

// MARK: - Token Loading

struct DesignTokens: Decodable {
    struct Colors: Decodable {
        let ink: String
        let white: String
        let accent: String
        let background: String
        let secondaryBackground: String
        let secondaryText: String
        let yellowAccent: String
    }

    struct Spacing: Decodable {
        let grid: CGFloat
        let xxs: CGFloat
        let xs: CGFloat
        let sm: CGFloat
        let md: CGFloat
        let lg: CGFloat
        let xl: CGFloat
        let xxl: CGFloat
    }

    struct Radius: Decodable {
        let sm: CGFloat
        let md: CGFloat
        let lg: CGFloat
    }

    struct Fonts: Decodable {
        let primaryFamily: String
        let monospaceFamily: String
    }

    let colors: Colors
    let fonts: Fonts
    let spacing: Spacing
    let radius: Radius

    static let shared: DesignTokens = {
        do {
            if let url = Bundle.module.url(forResource: "design-tokens", withExtension: "json") {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                return try decoder.decode(DesignTokens.self, from: data)
            }
        } catch {
            print("⚠️ Failed to load design tokens: \(error)")
        }
        return .fallback
    }()

    func color(for keyPath: KeyPath<Colors, String>) -> Color {
        Color(hex: colors[keyPath: keyPath])
    }

    private static let fallback = DesignTokens(
        colors: .init(
            ink: "#000000CC",
            white: "#FFFFFF",
            accent: "#ED3749",
            background: "#FA863D",
            secondaryBackground: "#F4742F",
            secondaryText: "#C74200",
            yellowAccent: "#FFCB2E"
        ),
        fonts: .init(
            primaryFamily: "Dr, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
            monospaceFamily: "\"R Plex Mono\", source-code-pro, Menlo, Monaco, Consolas, \"Courier New\", monospace"
        ),
        spacing: .init(grid: 8, xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40),
        radius: .init(sm: 8, md: 12, lg: 16)
    )
}

private extension Color {
    init(hex: String) {
        let sanitized = hex
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "rgba", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if hex.lowercased().hasPrefix("rgba") {
            let components = sanitized.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
            if components.count == 4 {
                self = Color(
                    red: components[0] / 255,
                    green: components[1] / 255,
                    blue: components[2] / 255,
                    opacity: components[3]
                )
                return
            }
        }

        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)

        let r, g, b, a: Double
        switch sanitized.count {
        case 6:
            r = Double((value & 0xFF0000) >> 16) / 255
            g = Double((value & 0x00FF00) >> 8) / 255
            b = Double(value & 0x0000FF) / 255
            a = 1.0
        case 8:
            r = Double((value & 0xFF000000) >> 24) / 255
            g = Double((value & 0x00FF0000) >> 16) / 255
            b = Double((value & 0x0000FF00) >> 8) / 255
            a = Double(value & 0x000000FF) / 255
        default:
            r = 1
            g = 1
            b = 1
            a = 1
        }

        self.init(red: r, green: g, blue: b, opacity: a)
    }
}
