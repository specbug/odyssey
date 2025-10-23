import SwiftUI

/// Asterisk-shaped progress indicator matching the Orbit design
struct StudyProgressIndicator: View {
    let totalSteps: Int
    let currentStep: Int
    let size: CGFloat
    let activeColor: Color
    let inactiveColor: Color

    private var progress: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(currentStep) / Double(totalSteps)
    }

    var body: some View {
        Canvas { context, canvasSize in
            drawAsterisk(context: context, canvasSize: canvasSize)
        }
        .frame(width: size, height: size)
    }

    private func drawAsterisk(context: GraphicsContext, canvasSize: CGSize) {
        let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
        let rayCount = 8
        let outerRadius: CGFloat = size / 2
        let innerRadius: CGFloat = size / 5

        // Draw each ray of the asterisk
        for i in 0..<rayCount {
            let rayProgress = Double(i) / Double(rayCount)
            let isActive = rayProgress < progress

            let angle = 2.0 * Double.pi * Double(i) / Double(rayCount) - Double.pi / 2.0

            // Create ray path
            let path = createRayPath(
                center: center,
                angle: angle,
                innerRadius: innerRadius,
                outerRadius: outerRadius
            )

            // Fill the ray
            context.fill(path, with: .color(isActive ? activeColor : inactiveColor))
        }
    }

    private func createRayPath(
        center: CGPoint,
        angle: Double,
        innerRadius: CGFloat,
        outerRadius: CGFloat
    ) -> Path {
        var path = Path()

        let startAngle = Angle(radians: angle - Double.pi / 16.0)
        let endAngle = Angle(radians: angle + Double.pi / 16.0)

        // Inner arc start
        path.move(to: CGPoint(
            x: center.x + innerRadius * CGFloat(cos(startAngle.radians)),
            y: center.y + innerRadius * CGFloat(sin(startAngle.radians))
        ))

        // Line to outer point
        path.addLine(to: CGPoint(
            x: center.x + outerRadius * CGFloat(cos(angle)),
            y: center.y + outerRadius * CGFloat(sin(angle))
        ))

        // Line to other side
        path.addLine(to: CGPoint(
            x: center.x + innerRadius * CGFloat(cos(endAngle.radians)),
            y: center.y + innerRadius * CGFloat(sin(endAngle.radians))
        ))

        // Arc back to start
        path.addArc(
            center: center,
            radius: innerRadius,
            startAngle: endAngle,
            endAngle: startAngle,
            clockwise: true
        )

        return path
    }
}

#Preview("Progress 50%") {
    VStack(spacing: 40) {
        StudyProgressIndicator(
            totalSteps: 10,
            currentStep: 5,
            size: 36,
            activeColor: Color(hex: "#ff4d06"),
            inactiveColor: Color.black.opacity(0.15)
        )

        StudyProgressIndicator(
            totalSteps: 10,
            currentStep: 10,
            size: 120,
            activeColor: Color(hex: "#ff4d06"),
            inactiveColor: Color(hex: "#ff4d06").opacity(0.2)
        )
    }
    .padding()
    .background(Color(hex: "#F0F0F0"))
}

#Preview("On Dark Background") {
    ZStack {
        Color.black
            .ignoresSafeArea()

        VStack(spacing: 40) {
            StudyProgressIndicator(
                totalSteps: 8,
                currentStep: 2,
                size: 36,
                activeColor: Color(hex: "#ff4d06"),
                inactiveColor: Color.white.opacity(0.15)
            )

            StudyProgressIndicator(
                totalSteps: 15,
                currentStep: 15,
                size: 120,
                activeColor: Color(hex: "#ff4d06"),
                inactiveColor: Color(hex: "#ff4d06").opacity(0.2)
            )
        }
    }
}
