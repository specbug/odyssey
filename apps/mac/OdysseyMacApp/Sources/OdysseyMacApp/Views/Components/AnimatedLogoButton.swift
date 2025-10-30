import SwiftUI

struct AnimatedLogoButton: View {
    let isEnabled: Bool
    let isSubmitting: Bool
    let showSuccess: Bool
    let action: () -> Void

    @State private var rotation: Double = 0
    @State private var gradientRotation: Double = 0
    @State private var isHovered: Bool = false

    private let buttonSize: CGFloat = 56
    private let logoSize: CGFloat = 32

    // Rainbow gradient colors
    private let rainbowColors: [Color] = [
        Color(red: 1.0, green: 0.0, blue: 0.0),     // Red
        Color(red: 1.0, green: 0.5, blue: 0.0),     // Orange
        Color(red: 1.0, green: 1.0, blue: 0.0),     // Yellow
        Color(red: 0.0, green: 1.0, blue: 0.0),     // Green
        Color(red: 0.0, green: 0.5, blue: 1.0),     // Blue
        Color(red: 0.5, green: 0.0, blue: 1.0),     // Indigo
        Color(red: 1.0, green: 0.0, blue: 1.0),     // Violet
        Color(red: 1.0, green: 0.0, blue: 0.0)      // Red (loop)
    ]

    var body: some View {
        Button(action: action) {
            ZStack {
                // Hover background circle
                if isHovered && isEnabled && !isSubmitting && !showSuccess {
                    Circle()
                        .fill(Color.black.opacity(0.04))
                        .frame(width: buttonSize + 8, height: buttonSize + 8)
                }

                // Circular background
                Circle()
                    .fill(isEnabled || showSuccess ? Color.clear : Color.clear)
                    .frame(width: buttonSize, height: buttonSize)

                // Starburst logo with rainbow gradient
                StarburstLogo()
                    .fill(
                        AngularGradient(
                            colors: isEnabled || showSuccess ? rainbowColors : [Color.gray.opacity(0.3)],
                            center: .center,
                            startAngle: .degrees(gradientRotation),
                            endAngle: .degrees(gradientRotation + 360)
                        )
                    )
                    .frame(width: logoSize, height: logoSize)
                    .rotationEffect(.degrees(rotation))
                    .scaleEffect(showSuccess ? 1.2 : (isHovered && isEnabled ? 1.1 : 1.0))
                    .opacity(isSubmitting ? 0.6 : 1.0)

                // Circular border
                Circle()
                    .stroke(
                        isEnabled || showSuccess ? Color.clear : OdysseyColor.border,
                        lineWidth: 2
                    )
                    .frame(width: buttonSize, height: buttonSize)

                // Success glow
                if showSuccess {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(hex: "#ff4d06").opacity(0.3), Color.clear],
                                center: .center,
                                startRadius: 0,
                                endRadius: buttonSize / 2
                            )
                        )
                        .frame(width: buttonSize * 1.5, height: buttonSize * 1.5)
                        .blur(radius: 8)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isSubmitting || showSuccess)
        .onHover { hovering in
            withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                isHovered = hovering
            }

            // Change cursor on hover
            if hovering && isEnabled && !isSubmitting && !showSuccess {
                NSCursor.pointingHand.push()
            } else if !hovering {
                NSCursor.pop()
            }
        }
        .onAppear {
            // Start spinning animation when enabled
            if isEnabled && !isSubmitting && !showSuccess {
                startAnimations()
            }
        }
        .onChange(of: isEnabled) { _, newValue in
            if newValue && !isSubmitting && !showSuccess {
                startAnimations()
            } else {
                stopAnimations()
            }
        }
        .onChange(of: isSubmitting) { _, newValue in
            if newValue {
                stopAnimations()
            } else if isEnabled && !showSuccess {
                startAnimations()
            }
        }
        .onChange(of: showSuccess) { _, newValue in
            if newValue {
                stopAnimations()
                // Success animation
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    // Scale handled by scaleEffect
                }
            } else if isEnabled && !isSubmitting {
                startAnimations()
            }
        }
    }

    private func startAnimations() {
        // Continuous rotation animation
        withAnimation(.linear(duration: 3.0).repeatForever(autoreverses: false)) {
            rotation = 360
        }

        // Rainbow gradient cycling animation
        withAnimation(.linear(duration: 4.0).repeatForever(autoreverses: false)) {
            gradientRotation = 360
        }
    }

    private func stopAnimations() {
        withAnimation(.linear(duration: 0.3)) {
            rotation = 0
            gradientRotation = 0
        }
    }
}

#Preview {
    HStack(spacing: 32) {
        // Enabled and spinning
        AnimatedLogoButton(
            isEnabled: true,
            isSubmitting: false,
            showSuccess: false,
            action: {}
        )

        // Submitting
        AnimatedLogoButton(
            isEnabled: true,
            isSubmitting: true,
            showSuccess: false,
            action: {}
        )

        // Success
        AnimatedLogoButton(
            isEnabled: true,
            isSubmitting: false,
            showSuccess: true,
            action: {}
        )

        // Disabled
        AnimatedLogoButton(
            isEnabled: false,
            isSubmitting: false,
            showSuccess: false,
            action: {}
        )
    }
    .padding(40)
}
