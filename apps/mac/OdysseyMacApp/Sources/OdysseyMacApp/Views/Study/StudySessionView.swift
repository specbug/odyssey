import SwiftUI

/// Full-screen study session view matching ReviewModal.js design
struct StudySessionView: View {
    @EnvironmentObject private var appState: AppState

    // Session state
    @State private var currentCard: StudyCard?
    @State private var showAnswer: Bool = false
    @State private var isLoading: Bool = false
    @State private var reviewComplete: Bool = false

    // Cards and stats
    @State private var dueCards: [StudyCard] = []
    @State private var currentCardIndex: Int = 0
    @State private var sessionStats = SessionStats()

    // Theme
    @State private var currentThemeIndex: Int = 0
    private var currentTheme: StudyColorTheme {
        StudyColorThemes.all[currentThemeIndex % StudyColorThemes.all.count]
    }

    // UI state
    @State private var showContextMenu: Bool = false
    @State private var showReschedulePicker: Bool = false
    @State private var rescheduleDate: Date = Date()

    // Timeline
    @State private var timelineIntervals: [TimelineVisualizationView.IntervalInfo]? = nil

    var body: some View {
        ZStack {
            // Dynamic background
            currentTheme.bg
                .ignoresSafeArea()
                .animation(.easeInOut(duration: 0.5), value: currentThemeIndex)

            VStack(spacing: 0) {
                // Top bar
                topBar
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)

                Spacer()

                // Center content
                if reviewComplete {
                    centerContent
                        .frame(maxWidth: .infinity)
                } else {
                    centerContent
                        .frame(maxWidth: 700)
                        .padding(.horizontal, 40)
                }

                Spacer()

                // Bottom action bar
                if !reviewComplete && currentCard != nil {
                    bottomActionBar
                        .padding(.horizontal, 40)
                        .padding(.bottom, 32)
                }
            }
        }
        .onAppear {
            loadCards()
            currentThemeIndex = Int.random(in: 0..<StudyColorThemes.all.count)
        }
        .onKeyPress(.escape) {
            appState.isInStudySession = false
            return .handled
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(spacing: 0) {
            // Left: Timeline
            if currentCard != nil && !reviewComplete {
                TimelineVisualizationView(
                    intervals: timelineIntervals,
                    isLoading: timelineIntervals == nil,
                    foregroundColor: currentTheme.fg
                )
            } else {
                Color.clear.frame(width: 160)
            }

            Spacer()

            // Center: Progress asterisk
            if currentCard != nil && !reviewComplete {
                StudyProgressIndicator(
                    totalSteps: dueCards.count,
                    currentStep: currentCardIndex + 1,
                    size: 36,
                    activeColor: Color(hex: "#ff4d06"),
                    inactiveColor: Color.black.opacity(0.15)
                )
            }

            Spacer()

            // Right: Menu, reschedule, close
            HStack(spacing: 16) {
                if currentCard != nil && !reviewComplete {
                    // Context menu
                    Menu {
                        Button(action: skipCard) {
                            Label("Skip Prompt", systemImage: "forward.fill")
                        }

                        Button(action: viewInDocument) {
                            Label("Visit Prompt Origin", systemImage: "arrow.up.forward.square")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(currentTheme.fg)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(currentTheme.fg.opacity(0.15))
                            )
                    }
                    .buttonStyle(.plain)

                    // Reschedule button
                    Button(action: { showReschedulePicker.toggle() }) {
                        Image(systemName: "calendar")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(currentTheme.fg)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(currentTheme.fg.opacity(0.15))
                            )
                    }
                    .buttonStyle(.plain)
                    .popover(isPresented: $showReschedulePicker, arrowEdge: .bottom) {
                        RescheduleDatePicker(
                            selectedDate: $rescheduleDate,
                            isPresented: $showReschedulePicker,
                            onConfirm: { date in
                                print("Rescheduled to: \(date)")
                            }
                        )
                    }
                }

                // Close button
                Button(action: { appState.isInStudySession = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(currentTheme.fg)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(currentTheme.fg.opacity(0.15))
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Center Content

    @ViewBuilder
    private var centerContent: some View {
        if isLoading {
            loadingState
        } else if reviewComplete {
            completionState
        } else if let card = currentCard {
            activeCardState(card: card)
        } else {
            emptyState
        }
    }

    private var loadingState: some View {
        VStack(spacing: 24) {
            ProgressView()
                .progressViewStyle(.circular)
                .controlSize(.large)
                .tint(currentTheme.fg)

            Text("Preparing your cards")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(currentTheme.fg.opacity(0.8))
        }
    }

    private var completionState: some View {
        StudyCompletionView(
            totalReviewed: sessionStats.total,
            correctCount: sessionStats.correct,
            foregroundColor: currentTheme.fg,
            backgroundColor: currentTheme.bg,
            onContinue: { appState.isInStudySession = false }
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func activeCardState(card: StudyCard) -> some View {
        VStack(spacing: 32) {
            // Card content
            StudyCardContent(
                content: card.question,
                imageStore: [:], // TODO: Pass actual image store
                isClozeCard: card.isClozeCard,
                clozeIndex: card.clozeIndex ?? 1,
                showAnswer: showAnswer,
                clozeColor: getClozeColor(),
                textColor: currentTheme.fg,
                fontSize: 42,
                fontWeight: 600
            )

            // Answer section (for basic cards only)
            if !card.isClozeCard && showAnswer && !card.answer.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Rectangle()
                        .fill(currentTheme.fg)
                        .frame(height: 2)
                        .frame(maxWidth: .infinity)

                    StudyCardContent(
                        content: card.answer,
                        imageStore: [:],
                        isClozeCard: false,
                        clozeIndex: 1,
                        showAnswer: true,
                        clozeColor: getClozeColor(),
                        textColor: currentTheme.fg,
                        fontSize: 32,
                        fontWeight: 500
                    )
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 24) {
            Image(systemName: "book.circle")
                .font(.system(size: 80))
                .foregroundStyle(currentTheme.fg.opacity(0.6))

            Text("Ready to Learn")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(currentTheme.fg)

            Text("Create annotations in your document\nto generate study cards automatically.")
                .font(.system(size: 16))
                .foregroundStyle(currentTheme.fg.opacity(0.8))
                .multilineTextAlignment(.center)

            Button(action: { appState.isInStudySession = false }) {
                HStack(spacing: 12) {
                    Text("Return to Book")
                        .font(.system(size: 18, weight: .semibold))

                    Image(systemName: "arrow.forward")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(currentTheme.bg)
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .background(
                    Capsule()
                        .fill(currentTheme.fg)
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Bottom Action Bar

    private var bottomActionBar: some View {
        ReviewButtonsView(
            showAnswer: showAnswer,
            foregroundColor: currentTheme.fg,
            isLoading: isLoading,
            onShowAnswer: handleShowAnswer,
            onReview: handleReview
        )
    }

    // MARK: - Actions

    private func loadCards() {
        // TODO: Load actual cards from backend
        // For now, use placeholder data
        isLoading = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            // Placeholder cards
            dueCards = [
                StudyCard(
                    id: "1",
                    question: "What is the capital of France?",
                    answer: "Paris",
                    isClozeCard: false,
                    clozeIndex: nil
                ),
                StudyCard(
                    id: "2",
                    question: "The capital of {{c1::Germany}} is {{c2::Berlin}}.",
                    answer: "",
                    isClozeCard: true,
                    clozeIndex: 1
                ),
                StudyCard(
                    id: "3",
                    question: "What is $E = mc^2$ known as?",
                    answer: "Einstein's mass-energy equivalence equation",
                    isClozeCard: false,
                    clozeIndex: nil
                )
            ]

            currentCard = dueCards.first
            currentCardIndex = 0
            isLoading = false

            // Load timeline for first card
            loadTimelineForCurrentCard()
        }
    }

    private func loadTimelineForCurrentCard() {
        // TODO: Load actual timeline from backend
        // Placeholder data
        timelineIntervals = [
            .init(intervalText: "10m"),
            .init(intervalText: "1d"),
            .init(intervalText: "3d"),
            .init(intervalText: "1w")
        ]
    }

    private func handleShowAnswer() {
        withAnimation(.easeOut(duration: 0.3)) {
            showAnswer = true
        }
    }

    private func handleReview(rating: Int) {
        // Update stats (rating >= 2 means correct in FSRS)
        sessionStats.total += 1
        if rating >= 2 {
            sessionStats.correct += 1
        }

        // Move to next card
        if currentCardIndex < dueCards.count - 1 {
            currentCardIndex += 1
            currentCard = dueCards[currentCardIndex]
            showAnswer = false

            // Change theme
            currentThemeIndex = (currentThemeIndex + 1) % StudyColorThemes.all.count

            // Load timeline for new card
            loadTimelineForCurrentCard()
        } else {
            // Session complete
            withAnimation {
                reviewComplete = true
            }
        }
    }

    private func skipCard() {
        handleReview(rating: 0) // Skip is like rating 0
    }

    private func viewInDocument() {
        // TODO: Implement navigation to document
        print("View in document")
    }

    private func getClozeColor() -> String {
        // Calculate if we need light or dark cloze colors
        let isDark = currentTheme.fg == Color.white

        if isDark {
            return "rgba(255, 235, 59, 0.6)" // Brighter yellow for dark backgrounds
        } else {
            return "rgba(249, 168, 37, 0.5)" // Darker yellow for light backgrounds
        }
    }
}

// MARK: - Data Models

struct StudyCard: Identifiable {
    let id: String
    let question: String
    let answer: String
    let isClozeCard: Bool
    let clozeIndex: Int?
}

struct SessionStats {
    var correct: Int = 0
    var total: Int = 0
}

// MARK: - Preview

#Preview {
    StudySessionView()
}
