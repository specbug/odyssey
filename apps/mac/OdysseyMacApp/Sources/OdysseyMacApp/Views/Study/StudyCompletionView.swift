import SwiftUI

/// Completion view shown when review session is complete
struct StudyCompletionView: View {
    let totalReviewed: Int
    let correctCount: Int
    let foregroundColor: Color
    let backgroundColor: Color
    let onContinue: () -> Void

    private var accuracy: Int {
        guard totalReviewed > 0 else { return 0 }
        return Int(round(Double(correctCount) / Double(totalReviewed) * 100))
    }

    var body: some View {
        VStack(spacing: 32) {
            if totalReviewed == 0 {
                // All caught up - no cards reviewed
                allCaughtUpView
            } else {
                // Session completed - show stats
                sessionCompleteView
            }

            // Continue button
            continueButton
        }
        .frame(maxWidth: 500)
    }

    // MARK: - All Caught Up View

    private var allCaughtUpView: some View {
        VStack(spacing: 24) {
            // Logo
            Image(systemName: "star.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(foregroundColor.opacity(0.9))

            // Message
            VStack(spacing: 8) {
                Text("All caught up!")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(foregroundColor)

                Text("Nothing's due for review.")
                    .font(.system(size: 20))
                    .foregroundStyle(foregroundColor.opacity(0.8))
            }
            .multilineTextAlignment(.center)
        }
    }

    // MARK: - Session Complete View

    private var sessionCompleteView: some View {
        VStack(spacing: 32) {
            // Completion asterisk
            StudyProgressIndicator(
                totalSteps: totalReviewed,
                currentStep: totalReviewed,
                size: 120,
                activeColor: Color(hex: "#ff4d06"),
                inactiveColor: Color(hex: "#ff4d06").opacity(0.2)
            )

            // Title
            Text("Review Complete")
                .font(.system(size: 32, weight: .semibold))
                .foregroundStyle(foregroundColor)

            // Stats
            HStack(spacing: 48) {
                // Cards reviewed
                VStack(spacing: 4) {
                    Text("\(totalReviewed)")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(foregroundColor)

                    Text(totalReviewed == 1 ? "card reviewed" : "cards reviewed")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(foregroundColor.opacity(0.7))
                }

                // Accuracy
                VStack(spacing: 4) {
                    Text("\(accuracy)%")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(foregroundColor)

                    Text("accuracy")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(foregroundColor.opacity(0.7))
                }
            }
        }
    }

    // MARK: - Continue Button

    private var continueButton: some View {
        Button(action: onContinue) {
            HStack(spacing: 12) {
                Text("Continue Reading")
                    .font(.system(size: 18, weight: .semibold))

                Image(systemName: "arrow.forward")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(backgroundColor)
            .padding(.horizontal, 32)
            .padding(.vertical, 16)
            .background(
                Capsule()
                    .fill(foregroundColor)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview("All Caught Up") {
    ZStack {
        Color(hex: "#3778BF")
            .ignoresSafeArea()

        StudyCompletionView(
            totalReviewed: 0,
            correctCount: 0,
            foregroundColor: .white,
            backgroundColor: Color(hex: "#3778BF"),
            onContinue: {}
        )
    }
}

#Preview("Session Complete") {
    ZStack {
        Color(hex: "#FF6163")
            .ignoresSafeArea()

        StudyCompletionView(
            totalReviewed: 15,
            correctCount: 12,
            foregroundColor: .white,
            backgroundColor: Color(hex: "#FF6163"),
            onContinue: {}
        )
    }
}

#Preview("Perfect Score") {
    ZStack {
        Color(hex: "#15B01A")
            .ignoresSafeArea()

        StudyCompletionView(
            totalReviewed: 20,
            correctCount: 20,
            foregroundColor: .white,
            backgroundColor: Color(hex: "#15B01A"),
            onContinue: {}
        )
    }
}
