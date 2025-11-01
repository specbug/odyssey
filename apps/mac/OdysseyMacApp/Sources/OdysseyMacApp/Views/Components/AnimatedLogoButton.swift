import SwiftUI

struct AnimatedLogoButton: View {
    let isEnabled: Bool
    let isSubmitting: Bool
    let showSuccess: Bool
    let action: () -> Void

    @State private var isHovered: Bool = false

    private let buttonSize: CGFloat = 40
    private let iconSize: CGFloat = 16
    private let accentColor = Color(hex: "#ff4d06")

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                // Icon - plus or laser.burst
                Image(systemName: showSuccess ? "laser.burst" : "plus")
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundStyle(iconColor)
                    .scaleEffect(showSuccess ? 1.15 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: showSuccess)
            }
            .frame(width: buttonSize, height: buttonSize)
            .background(
                Circle()
                    .fill(backgroundColor)
            )
            .scaleEffect(isHovered && isEnabled ? 1.05 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isHovered)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isSubmitting || showSuccess)
        .onHover { hovering in
            withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                isHovered = hovering
            }

            // Change cursor to pointer on hover
            if hovering && isEnabled && !isSubmitting && !showSuccess {
                NSCursor.pointingHand.push()
            } else if !hovering {
                NSCursor.pop()
            }
        }
    }

    // MARK: - Computed Properties

    private var backgroundColor: Color {
        if !isEnabled {
            return OdysseyColor.border.opacity(0.3)
        } else if showSuccess {
            return accentColor
        } else {
            return accentColor.opacity(0.15)
        }
    }

    private var iconColor: Color {
        if !isEnabled {
            return OdysseyColor.mutedText
        } else if showSuccess {
            return Color.white
        } else {
            return accentColor
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
