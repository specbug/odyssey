import SwiftUI

/// Review buttons for FSRS spaced repetition system
struct ReviewButtonsView: View {
    let showAnswer: Bool
    let foregroundColor: Color
    let isLoading: Bool
    let onShowAnswer: () -> Void
    let onReview: (Int) -> Void

    var body: some View {
        if showAnswer {
            // Show the four FSRS rating buttons
            fsrsButtons
        } else {
            // Show the "Show Answer" button
            showAnswerButton
        }
    }

    // MARK: - Show Answer Button

    private var showAnswerButton: some View {
        Button(action: onShowAnswer) {
            HStack(spacing: 12) {
                Image(systemName: "eye.fill")
                    .font(.system(size: 18, weight: .semibold))

                Text("Show Answer")
                    .font(.system(size: 18, weight: .semibold))
            }
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 32)
            .padding(.vertical, 16)
            .background(
                Capsule()
                    .fill(foregroundColor.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
        .keyboardShortcut(.space, modifiers: [])
    }

    // MARK: - FSRS Rating Buttons

    private var fsrsButtons: some View {
        HStack(spacing: 12) {
            // Again (1) - Completely forgot
            fsrsButton(
                icon: "xmark",
                label: "Again",
                rating: 1,
                keyEquivalent: "1"
            )

            // Hard (2) - Remembered with difficulty
            fsrsButton(
                icon: "arrow.down.right",
                label: "Hard",
                rating: 2,
                keyEquivalent: "2"
            )

            // Good (3) - Remembered normally
            fsrsButton(
                icon: "checkmark",
                label: "Good",
                rating: 3,
                keyEquivalent: "3"
            )

            // Easy (4) - Remembered instantly
            fsrsButton(
                icon: "bolt.fill",
                label: "Easy",
                rating: 4,
                keyEquivalent: "4"
            )
        }
    }

    private func fsrsButton(
        icon: String,
        label: String,
        rating: Int,
        keyEquivalent: String
    ) -> some View {
        Button(action: { onReview(rating) }) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))

                Text(label)
                    .font(.system(size: 15, weight: .medium))
            }
            .foregroundStyle(foregroundColor)
            .frame(minWidth: 100)
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(foregroundColor.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .keyboardShortcut(KeyEquivalent(Character(keyEquivalent)), modifiers: [])
    }
}

#Preview("Show Answer State") {
    ZStack {
        Color(hex: "#3778BF")
            .ignoresSafeArea()

        ReviewButtonsView(
            showAnswer: false,
            foregroundColor: .white,
            isLoading: false,
            onShowAnswer: {},
            onReview: { _ in }
        )
        .padding()
    }
}

#Preview("Rating Buttons State") {
    ZStack {
        Color(hex: "#FF6163")
            .ignoresSafeArea()

        ReviewButtonsView(
            showAnswer: true,
            foregroundColor: .white,
            isLoading: false,
            onShowAnswer: {},
            onReview: { rating in
                print("Rated: \(rating)")
            }
        )
        .padding()
    }
}

#Preview("Dark Background") {
    ZStack {
        Color(hex: "#1B2431")
            .ignoresSafeArea()

        VStack(spacing: 40) {
            ReviewButtonsView(
                showAnswer: false,
                foregroundColor: .white,
                isLoading: false,
                onShowAnswer: {},
                onReview: { _ in }
            )

            ReviewButtonsView(
                showAnswer: true,
                foregroundColor: .white,
                isLoading: false,
                onShowAnswer: {},
                onReview: { _ in }
            )
        }
        .padding()
    }
}
