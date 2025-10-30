import SwiftUI

/// Configuration for a single spoke
struct SpokeConfig {
    let angle: Double
    let length: CGFloat
    let width: CGFloat
    let innerWidthRatio: CGFloat
    let rotation: Double
}

/// Radial starburst progress indicator matching the Orbit design
struct StudyProgressIndicator: View {
    let totalSteps: Int
    let currentStep: Int
    let size: CGFloat
    let activeColor: Color
    let inactiveColor: Color

    @State private var animationProgress: CGFloat = 0

    // Pre-calculate spoke configurations
    private var spokeConfigs: [SpokeConfig] {
        generateSpokeConfigs()
    }

    // Dimensions based on size
    private var logoDiameter: CGFloat { size * 0.25 }
    private var spokeLength: CGFloat { size * 0.3 }
    private var spokeWidth: CGFloat { size * 0.09 } // Increased for thicker spokes matching logo

    var body: some View {
        ZStack {
            // Spokes layer
            ForEach(0..<totalSteps, id: \.self) { index in
                SpokeShape(
                    config: spokeConfigs[index],
                    size: size,
                    logoDiameter: logoDiameter
                )
                .fill(index < currentStep ? activeColor : inactiveColor)
                .overlay(
                    SpokeShape(
                        config: spokeConfigs[index],
                        size: size,
                        logoDiameter: logoDiameter
                    )
                    .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
                )
                .shadow(
                    color: index < currentStep ? activeColor.opacity(0.2) : .clear,
                    radius: 4
                )
                .shadow(
                    color: index < currentStep ? activeColor.opacity(0.1) : .clear,
                    radius: 8
                )
                .opacity(animationProgress)
                .animation(
                    .easeOut(duration: 0.3).delay(Double(index) * 0.02),
                    value: animationProgress
                )
                .animation(
                    .easeOut(duration: 0.4),
                    value: currentStep
                )
            }

            // Center logo circle
            Circle()
                .fill(activeColor)
                .frame(width: logoDiameter, height: logoDiameter)
                .shadow(color: activeColor.opacity(0.5), radius: 8)
                .shadow(color: activeColor.opacity(0.25), radius: 16)
                .scaleEffect(animationProgress)
                .animation(.easeOut(duration: 0.5), value: animationProgress)

            // Inner circle detail
            Circle()
                .fill(Color.white.opacity(0.2))
                .frame(width: logoDiameter / 1.5, height: logoDiameter / 1.5)
                .scaleEffect(animationProgress)
                .animation(.easeOut(duration: 0.5).delay(0.1), value: animationProgress)
        }
        .frame(width: size, height: size)
        .onAppear {
            animationProgress = 1.0
        }
    }

    private func generateSpokeConfigs() -> [SpokeConfig] {
        var configs: [SpokeConfig] = []
        let baseAngleStep = 360.0 / Double(totalSteps)
        // Increased minAngleGap for much thicker spokes
        let minAngleGap = max(5.0, 360.0 / (Double(totalSteps) * 1.2))

        var seed = totalSteps * 12345
        func seededRandom() -> Double {
            seed = (seed &* 9301 &+ 49297) % 233280
            return Double(seed) / 233280.0
        }

        var lastAngle = -90.0

        for i in 0..<totalSteps {
            // Fixed ±7.5 degree variation
            let angleVariation = (seededRandom() - 0.5) * 15.0
            var angle = Double(i) * baseAngleStep + angleVariation - 90.0

            // Enforce minimum gap
            if i > 0 && angle - lastAngle < minAngleGap {
                angle = lastAngle + minAngleGap
            }
            lastAngle = angle

            // Length variation: 80% to 120% (more dramatic tapering)
            let lengthVariation = 0.8 + seededRandom() * 0.4
            let length = spokeLength * lengthVariation

            // Width variation: 80% to 105% (moderate range)
            let widthVariation = 0.8 + seededRandom() * 0.25
            let width = spokeWidth * widthVariation

            // Inner width ratio: 50% to 75% (less taper, more uniform thickness like logo)
            let innerWidthRatio = 0.5 + seededRandom() * 0.25

            // Rotation: ±4 degrees
            let rotation = (seededRandom() - 0.5) * 8.0

            configs.append(SpokeConfig(
                angle: angle,
                length: length,
                width: width,
                innerWidthRatio: innerWidthRatio,
                rotation: rotation
            ))
        }

        return configs
    }
}

