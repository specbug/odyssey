import SwiftUI

struct OdysseyPrimaryButtonStyle: ButtonStyle {
    var cornerRadius: CGFloat = OdysseyRadius.md.value

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OdysseyFont.dr(15, weight: .medium))
            .foregroundStyle(OdysseyColor.white)
            .padding(.horizontal, OdysseySpacing.xl.value)
            .padding(.vertical, OdysseySpacing.sm.value)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(OdysseyColor.accent)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(OdysseyColor.accent.opacity(0.2), lineWidth: 1)
            )
            .shadow(color: OdysseyColor.shadow, radius: configuration.isPressed ? 6 : 14, y: configuration.isPressed ? 4 : 12)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct OdysseyPillButtonStyle: ButtonStyle {
    var background: Color
    var foreground: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OdysseyFont.dr(12, weight: .medium))
            .foregroundStyle(foreground)
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xs.value)
            .background(
                Capsule()
                    .fill(background)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}
