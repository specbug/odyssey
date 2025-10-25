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
    @State private var apiCards: [APIStudyCard] = []  // Keep API cards for IDs
    @State private var currentCardIndex: Int = 0
    @State private var sessionStats = SessionStats()
    @State private var loadedImages: [String: NSImage] = [:]  // Image cache

    // Backend for API calls
    private let backend: Backend

    init(backend: Backend? = nil) {
        if let backend = backend {
            self.backend = backend
        } else {
            self.backend = Backend()
        }
    }

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
                // Top bar (fixed)
                topBar
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)

                // Center content (scrollable)
                GeometryReader { geometry in
                    ScrollView {
                        VStack {
                            Spacer()
                                .frame(minHeight: 20)

                            if reviewComplete {
                                centerContent
                                    .frame(maxWidth: .infinity)
                            } else {
                                centerContent
                                    .frame(maxWidth: 700)
                                    .padding(.horizontal, 40)
                            }

                            Spacer()
                                .frame(minHeight: 20)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: geometry.size.height) // Ensure minimum height for centering
                    }
                }

                // Bottom action bar (fixed)
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
        // Debug: Log render state
        print("🎨 Rendering card \(card.id):")
        print("   - showAnswer: \(showAnswer)")
        print("   - isClozeCard: \(card.isClozeCard)")
        print("   - will show answer section: \(!card.isClozeCard && showAnswer && !card.answer.isEmpty)")

        return VStack(spacing: 32) {
            // Card content
            StudyCardContent(
                content: card.question,
                imageStore: loadedImages, // Use loaded images
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
                        imageStore: loadedImages,
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
        isLoading = true

        Task {
            do {
                // Fetch due cards from API
                let dueCardsResponse = try await backend.fetchDueCards(limit: 50)

                // Combine all types of cards (due, new, learning)
                let allCards = dueCardsResponse.dueCards + dueCardsResponse.newCards + dueCardsResponse.learningCards

                // Store API cards for later use (for IDs)
                apiCards = allCards

                // Map to local StudyCard model
                dueCards = allCards.compactMap { apiCard in
                    mapAPICardToStudyCard(apiCard)
                }

                if dueCards.isEmpty {
                    // No cards to review
                    reviewComplete = true
                    isLoading = false
                    return
                }

                currentCard = dueCards.first
                currentCardIndex = 0

                // Load images for all cards
                await loadImagesForCards()

                isLoading = false

                // Load timeline for first card
                loadTimelineForCurrentCard()
            } catch {
                print("❌ Error loading cards: \(error.localizedDescription)")
                // Show empty state or error
                isLoading = false
                reviewComplete = true
            }
        }
    }

    private func mapAPICardToStudyCard(_ apiCard: APIStudyCard) -> StudyCard? {
        guard let annotation = apiCard.annotation else {
            print("⚠️ Card \(apiCard.id) has no annotation")
            return nil
        }

        // Determine if this is a cloze card
        // Check both API clozeIndex AND question text for cloze patterns
        var isClozeCard = apiCard.clozeIndex != nil
        var clozeIndex = apiCard.clozeIndex

        // Fallback: detect cloze patterns in question text if API doesn't provide clozeIndex
        if !isClozeCard && containsClozePattern(annotation.question) {
            print("⚠️ Card \(apiCard.id): Detected cloze pattern in question but API clozeIndex is nil, using fallback")
            isClozeCard = true
            clozeIndex = 1  // Default to first cloze
        }

        // Debug logging
        print("📝 Card \(apiCard.id):")
        print("   - isClozeCard: \(isClozeCard)")
        print("   - clozeIndex: \(clozeIndex?.description ?? "nil")")
        print("   - question length: \(annotation.question.count)")
        print("   - answer length: \(annotation.answer.count)")
        print("   - question preview: \(String(annotation.question.prefix(100)))")

        return StudyCard(
            id: String(apiCard.id),
            question: annotation.question,
            answer: annotation.answer,
            isClozeCard: isClozeCard,
            clozeIndex: clozeIndex
        )
    }

    private func containsClozePattern(_ text: String) -> Bool {
        let clozePattern = "\\{\\{c\\d+::.+?\\}\\}"
        guard let regex = try? NSRegularExpression(pattern: clozePattern, options: []) else {
            return false
        }
        let range = NSRange(location: 0, length: text.utf16.count)
        return regex.firstMatch(in: text, options: [], range: range) != nil
    }

    private func loadImagesForCards() async {
        // Extract all unique image UUIDs from all cards
        var imageUUIDs: Set<String> = []

        for card in dueCards {
            imageUUIDs.formUnion(extractImageUUIDs(from: card.question))
            imageUUIDs.formUnion(extractImageUUIDs(from: card.answer))
        }

        guard !imageUUIDs.isEmpty else {
            print("📷 No images to load")
            return
        }

        print("📷 Loading \(imageUUIDs.count) images...")

        // Fetch images from API
        for uuid in imageUUIDs {
            do {
                let imageData = try await backend.fetchImage(uuid: uuid)
                if let image = NSImage(data: imageData) {
                    loadedImages[uuid] = image
                    print("✅ Loaded image: \(uuid.prefix(8))...")
                } else {
                    print("❌ Failed to create NSImage from data: \(uuid.prefix(8))...")
                }
            } catch {
                print("❌ Error loading image \(uuid.prefix(8))...: \(error.localizedDescription)")
            }
        }

        print("📷 Finished loading images. Total: \(loadedImages.count)")
    }

    private func extractImageUUIDs(from text: String) -> Set<String> {
        let imagePattern = "\\[image:([a-fA-F0-9\\-]+)\\]"
        guard let regex = try? NSRegularExpression(pattern: imagePattern, options: []) else {
            return []
        }

        let nsString = text as NSString
        let range = NSRange(location: 0, length: nsString.length)
        let matches = regex.matches(in: text, options: [], range: range)

        var uuids: Set<String> = []
        for match in matches {
            if match.numberOfRanges > 1 {
                let uuidRange = match.range(at: 1)
                let uuid = nsString.substring(with: uuidRange)
                uuids.insert(uuid)
            }
        }

        return uuids
    }

    private func loadTimelineForCurrentCard() {
        // Get the API card ID for the current card
        guard currentCardIndex < apiCards.count else { return }
        let apiCard = apiCards[currentCardIndex]

        Task {
            do {
                let timelineResponse = try await backend.fetchCardTimeline(cardId: apiCard.id)

                // Map timeline points to interval info
                let intervals = timelineResponse.timeline.timelinePoints.map { point in
                    TimelineVisualizationView.IntervalInfo(intervalText: point.intervalText)
                }

                timelineIntervals = intervals
            } catch {
                print("❌ Error loading timeline: \(error.localizedDescription)")
                // Use fallback placeholder data
                timelineIntervals = [
                    .init(intervalText: "10m"),
                    .init(intervalText: "1d"),
                    .init(intervalText: "3d"),
                    .init(intervalText: "1w")
                ]
            }
        }
    }

    private func handleShowAnswer() {
        withAnimation(.easeOut(duration: 0.3)) {
            showAnswer = true
        }
    }

    private func handleReview(rating: Int) {
        // Get the API card ID for the current card
        guard currentCardIndex < apiCards.count else { return }
        let apiCard = apiCards[currentCardIndex]

        // Set loading state
        isLoading = true

        Task {
            do {
                // Submit review to API
                _ = try await backend.reviewCard(
                    cardId: apiCard.id,
                    rating: rating,
                    timeTaken: nil,
                    sessionId: nil
                )

                // Update stats (rating >= 2 means correct in FSRS: Hard, Good, Easy)
                sessionStats.total += 1
                if rating >= 2 {
                    sessionStats.correct += 1
                }

                isLoading = false

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
            } catch {
                print("❌ Error submitting review: \(error.localizedDescription)")
                isLoading = false
                // Still move to next card even if review submission failed
                // to avoid blocking the user
                if currentCardIndex < dueCards.count - 1 {
                    currentCardIndex += 1
                    currentCard = dueCards[currentCardIndex]
                    showAnswer = false
                    currentThemeIndex = (currentThemeIndex + 1) % StudyColorThemes.all.count
                    loadTimelineForCurrentCard()
                } else {
                    withAnimation {
                        reviewComplete = true
                    }
                }
            }
        }
    }

    private func skipCard() {
        handleReview(rating: 1) // Skip is like "Again" (rating 1)
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