struct SpokeShape: Shape {
    let config: SpokeConfig
    let size: CGFloat
    let logoDiameter: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let centerX = size / 2
        let centerY = size / 2

        // Gap between logo and spokes - proportional to size (3% of size)
        let gap = size * 0.03
        let innerRadius = (logoDiameter / 2) + gap
        let outerRadius = innerRadius + config.length

        let angleRad = config.angle * .pi / 180.0

        let innerX = centerX + innerRadius * cos(angleRad)
        let innerY = centerY + innerRadius * sin(angleRad)
        let outerX = centerX + outerRadius * cos(angleRad)
        let outerY = centerY + outerRadius * sin(angleRad)

        // Calculate perpendicular offsets for tapered shape
        let perpAngle = angleRad + .pi / 2 + (config.rotation * .pi / 180.0)
        let innerWidth = config.width * config.innerWidthRatio
        let outerWidth = config.width

        let innerX1 = innerX + (innerWidth / 2) * cos(perpAngle)
        let innerY1 = innerY + (innerWidth / 2) * sin(perpAngle)
        let innerX2 = innerX - (innerWidth / 2) * cos(perpAngle)
        let innerY2 = innerY - (innerWidth / 2) * sin(perpAngle)

        let outerX1 = outerX + (outerWidth / 2) * cos(perpAngle)
        let outerY1 = outerY + (outerWidth / 2) * sin(perpAngle)
        let outerX2 = outerX - (outerWidth / 2) * cos(perpAngle)
        let outerY2 = outerY - (outerWidth / 2) * sin(perpAngle)

        // Create tapered spoke path with flat ends (matching logo)
        path.move(to: CGPoint(x: innerX1, y: innerY1))
        path.addLine(to: CGPoint(x: outerX1, y: outerY1))
        path.addLine(to: CGPoint(x: outerX2, y: outerY2))
        path.addLine(to: CGPoint(x: innerX2, y: innerY2))
        path.closeSubpath()

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

#Preview("Various Progress States") {
    VStack(spacing: 40) {
        HStack(spacing: 40) {
            VStack {
                StudyProgressIndicator(
                    totalSteps: 12,
                    currentStep: 3,
                    size: 100,
                    activeColor: Color(hex: "#ff4d06"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("25%")
                    .font(.caption)
            }

            VStack {
                StudyProgressIndicator(
                    totalSteps: 12,
                    currentStep: 6,
                    size: 100,
                    activeColor: Color(hex: "#ff4d06"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("50%")
                    .font(.caption)
            }

            VStack {
                StudyProgressIndicator(
                    totalSteps: 12,
                    currentStep: 9,
                    size: 100,
                    activeColor: Color(hex: "#ff4d06"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("75%")
                    .font(.caption)
            }
        }

        HStack(spacing: 40) {
            VStack {
                StudyProgressIndicator(
                    totalSteps: 16,
                    currentStep: 8,
                    size: 100,
                    activeColor: Color(hex: "#3778BF"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("16 spokes")
                    .font(.caption)
            }

            VStack {
                StudyProgressIndicator(
                    totalSteps: 20,
                    currentStep: 10,
                    size: 100,
                    activeColor: Color(hex: "#FF6163"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("20 spokes")
                    .font(.caption)
            }

            VStack {
                StudyProgressIndicator(
                    totalSteps: 24,
                    currentStep: 12,
                    size: 100,
                    activeColor: Color(hex: "#15B01A"),
                    inactiveColor: Color.gray.opacity(0.3)
                )
                Text("24 spokes")
                    .font(.caption)
            }
        }
    }
    .padding()
    .background(Color(hex: "#F0F0F0"))
}
