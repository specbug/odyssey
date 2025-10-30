import SwiftUI

// MARK: - Geometric Chip
// Fixed-size card chip with geometric stacked aesthetic
// Inspired by Orbit's bold, minimal design with offset shadows

struct GeometricChip: View {
    let card: CardSummary
    let palette: OdysseyColorPalette
    let onTap: () -> Void

    @State private var isHovered = false

    // Fixed dimensions
    private let chipWidth: CGFloat = 280
    private let chipHeight: CGFloat = 180
    private let borderWidth: CGFloat = 2
    private let shadowOffset: CGFloat = 4

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Offset shadow block (stacked card effect)
            Rectangle()
                .fill(shadowColor)
                .frame(width: chipWidth, height: chipHeight)
                .offset(x: shadowOffset, y: shadowOffset)

            // Main chip
            VStack(alignment: .leading, spacing: 0) {
                // Content area
                VStack(alignment: .leading, spacing: 8) {
                    // Rendered card text (with cloze/latex/images)
                    RenderedCardText(
                        text: card.front,
                        maxLines: 4,
                        fontSize: 14,
                        palette: palette
                    )

                    Spacer(minLength: 0)
                }
                .padding(12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                // Footer metadata
                footer
            }
            .frame(width: chipWidth, height: chipHeight)
            .background(OdysseyColor.surface)
            .overlay(
                // Bold geometric border
                Rectangle()
                    .stroke(borderColor, lineWidth: borderWidth)
            )
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            withAnimation(OrbitAnimation.springFast) {
                isHovered = hovering
            }
        }
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(OrbitAnimation.springFast, value: isHovered)
    }

    // MARK: - Subviews

    private var footer: some View {
        HStack(spacing: 8) {
            // Geometric state indicator
            GeometricStateChip(state: card.state, palette: palette)

            // Deck name
            Text(card.deck)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText.opacity(0.8))
                .lineLimit(1)

            Spacer(minLength: 0)

            // Due date indicator (subtle)
            if card.dueInHours < 0 {
                Circle()
                    .fill(Color(red: 1.0, green: 0.3, blue: 0.2))
                    .frame(width: 6, height: 6)
            } else if card.dueInHours < 24 {
                Circle()
                    .fill(palette.accentColor)
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Rectangle()
                .fill(OdysseyColor.surfaceSubtle)
        )
    }

    // MARK: - Colors

    private var borderColor: Color {
        if isHovered {
            return palette.accentColor
        }
        return palette.backgroundColor.opacity(0.5)
    }

    private var shadowColor: Color {
        palette.backgroundColor.opacity(0.2)
    }
}

// MARK: - Geometric State Chip

struct GeometricStateChip: View {
    let state: CardSummary.State
    let palette: OdysseyColorPalette

    var body: some View {
        HStack(spacing: 4) {
            // Geometric shape indicator
            stateShape
                .fill(stateColor)
                .frame(width: 8, height: 8)

            Text(state.label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(stateColor)
                .textCase(.uppercase)
                .tracking(0.3)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            Rectangle()
                .fill(stateColor.opacity(0.12))
        )
    }

    private var stateShape: some Shape {
        switch state {
        case .new:
            return AnyShape(Circle())
        case .review:
            return AnyShape(Rectangle())
        case .learning:
            return AnyShape(Triangle())
        case .buried:
            return AnyShape(Diamond())
        case .suspended:
            return AnyShape(Hexagon())
        }
    }

    private var stateColor: Color {
        switch state {
        case .new: return palette.backgroundColor
        case .review: return Color(hex: "#66bb6a")  // Green
        case .learning: return palette.accentColor
        case .buried: return Color(hex: "#ba8c63")  // Brown
        case .suspended: return OdysseyColor.mutedText.opacity(0.6)
        }
    }
}

// MARK: - Preview

#Preview {
    let palette = OdysseyColorPalette.named(.blue)

    VStack(spacing: 32) {
        // Regular card
        GeometricChip(
            card: CardSummary(
                deck: "Physics",
                tag: "Mechanics",
                front: "{{c1::Kinematics}} is the study of force, matter and motion.",
                back: "Answer here",
                source: "Page 28",
                state: .review,
                dueInHours: 12
            ),
            palette: palette,
            onTap: {}
        )

        // LaTeX card
        GeometricChip(
            card: CardSummary(
                deck: "Mathematics",
                tag: "Calculus",
                front: "The derivative is defined as $\\frac{dy}{dx} = \\lim_{h\\to 0} \\frac{f(x+h)-f(x)}{h}$",
                back: "Answer",
                source: "Textbook",
                state: .learning,
                dueInHours: 2
            ),
            palette: OdysseyColorPalette.named(.red),
            onTap: {}
        )

        // Image card
        GeometricChip(
            card: CardSummary(
                deck: "Art History",
                tag: "Renaissance",
                front: "Photo of Mona Lisa [image:5BB62O44-911E-45O3-8D67-7D00C18539AC]",
                back: "Answer",
                source: "Museum Guide",
                state: .new,
                dueInHours: 48
            ),
            palette: OdysseyColorPalette.named(.purple),
            onTap: {}
        )
    }
    .padding()
    .background(OdysseyColor.canvas)
}
