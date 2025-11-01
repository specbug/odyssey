import SwiftUI

// MARK: - Geometric Chip
// Fixed-size card chip with geometric dual-border system
// Inspired by Orbit's bold, minimal stacked aesthetic

struct GeometricChip: View {
    let card: CardSummary
    let palette: OdysseyColorPalette
    let isSelected: Bool
    let onTap: () -> Void

    @State private var isHovered = false
    @State private var hoverColor: Color

    // Fixed dimensions - wider and shorter for better scanning
    private let chipHeight: CGFloat = 140
    private let mainBorderWidth: CGFloat = 3  // Main border
    private let shadowBorderWidth: CGFloat = 3  // Shadow border
    private let shadowOffset: CGFloat = 5  // Offset with gap

    init(card: CardSummary, palette: OdysseyColorPalette, isSelected: Bool = false, onTap: @escaping () -> Void) {
        self.card = card
        self.palette = palette
        self.isSelected = isSelected
        self.onTap = onTap
        // Assign deterministic color based on card ID for consistency with preview
        _hoverColor = State(initialValue: XKCDColors.vibrantColor(seed: card.id.uuidString))
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Shadow border (offset, creates gap effect)
            Rectangle()
                .stroke(shadowBorderColor, lineWidth: shadowBorderWidth)
                .frame(maxWidth: .infinity)
                .frame(height: chipHeight)
                .offset(x: shadowOffset, y: shadowOffset)

            // Main chip content
            VStack(alignment: .leading, spacing: 0) {
                // Content area
                VStack(alignment: .leading, spacing: 8) {
                    // Rendered card text (with cloze/latex/images)
                    RenderedCardText(
                        text: card.front,
                        maxLines: 3,
                        fontSize: 20,  // Larger font for better readability
                        palette: palette
                    )

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                // Footer metadata
                footer
            }
            .frame(maxWidth: .infinity)
            .frame(height: chipHeight)
            .background(OdysseyColor.surface)
            .overlay(
                // Main thick border (lighter color)
                Rectangle()
                    .stroke(borderColor, lineWidth: mainBorderWidth)
            )
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            withAnimation(OrbitAnimation.springFast) {
                isHovered = hovering
            }
        }
        .scaleEffect(isSelected ? 1.03 : (isHovered ? 1.01 : 1.0))
        .animation(OrbitAnimation.springFast, value: isHovered)
        .animation(OrbitAnimation.springFast, value: isSelected)
    }

    // MARK: - Subviews

    private var footer: some View {
        HStack(spacing: 8) {
            // Geometric state indicator
            GeometricStateChip(state: card.state)

            // Deck name
            Text(card.deck)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(OdysseyColor.mutedText.opacity(0.8))
                .lineLimit(1)

            Spacer(minLength: 0)

            // Due date indicator (subtle geometric dot)
            if card.dueInHours < 0 {
                Circle()
                    .fill(Color(hex: "#ff4d06"))  // Accent color for overdue
                    .frame(width: 7, height: 7)
            } else if card.dueInHours < 24 {
                Circle()
                    .fill(Color(hex: "#ff4d06").opacity(0.5))
                    .frame(width: 7, height: 7)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(
            Rectangle()
                .fill(Color(hex: "#ff4d06").opacity(0.05))
        )
    }

    // MARK: - Colors

    private var borderColor: Color {
        if isSelected {
            // Selected state: vibrant, saturated color
            return hoverColor.opacity(1.0)
        } else if isHovered {
            // Hover state: slightly muted color
            return hoverColor.opacity(0.8)
        }
        return Color.black.opacity(0.9)  // Default dark black border
    }

    private var shadowBorderColor: Color {
        if isSelected {
            // Selected state: match the border color for cohesive highlight
            return hoverColor.opacity(0.7)
        }
        return Color.black.opacity(0.6)  // Default shadow
    }
}

// MARK: - Geometric State Chip

struct GeometricStateChip: View {
    let state: CardSummary.State

    var body: some View {
        HStack(spacing: 5) {
            // Geometric shape indicator
            stateShape
                .fill(stateColor)
                .frame(width: 9, height: 9)

            Text(state.label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(stateColor)
                .textCase(.uppercase)
                .tracking(0.4)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
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
            return AnyShape(PlayTriangle())
        case .buried:
            return AnyShape(Diamond())
        case .suspended:
            return AnyShape(Hexagon())
        }
    }

    private var stateColor: Color {
        switch state {
        case .new: return Color(hex: "#ff4d06")  // Accent orange
        case .review: return Color(hex: "#66bb6a")  // Green
        case .learning: return Color(hex: "#52B2BF")  // Ocean blue
        case .buried: return Color(hex: "#ba8c63")  // Brown
        case .suspended: return OdysseyColor.mutedText.opacity(0.6)
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 16),
                GridItem(.flexible(), spacing: 16)
            ],
            spacing: 16
        ) {
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
                palette: OdysseyColorPalette.named(.blue),
                onTap: {}
            )

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
    }
    .frame(width: 800, height: 600)
    .background(OdysseyColor.canvas)
}
