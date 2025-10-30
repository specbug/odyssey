import SwiftUI

// MARK: - Orbit Animation System
// Spring-based animations for natural, effortless motion
// Based on React Native Animated API patterns from Orbit iOS

enum OrbitAnimation {
    /// Natural spring motion with no overshoot (bounciness: 0)
    /// Speed: 20-28 for moderate pace
    static let spring = Animation.spring(response: 0.5, dampingFraction: 0.75)

    /// Fast spring for quick UI responses
    static let springFast = Animation.spring(response: 0.3, dampingFraction: 0.8)

    /// Smooth spring for gentle transitions
    static let springSmooth = Animation.spring(response: 0.6, dampingFraction: 0.85)

    /// Bouncy spring for playful interactions
    static let springBouncy = Animation.spring(response: 0.5, dampingFraction: 0.6)

    /// Timing animation for precise duration control (150ms)
    static let timing = Animation.easeInOut(duration: 0.15)

    /// Fast timing for quick fades (75ms)
    static let timingFast = Animation.easeInOut(duration: 0.075)

    /// Linear timing for constant-speed transitions (150ms)
    static let linear = Animation.linear(duration: 0.15)

    // MARK: - Specific UI Animations

    /// Card expansion animation
    static let cardExpand = Animation.spring(response: 0.5, dampingFraction: 0.75)

    /// Filter selection animation
    static let filterSelect = Animation.spring(response: 0.4, dampingFraction: 0.8)

    /// Starburst rotation animation
    static let starburstRotate = Animation.spring(response: 0.6, dampingFraction: 0.7)

    /// Button press animation
    static let buttonPress = Animation.easeInOut(duration: 0.12)

    /// Page transition animation
    static let pageTransition = Animation.spring(response: 0.5, dampingFraction: 0.8)

    /// Color shift animation
    static let colorShift = Animation.easeInOut(duration: 0.3)

    /// Bulk action reveal
    static let bulkReveal = Animation.spring(response: 0.4, dampingFraction: 0.75)
}

// MARK: - Transition Helpers

extension AnyTransition {
    /// Orbit-style fade transition
    static var orbitFade: AnyTransition {
        .opacity.animation(OrbitAnimation.timing)
    }

    /// Orbit-style scale fade
    static var orbitScaleFade: AnyTransition {
        .scale(scale: 0.95).combined(with: .opacity).animation(OrbitAnimation.spring)
    }

    /// Orbit-style move from bottom
    static var orbitMoveUp: AnyTransition {
        .move(edge: .bottom).combined(with: .opacity).animation(OrbitAnimation.spring)
    }

    /// Orbit-style move from top
    static var orbitMoveDown: AnyTransition {
        .move(edge: .top).combined(with: .opacity).animation(OrbitAnimation.spring)
    }
}

// MARK: - View Animation Modifiers

extension View {
    /// Apply Orbit spring animation
    func orbitSpring() -> some View {
        self.animation(OrbitAnimation.spring, value: UUID())
    }

    /// Apply Orbit timing animation
    func orbitTiming() -> some View {
        self.animation(OrbitAnimation.timing, value: UUID())
    }

    /// Animated appearance with spring
    func orbitAppear(delay: Double = 0) -> some View {
        self.modifier(OrbitAppearModifier(delay: delay))
    }
}

// MARK: - Appear Animation Modifier

struct OrbitAppearModifier: ViewModifier {
    let delay: Double
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .scaleEffect(appeared ? 1 : 0.95)
            .offset(y: appeared ? 0 : 10)
            .onAppear {
                withAnimation(OrbitAnimation.spring.delay(delay)) {
                    appeared = true
                }
            }
    }
}

// MARK: - Hover Animation Modifier

struct OrbitHoverModifier: ViewModifier {
    @State private var isHovered = false
    let scale: CGFloat
    let shadowRadius: CGFloat

    init(scale: CGFloat = 1.02, shadowRadius: CGFloat = 16) {
        self.scale = scale
        self.shadowRadius = shadowRadius
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(isHovered ? scale : 1.0)
            .shadow(
                color: Color.black.opacity(isHovered ? 0.1 : 0.04),
                radius: isHovered ? shadowRadius : 4,
                y: isHovered ? 8 : 2
            )
            .animation(OrbitAnimation.springFast, value: isHovered)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

extension View {
    /// Add Orbit-style hover animation
    func orbitHover(scale: CGFloat = 1.02, shadowRadius: CGFloat = 16) -> some View {
        self.modifier(OrbitHoverModifier(scale: scale, shadowRadius: shadowRadius))
    }
}

// MARK: - Numeric Value Animation

extension View {
    /// Animate numeric changes with spring
    func animateNumeric<V: Equatable>(_ value: V) -> some View {
        self.animation(OrbitAnimation.spring, value: value)
    }
}

// MARK: - Interactive Spring

struct InteractiveSpringModifier: ViewModifier {
    @GestureState private var isPressed = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .animation(OrbitAnimation.springFast, value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .updating($isPressed) { _, state, _ in
                        state = true
                    }
            )
    }
}

extension View {
    /// Add interactive press spring animation
    func interactiveSpring() -> some View {
        self.modifier(InteractiveSpringModifier())
    }
}
