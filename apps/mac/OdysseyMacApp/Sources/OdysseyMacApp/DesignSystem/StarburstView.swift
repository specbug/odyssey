import SwiftUI

// MARK: - Starburst View
// Orbit's signature visual element inspired by the Pioneer/Voyager pulsar map
// Each ray represents a data point (card), ray length encodes value (review interval)

struct StarburstView: View {
    let rays: [Ray]
    let size: CGFloat
    let strokeWidth: CGFloat
    let color: Color
    let showProgress: Bool

    struct Ray: Identifiable {
        let id = UUID()
        let value: Double  // 0.0 to 1.0
        let isCompleted: Bool

        init(value: Double, isCompleted: Bool = false) {
            self.value = max(0, min(1, value))
            self.isCompleted = isCompleted
        }
    }

    init(
        rays: [Ray],
        size: CGFloat = 120,
        strokeWidth: CGFloat = 3,
        color: Color = .primary,
        showProgress: Bool = false
    ) {
        self.rays = rays
        self.size = size
        self.strokeWidth = strokeWidth
        self.color = color
        self.showProgress = showProgress
    }

    var body: some View {
        Canvas { context, canvasSize in
            let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
            let maxRadius = size / 2
            let minRadius = quillInnerRadius

            // Draw each ray
            for (index, ray) in rays.enumerated() {
                let angle = rayAngle(for: index)
                let rayLength = lerp(ray.value, from: minRadius, to: maxRadius)

                // Calculate ray endpoints
                let innerPoint = pointOnCircle(center: center, radius: minRadius, angle: angle)
                let outerPoint = pointOnCircle(center: center, radius: rayLength, angle: angle)

                // Draw tapered stroke (quill shape)
                var path = Path()
                path.move(to: innerPoint)
                path.addLine(to: outerPoint)

                // Color based on completion status
                let rayColor = ray.isCompleted && showProgress
                    ? color.opacity(1.0)
                    : color.opacity(0.4)

                context.stroke(
                    path,
                    with: .color(rayColor),
                    lineWidth: strokeWidth
                )

                // Add quill taper at inner radius
                if rays.count <= 50 {  // Only show quills when not too dense
                    let quillPath = Path { p in
                        p.move(to: innerPoint)
                        // Create small circular cap
                        p.addArc(
                            center: innerPoint,
                            radius: strokeWidth * 0.8,
                            startAngle: .degrees(0),
                            endAngle: .degrees(360),
                            clockwise: true
                        )
                    }
                    context.fill(quillPath, with: .color(rayColor))
                }
            }

            // Optional: Draw center circle (haloed star effect from negative space)
            if rays.count > 0 {
                let centerCircle = Path { p in
                    p.addArc(
                        center: center,
                        radius: minRadius * 0.6,
                        startAngle: .degrees(0),
                        endAngle: .degrees(360),
                        clockwise: true
                    )
                }
                context.fill(centerCircle, with: .color(color.opacity(0.1)))
            }
        }
        .frame(width: size, height: size)
    }

    // MARK: - Helpers

    private var quillInnerRadius: CGFloat {
        // Spacing between rays at inner radius
        let rayCount = CGFloat(max(rays.count, 1))
        let circumference = 2 * .pi * (size / 6)
        let spacing = circumference / rayCount
        return max(size / 8, spacing * 0.8)
    }

    private func rayAngle(for index: Int) -> Angle {
        let count = Double(rays.count)
        let angle = (Double(index) / count) * 360.0
        return .degrees(angle - 90)  // Start from top (12 o'clock)
    }

    private func pointOnCircle(center: CGPoint, radius: CGFloat, angle: Angle) -> CGPoint {
        let radians = CGFloat(angle.radians)
        return CGPoint(
            x: center.x + radius * cos(radians),
            y: center.y + radius * sin(radians)
        )
    }

