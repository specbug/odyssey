import SwiftUI

/// Material Design Edit Icon
/// Simplified pencil/edit icon matching Material Symbols style
struct EditIcon: View {
    var size: CGFloat = 24
    var color: NSColor = .black

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let width = geometry.size.width
                let height = geometry.size.height

                // Pencil body (main diagonal shape)
                path.move(to: CGPoint(x: width * 0.75, y: height * 0.15))
                path.addLine(to: CGPoint(x: width * 0.85, y: height * 0.25))
                path.addLine(to: CGPoint(x: width * 0.35, y: height * 0.75))
                path.addLine(to: CGPoint(x: width * 0.25, y: height * 0.65))
                path.closeSubpath()

                // Pencil tip (small square at top)
                path.move(to: CGPoint(x: width * 0.77, y: height * 0.13))
                path.addLine(to: CGPoint(x: width * 0.87, y: height * 0.23))
                path.addLine(to: CGPoint(x: width * 0.83, y: height * 0.27))
                path.addLine(to: CGPoint(x: width * 0.73, y: height * 0.17))
                path.closeSubpath()

                // Bottom edit line
                path.move(to: CGPoint(x: width * 0.15, y: height * 0.9))
                path.addLine(to: CGPoint(x: width * 0.85, y: height * 0.9))
                path.addLine(to: CGPoint(x: width * 0.85, y: height * 0.95))
                path.addLine(to: CGPoint(x: width * 0.15, y: height * 0.95))
                path.closeSubpath()
            }
            .fill(Color(color))
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack(spacing: 20) {
        EditIcon(size: 24, color: .black)
        EditIcon(size: 32, color: .blue)
        EditIcon(size: 48, color: .orange)
    }
    .padding(40)
}
