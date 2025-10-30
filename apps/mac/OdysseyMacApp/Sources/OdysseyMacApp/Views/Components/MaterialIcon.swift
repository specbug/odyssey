import SwiftUI

/// Generic Material Icon wrapper
/// Simple approach for using Material Design icons in SwiftUI
///
/// ## Usage Pattern:
///
/// 1. **For simple shapes** (circle, square, etc.):
///    Use SF Symbols directly:
///    ```swift
///    Image(systemName: "circle")
///    Image(systemName: "square")
///    Image(systemName: "triangle")
///    ```
///
/// 2. **For Material Icons with no SF equivalent**:
///    Create a simple Shape struct:
///    ```swift
///    struct MyIcon: Shape {
///        func path(in rect: CGRect) -> Path {
///            // Copy path data from Material Symbols SVG
///        }
///    }
///    ```
///
/// 3. **Use in UI**:
///    ```swift
///    MyIcon()
///        .fill(Color.primary)
///        .frame(width: 24, height: 24)
///    ```
///
/// ## Material Icons Sources:
/// - Google Material Symbols: https://fonts.google.com/icons
/// - Choose "Outlined" style for simplest paths
/// - Copy SVG `<path d="...">` data
/// - Normalize coordinates to 0-960 viewBox
///
/// ## Example Icons Already Implemented:
/// - `EditIcon` - Material Symbols "edit" (pencil/edit icon)
/// - `circle` (SF Symbol) - Material Symbols "circle"
///
struct MaterialIconExample: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        // Scale factor from Material Symbols viewBox (960x960) to our rect
        let scale = min(rect.width, rect.height) / 960.0

        // Add your Material Icon path data here
        // Example: Simple circle
        path.addEllipse(in: CGRect(
            x: rect.midX - 400 * scale,
            y: rect.midY - 400 * scale,
            width: 800 * scale,
            height: 800 * scale
        ))

        return path
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 20) {
        Text("Material Icons in SwiftUI")
            .font(.headline)

        HStack(spacing: 20) {
            // SF Symbol (preferred for simple shapes)
            Image(systemName: "circle")
                .font(.system(size: 24))
                .foregroundStyle(.primary)

            // Custom Material Icon
            EditIcon(size: 24, color: .black)

            // Example shape
            MaterialIconExample()
                .fill(Color.primary)
                .frame(width: 24, height: 24)
        }
    }
    .padding(40)
}
