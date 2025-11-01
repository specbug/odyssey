import SwiftUI

/// Odyssey Starburst Logo
/// Vector-based starburst icon matching the brand identity
struct StarburstLogo: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let scale = min(rect.width, rect.height) / 100.0

        // Central circle
        let centerRadius = 8.0 * scale
        path.addEllipse(in: CGRect(
            x: center.x - centerRadius,
            y: center.y - centerRadius,
            width: centerRadius * 2,
            height: centerRadius * 2
        ))

        // 15 rays radiating outward (simplified from original 18)
        let rayCount = 15
        for i in 0..<rayCount {
            let angle = (Double(i) * 360.0 / Double(rayCount) - 90) * .pi / 180.0

            // Ray parameters (varied lengths for organic look)
            let baseLength = (40 + Double(i % 3) * 5) * scale
            let rayWidth = (3.0 + Double(i % 2) * 0.5) * scale

            let innerRadius = centerRadius
            let outerRadius = baseLength

            // Ray corners
            let angle1 = angle - (rayWidth / baseLength)
            let angle2 = angle + (rayWidth / baseLength)

            let innerPoint1 = CGPoint(
                x: center.x + CGFloat(cos(angle1)) * innerRadius,
                y: center.y + CGFloat(sin(angle1)) * innerRadius
            )
            let innerPoint2 = CGPoint(
                x: center.x + CGFloat(cos(angle2)) * innerRadius,
                y: center.y + CGFloat(sin(angle2)) * innerRadius
            )
            let outerPoint1 = CGPoint(
                x: center.x + CGFloat(cos(angle1)) * outerRadius,
                y: center.y + CGFloat(sin(angle1)) * outerRadius
            )
            let outerPoint2 = CGPoint(
                x: center.x + CGFloat(cos(angle2)) * outerRadius,
                y: center.y + CGFloat(sin(angle2)) * outerRadius
            )

            // Draw ray as trapezoid
            path.move(to: innerPoint1)
            path.addLine(to: outerPoint1)
            path.addLine(to: outerPoint2)
            path.addLine(to: innerPoint2)
            path.closeSubpath()
        }

        return path
    }
}

#Preview {
    VStack(spacing: 20) {
        StarburstLogo()
            .fill(Color.orange)
            .frame(width: 50, height: 50)

        StarburstLogo()
            .fill(
                AngularGradient(
                    colors: [.red, .orange, .yellow, .green, .blue, .purple, .red],
                    center: .center
                )
            )
            .frame(width: 80, height: 80)
    }
    .padding(40)
}
