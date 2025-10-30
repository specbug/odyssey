import SwiftUI

// MARK: - Orbit Color Palette System
// Based on Orbit's 12-palette color wheel for vibrant, expressive interfaces
// Each palette includes 5 semantic colors that work together harmoniously

struct OdysseyColorPalette {
    let backgroundColor: Color
    let accentColor: Color
    let secondaryAccentColor: Color
    let secondaryBackgroundColor: Color
    let secondaryTextColor: Color

    /// Get a palette by index (0-11)
    static func palette(_ index: Int) -> OdysseyColorPalette {
        all[index % all.count]
    }

    /// Get a palette by name
    static func named(_ name: PaletteName) -> OdysseyColorPalette {
        all[name.rawValue]
    }

    /// Get palette for current time of day (morning = warm, evening = cool)
    static var timeOfDay: OdysseyColorPalette {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 6..<9:   return .named(.orange)   // Morning
        case 9..<12:  return .named(.yellow)   // Late morning
        case 12..<15: return .named(.lime)     // Afternoon
        case 15..<18: return .named(.cyan)     // Late afternoon
        case 18..<21: return .named(.violet)   // Evening
        case 21..<23: return .named(.purple)   // Night
        default:      return .named(.blue)     // Late night/early morning
        }
    }

    enum PaletteName: Int, CaseIterable {
        case red = 0
        case orange = 1
        case brown = 2
        case yellow = 3
        case lime = 4
        case green = 5
        case turquoise = 6
        case cyan = 7
        case blue = 8
        case violet = 9
        case purple = 10
        case pink = 11
    }

    // MARK: - 12 Color Palettes (from Orbit iOS)

    static let all: [OdysseyColorPalette] = [
        // 0: Red
        .init(
            backgroundColor: Color(hex: "#ff5252"),
            accentColor: Color(hex: "#ffcb2e"),
            secondaryAccentColor: Color(hex: "#ff7e05"),
            secondaryBackgroundColor: Color(hex: "#f73b3b"),
            secondaryTextColor: Color(hex: "#ad0000")
        ),

        // 1: Orange
        .init(
            backgroundColor: Color(hex: "#ff8c42"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#ff5252"),
            secondaryBackgroundColor: Color(hex: "#ff6f2b"),
            secondaryTextColor: Color(hex: "#b84400")
        ),

        // 2: Brown
        .init(
            backgroundColor: Color(hex: "#ba8c63"),
            accentColor: Color(hex: "#ffd54f"),
            secondaryAccentColor: Color(hex: "#ff8c42"),
            secondaryBackgroundColor: Color(hex: "#a67552"),
            secondaryTextColor: Color(hex: "#6b4423")
        ),

        // 3: Yellow
        .init(
            backgroundColor: Color(hex: "#ffeb3b"),
            accentColor: Color(hex: "#8bc34a"),
            secondaryAccentColor: Color(hex: "#ff9800"),
            secondaryBackgroundColor: Color(hex: "#fdd835"),
            secondaryTextColor: Color(hex: "#ad8800")
        ),

        // 4: Lime
        .init(
            backgroundColor: Color(hex: "#c0ca33"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#8bc34a"),
            secondaryBackgroundColor: Color(hex: "#afb42b"),
            secondaryTextColor: Color(hex: "#6b7700")
        ),

        // 5: Green
        .init(
            backgroundColor: Color(hex: "#66bb6a"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#8bc34a"),
            secondaryBackgroundColor: Color(hex: "#4caf50"),
            secondaryTextColor: Color(hex: "#1b5e20")
        ),

        // 6: Turquoise
        .init(
            backgroundColor: Color(hex: "#26a69a"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#66bb6a"),
            secondaryBackgroundColor: Color(hex: "#00897b"),
            secondaryTextColor: Color(hex: "#004d40")
        ),

        // 7: Cyan
        .init(
            backgroundColor: Color(hex: "#26c6da"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#26a69a"),
            secondaryBackgroundColor: Color(hex: "#00acc1"),
            secondaryTextColor: Color(hex: "#006064")
        ),

        // 8: Blue
        .init(
            backgroundColor: Color(hex: "#42a5f5"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#26c6da"),
            secondaryBackgroundColor: Color(hex: "#1e88e5"),
            secondaryTextColor: Color(hex: "#0d47a1")
        ),

        // 9: Violet
        .init(
            backgroundColor: Color(hex: "#7e57c2"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#42a5f5"),
            secondaryBackgroundColor: Color(hex: "#673ab7"),
            secondaryTextColor: Color(hex: "#311b92")
        ),

        // 10: Purple
        .init(
            backgroundColor: Color(hex: "#ab47bc"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#7e57c2"),
            secondaryBackgroundColor: Color(hex: "#8e24aa"),
            secondaryTextColor: Color(hex: "#4a148c")
        ),

        // 11: Pink
        .init(
            backgroundColor: Color(hex: "#ec407a"),
            accentColor: Color(hex: "#ffeb3b"),
            secondaryAccentColor: Color(hex: "#ab47bc"),
            secondaryBackgroundColor: Color(hex: "#d81b60"),
            secondaryTextColor: Color(hex: "#880e4f")
        )
    ]
}

// MARK: - Palette-aware Color Extensions

extension OdysseyColor {
    /// Get a dynamic palette based on context (time of day, deck, etc.)
    static func palette(for context: PaletteContext = .timeOfDay) -> OdysseyColorPalette {
        switch context {
        case .timeOfDay:
            return OdysseyColorPalette.timeOfDay
        case .deck(let name):
            // Hash deck name to consistent palette
            let hash = abs(name.hashValue)
            return OdysseyColorPalette.palette(hash % 12)
        case .index(let i):
            return OdysseyColorPalette.palette(i)
        case .named(let name):
            return OdysseyColorPalette.named(name)
        }
    }

    enum PaletteContext {
        case timeOfDay
        case deck(String)
        case index(Int)
        case named(OdysseyColorPalette.PaletteName)
    }
}