    private func lerp(_ t: Double, from: CGFloat, to: CGFloat) -> CGFloat {
        from + (to - from) * CGFloat(t)
    }
}

// MARK: - Convenience Initializers

extension StarburstView {
    /// Create starburst from array of normalized values
    init(
        values: [Double],
        size: CGFloat = 120,
        strokeWidth: CGFloat = 3,
        color: Color = .primary,
        completedIndices: Set<Int> = []
    ) {
        let rays = values.enumerated().map { index, value in
            Ray(value: value, isCompleted: completedIndices.contains(index))
        }
        self.init(
            rays: rays,
            size: size,
            strokeWidth: strokeWidth,
            color: color,
            showProgress: !completedIndices.isEmpty
        )
    }

    /// Create starburst for card collection
    init(
        cardCount: Int,
        completedCount: Int = 0,
        size: CGFloat = 120,
        strokeWidth: CGFloat = 3,
        color: Color = .primary
    ) {
        let rays = (0..<cardCount).map { index in
            Ray(value: Double.random(in: 0.3...1.0), isCompleted: index < completedCount)
        }
        self.init(
            rays: rays,
            size: size,
            strokeWidth: strokeWidth,
            color: color,
            showProgress: completedCount > 0
        )
    }
}

// MARK: - Compact Starburst (Small Icon)

struct CompactStarburstView: View {
    let rayCount: Int
    let size: CGFloat
    let color: Color

    init(rayCount: Int, size: CGFloat = 24, color: Color = .primary) {
        self.rayCount = rayCount
        self.size = size
        self.color = color
    }

    var body: some View {
        StarburstView(
            rays: (0..<rayCount).map { _ in
                StarburstView.Ray(value: Double.random(in: 0.4...0.8))
            },
            size: size,
            strokeWidth: 2,
            color: color
        )
    }
}

// MARK: - Animated Rotating Starburst (Loading)

struct RotatingStarburstView: View {
    let size: CGFloat
    let color: Color
    @State private var rotation: Double = 0

    init(size: CGFloat = 60, color: Color = .primary) {
        self.size = size
        self.color = color
    }

    var body: some View {
        StarburstView(
            rays: (0..<16).map { i in
                let value = 0.3 + 0.7 * sin(Double(i) / 16.0 * .pi * 2)
                return StarburstView.Ray(value: value)
            },
            size: size,
            strokeWidth: 2.5,
            color: color
        )
        .rotationEffect(.degrees(rotation))
        .onAppear {
            withAnimation(
                .linear(duration: 4.0)
                .repeatForever(autoreverses: false)
            ) {
                rotation = 360
            }
        }
    }
}

// MARK: - Starburst Legend (Interval Labels)

struct StarburstLegendView: View {
    let intervals: [String]
    let currentIndex: Int?
    let size: CGFloat
    let color: Color

    init(intervals: [String], currentIndex: Int? = nil, size: CGFloat = 24, color: Color = .primary) {
        self.intervals = intervals
        self.currentIndex = currentIndex
        self.size = size
        self.color = color
    }

    var body: some View {
        HStack(spacing: OdysseySpacing.sm.value) {
            ForEach(Array(intervals.enumerated()), id: \.offset) { index, interval in
                Text(interval)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(index == currentIndex ? color : color.opacity(0.4))
                    .monospaced()
            }
        }
    }
}

// MARK: - Preview

#Preview("Basic Starburst") {
    VStack(spacing: 32) {
        StarburstView(
            values: (0..<24).map { _ in Double.random(in: 0.3...1.0) },
            size: 120,
            color: Color(hex: "#ff5252")
        )

        StarburstView(
            values: (0..<12).map { Double($0) / 12.0 },
            size: 80,
            color: Color(hex: "#42a5f5")
        )

        CompactStarburstView(rayCount: 16, size: 40, color: Color(hex: "#66bb6a"))

        RotatingStarburstView(size: 60, color: Color(hex: "#ab47bc"))
    }
    .padding()
}
