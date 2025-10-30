import SwiftUI

// MARK: - Geometric Card
// Minimal, bold, geometric card design for browse interface
// Inspired by Orbit's design philosophy: earnestness, clarity, and geometric beauty

struct GeometricCard: View {
    let card: CardSummary
    let isExpanded: Bool
    let isSelected: Bool
    let palette: OdysseyColorPalette
    let onTap: () -> Void
    let onSelect: () -> Void

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with mini starburst and metadata
            header

            // Question text (bold, geometric typography)
            questionText

            // Answer (revealed when expanded)
            if isExpanded {
                answerText
            }

            // Footer with geometric state indicator
            footer
        }
        .padding(24)  // 3 grid units
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(cardBorder)
        .orbitHover(scale: 1.01, shadowRadius: 12)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            withAnimation(OrbitAnimation.springFast) {
                isHovered = hovering
            }
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            // Compact starburst showing card review history
            CompactStarburstView(
                rayCount: 8,
                size: 24,
                color: palette.accentColor
            )

            // Due date with geometric emphasis
            Text(card.dueDateString)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(palette.secondaryTextColor)
                .textCase(.uppercase)
                .tracking(0.5)

            Spacer()

            // Selection checkbox (geometric circle/checkmark)
            Button(action: onSelect) {
                GeometricCheckbox(isSelected: isSelected, color: palette.accentColor)
            }
            .buttonStyle(.plain)
            .opacity(isHovered || isSelected ? 1 : 0)
            .animation(OrbitAnimation.springFast, value: isHovered || isSelected)
        }
    }

    private var questionText: some View {
        Text(card.front)
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(OdysseyColor.ink)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
            .padding(.bottom, 12)
    }

    private var answerText: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Geometric divider
            Rectangle()
                .fill(palette.accentColor.opacity(0.2))
                .frame(height: 2)
                .frame(maxWidth: 120)

            Text(card.back)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(OdysseyColor.ink.opacity(0.85))
                .multilineTextAlignment(.leading)
                .transition(.orbitScaleFade)
        }
        .padding(.vertical, 8)
    }

    private var footer: some View {
        HStack(alignment: .center, spacing: 12) {
            // Geometric state badge
            GeometricStateBadge(state: card.state, palette: palette)

            // Metadata with minimal style
            Text(card.deck)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))

            Text("•")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText.opacity(0.5))

            Text(card.tag)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))

            Spacer()

            // Source indicator (geometric icon + text)
            HStack(spacing: 4) {
                Circle()
                    .fill(palette.accentColor.opacity(0.4))
                    .frame(width: 6, height: 6)

                Text(card.source)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.6))
                    .lineLimit(1)
            }
            .frame(maxWidth: 180, alignment: .trailing)
        }
        .padding(.top, 8)
    }

    private var cardBackground: some View {
        ZStack {
            // Base white surface
            OdysseyColor.surface

            // Subtle colored overlay when hovered
            if isHovered {
                palette.backgroundColor
                    .opacity(0.02)
            }
        }
    }

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .stroke(
                isSelected ? palette.accentColor : (isHovered ? palette.accentColor.opacity(0.3) : OdysseyColor.border),
                lineWidth: isSelected ? 2 : 1
            )
            .animation(OrbitAnimation.springFast, value: isSelected)
            .animation(OrbitAnimation.springFast, value: isHovered)
    }
}

// MARK: - Geometric Checkbox

struct GeometricCheckbox: View {
    let isSelected: Bool
    let color: Color

    var body: some View {
        ZStack {
            // Outer circle
            Circle()
                .stroke(color, lineWidth: 2)
                .frame(width: 20, height: 20)

            // Inner checkmark (geometric)
            if isSelected {
                Circle()
                    .fill(color)
                    .frame(width: 12, height: 12)
                    .transition(.orbitScaleFade)
            }
        }
        .animation(OrbitAnimation.springBouncy, value: isSelected)
    }
}

// MARK: - Geometric State Badge

struct GeometricStateBadge: View {
    let state: CardSummary.State
    let palette: OdysseyColorPalette

    var body: some View {
        HStack(spacing: 6) {
            // Geometric shape indicator
            stateShape
                .fill(stateColor)
                .frame(width: 12, height: 12)

            Text(state.label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(stateColor)
                .textCase(.uppercase)
                .tracking(0.5)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(stateColor.opacity(0.1))
        )
    }

    private var stateShape: some Shape {
        switch state {
        case .new:
            return AnyShape(Circle())
        case .review:
            return AnyShape(RoundedRectangle(cornerRadius: 2))
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

// MARK: - Geometric Shapes

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}

struct Diamond: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
            path.closeSubpath()
        }
    }
}

struct Hexagon: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            let w = rect.width
            let h = rect.height
            path.move(to: CGPoint(x: w * 0.5, y: 0))
            path.addLine(to: CGPoint(x: w, y: h * 0.25))
            path.addLine(to: CGPoint(x: w, y: h * 0.75))
            path.addLine(to: CGPoint(x: w * 0.5, y: h))
            path.addLine(to: CGPoint(x: 0, y: h * 0.75))
            path.addLine(to: CGPoint(x: 0, y: h * 0.25))
            path.closeSubpath()
        }
    }
}

struct AnyShape: Shape {
    private let _path: (CGRect) -> Path

    init<S: Shape>(_ shape: S) {
        _path = { rect in shape.path(in: rect) }
    }

    func path(in rect: CGRect) -> Path {
        _path(rect)
    }
}

// MARK: - Preview

#Preview {
    let sampleCard = CardSummary(
        deck: "Physics",
        tag: "Mechanics",
        front: "{{c1::Kinematics}} is the study of force, matter and motion.",
        back: "Kinematics is a subfield of physics that describes the motion of objects without considering the forces that cause the motion.",
        source: "Page 42 • Classical Mechanics",
        state: .review,
        dueDate: Date().addingTimeInterval(3600 * 48)
    )

    let palette = OdysseyColorPalette.named(.red)

    VStack(spacing: 24) {
        GeometricCard(
            card: sampleCard,
            isExpanded: false,
            isSelected: false,
            palette: palette,
            onTap: {},
            onSelect: {}
        )

        GeometricCard(
            card: sampleCard,
            isExpanded: true,
            isSelected: true,
            palette: palette,
            onTap: {},
            onSelect: {}
        )
    }
    .frame(width: 600)
    .padding()
}
