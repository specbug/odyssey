import Foundation
import SwiftUI

enum OdysseyColor {
    static let ink = DesignTokens.shared.color(for: \DesignTokens.Colors.ink)
    static let white = DesignTokens.shared.color(for: \DesignTokens.Colors.white)
    static let accent = DesignTokens.shared.color(for: \DesignTokens.Colors.accent)
    static let accentHover = DesignTokens.shared.color(for: \DesignTokens.Colors.accentHover)
    static let background = DesignTokens.shared.color(for: \DesignTokens.Colors.background)
    static let secondaryBackground = DesignTokens.shared.color(for: \DesignTokens.Colors.secondaryBackground)
    static let secondaryText = DesignTokens.shared.color(for: \DesignTokens.Colors.secondaryText)
    static let yellowAccent = DesignTokens.shared.color(for: \DesignTokens.Colors.yellowAccent)
    static let destructive = DesignTokens.shared.color(for: \DesignTokens.Colors.destructive)
    static let canvas = DesignTokens.shared.color(for: \DesignTokens.Colors.canvas)
    static let surface = DesignTokens.shared.color(for: \DesignTokens.Colors.surface)
    static let surfaceSubtle = DesignTokens.shared.color(for: \DesignTokens.Colors.surfaceSubtle)
    static let border = DesignTokens.shared.color(for: \DesignTokens.Colors.border)
    static let mutedText = DesignTokens.shared.color(for: \DesignTokens.Colors.mutedText)
    static let shadow = DesignTokens.shared.color(for: \DesignTokens.Colors.shadow)

    // Browse theme colors
    static let browseColors: [Color] = [
        DesignTokens.shared.color(for: \DesignTokens.Colors.browsePink),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browsePurple),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseViolet),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseBlue),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseCyan),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseTeal),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseGreen),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseLime),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseYellow),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseOrange),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseCoral),
        DesignTokens.shared.color(for: \DesignTokens.Colors.browseRed)
    ]
}

enum OdysseySpacing {
    case xxs
    case xs
    case sm
    case md
    case lg
    case xl
    case xxl
    case xxxl
    case xxxxl
    case xxxxxl

    var value: CGFloat {
        switch self {
        case .xxs: return DesignTokens.shared.spacing.xxs
        case .xs: return DesignTokens.shared.spacing.xs
        case .sm: return DesignTokens.shared.spacing.sm
        case .md: return DesignTokens.shared.spacing.md
        case .lg: return DesignTokens.shared.spacing.lg
        case .xl: return DesignTokens.shared.spacing.xl
        case .xxl: return DesignTokens.shared.spacing.xxl
        case .xxxl: return DesignTokens.shared.spacing.xxxl
        case .xxxxl: return DesignTokens.shared.spacing.xxxxl
        case .xxxxxl: return DesignTokens.shared.spacing.xxxxxl
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
        let accentHover: String
        let background: String
        let secondaryBackground: String
        let secondaryText: String
        let yellowAccent: String
        let destructive: String
        let canvas: String
        let surface: String
        let surfaceSubtle: String
        let border: String
        let mutedText: String
        let shadow: String
        let browsePink: String
        let browsePurple: String
        let browseViolet: String
        let browseBlue: String
        let browseCyan: String
        let browseTeal: String
        let browseGreen: String
        let browseLime: String
        let browseYellow: String
        let browseOrange: String
        let browseCoral: String
        let browseRed: String
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
        let xxxl: CGFloat
        let xxxxl: CGFloat
        let xxxxxl: CGFloat
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
            accent: "#ff4d06",
            accentHover: "#ff6b35",
            background: "#FA863D",
            secondaryBackground: "#F4742F",
            secondaryText: "#C74200",
            yellowAccent: "#FFCB2E",
            destructive: "#ED3749",
            canvas: "#fafbfc",
            surface: "#FFFFFF",
            surfaceSubtle: "#FEF9F3",
            border: "#E8E1D8",
            mutedText: "rgba(0, 0, 0, 0.55)",
            shadow: "rgba(37, 24, 13, 0.08)",
            browsePink: "#f56bb5",
            browsePurple: "#d071ef",
            browseViolet: "#ad89fb",
            browseBlue: "#72aef8",
            browseCyan: "#65c6f6",
            browseTeal: "#52dada",
            browseGreen: "#63d463",
            browseLime: "#8fd43a",
            browseYellow: "#fac800",
            browseOrange: "#e0a642",
            browseCoral: "#fa863d",
            browseRed: "#ff5252"
        ),
        fonts: .init(
            primaryFamily: "Dr, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
            monospaceFamily: "\"R Plex Mono\", source-code-pro, Menlo, Monaco, Consolas, \"Courier New\", monospace"
        ),
        spacing: .init(grid: 8, xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48, xxxxl: 56, xxxxxl: 60),
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
