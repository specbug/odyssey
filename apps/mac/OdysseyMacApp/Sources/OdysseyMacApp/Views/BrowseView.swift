import SwiftUI

struct BrowseView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: BrowseViewModel

    @State private var query: String = ""
    @State private var stateFilter: StateFilter = .all
    @State private var deckFilter: String? = nil
    @State private var tagFilter: String? = nil
    @State private var sortOrder: SortOrder = .dueDate

    // Dynamic palette based on time of day
    @State private var currentPalette = OdysseyColorPalette.timeOfDay

    init(viewModel: BrowseViewModel? = nil) {
        if let viewModel = viewModel {
            _viewModel = StateObject(wrappedValue: viewModel)
        } else {
            _viewModel = StateObject(wrappedValue: BrowseViewModel(backend: Backend()))
        }
    }

    enum StateFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case new = "New"
        case review = "Review"
        case learning = "Learning"
        case buried = "Buried"
        case suspended = "Suspended"

        var id: String { rawValue }

        var symbol: String {
            switch self {
            case .all: return "circle"
            case .new: return "circle.fill"
            case .review: return "circle.lefthalf.filled"
            case .learning: return "circle.dashed"
            case .buried: return "circle.bottomhalf.filled"
            case .suspended: return "circle.slash"
            }
        }
    }

    enum SortOrder: String, CaseIterable, Identifiable {
        case dueDate = "Due Date"
        case created = "Created"
        case difficulty = "Difficulty"
        case deck = "Deck"

        var id: String { rawValue }
    }

    var availableDecks: [String] {
        Array(Set(viewModel.cards.map { $0.deck })).sorted()
    }

    var availableTags: [String] {
        Array(Set(viewModel.cards.map { $0.tag })).sorted()
    }

    var filteredCards: [CardSummary] {
        var filtered = viewModel.cards

        // Apply search filter
        if !query.isEmpty {
            filtered = filtered.filter {
                $0.front.localizedCaseInsensitiveContains(query) ||
                $0.deck.localizedCaseInsensitiveContains(query) ||
                $0.source.localizedCaseInsensitiveContains(query) ||
                $0.tag.localizedCaseInsensitiveContains(query)
            }
        }

        // Apply state filter
        if stateFilter != .all {
            filtered = filtered.filter { card in
                switch stateFilter {
                case .all: return true
                case .new: return card.state == .new
                case .review: return card.state == .review
                case .learning: return card.state == .learning
                case .buried: return card.state == .buried
                case .suspended: return card.state == .suspended
                }
            }
        }

        // Apply deck filter
        if let deckFilter {
            filtered = filtered.filter { $0.deck == deckFilter }
        }

        // Apply tag filter
        if let tagFilter {
            filtered = filtered.filter { $0.tag == tagFilter }
        }

        // Apply sort
        switch sortOrder {
        case .dueDate:
            filtered.sort { $0.dueInHours < $1.dueInHours }
        case .created:
            filtered.sort { $0.front < $1.front }
        case .difficulty:
            filtered.sort { $0.dueInHours > $1.dueInHours }
        case .deck:
            filtered.sort { $0.deck < $1.deck }
        }

        return filtered
    }

    var body: some View {
        ZStack(alignment: .top) {
            // Full-bleed vibrant background
            currentPalette.backgroundColor
                .ignoresSafeArea()
                .opacity(0.15)

            // Canvas base
            OdysseyColor.canvas
                .ignoresSafeArea()
                .opacity(0.85)

            if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.error {
                errorView(error: error)
            } else if viewModel.cards.isEmpty {
                emptyStateView
            } else {
                mainContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .task {
            await viewModel.loadInitialCards()
        }
        .onAppear {
            // Update palette every minute for time-of-day changes
            Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
                withAnimation(OrbitAnimation.colorShift) {
                    currentPalette = OdysseyColorPalette.timeOfDay
                }
            }
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                // Header with starburst
                headerWithStarburst

                // Search and filters
                searchAndFilters

                // Card grid
                cardGrid
            }
            .padding(.horizontal, 48)
            .padding(.vertical, 32)
            .frame(maxWidth: 1000, alignment: .topLeading)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: - Header with Starburst

    private var headerWithStarburst: some View {
        HStack(alignment: .center, spacing: 24) {
            // Large starburst visualization
            StarburstView(
                values: filteredCards.prefix(24).map { card in
                    // Normalize due date to 0-1 range
                    let dueInDays = max(0, Double(card.dueInHours) / 24.0)
                    return min(1.0, max(0.2, 1.0 - (dueInDays / 30.0)))  // 30 days max
                },
                size: 120,
                strokeWidth: 3,
                color: currentPalette.accentColor
            )
            .orbitAppear(delay: 0.1)

            VStack(alignment: .leading, spacing: 8) {
                Text("Browse Cards")
                    .font(OdysseyFont.headline)
                    .foregroundStyle(OdysseyColor.ink)

                Text("\(filteredCards.count) cards")
                    .font(OdysseyFont.labelSmall)
                    .foregroundStyle(OdysseyColor.mutedText)
                    .textCase(.uppercase)
                    .tracking(0.5)
            }
            .orbitAppear(delay: 0.2)

            Spacer()
        }
    }

    // MARK: - Search and Filters

    private var searchAndFilters: some View {
        VStack(spacing: 16) {
            // Search bar
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(currentPalette.accentColor)

                TextField("Search question, deck, or source…", text: $query)
                    .textFieldStyle(.plain)
                    .font(OdysseyFont.bodySmall)
                    .autocorrectionDisabled()
                    .foregroundStyle(OdysseyColor.ink)

                if !query.isEmpty {
                    Button {
                        withAnimation(OrbitAnimation.spring) {
                            query = ""
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(OdysseyColor.mutedText)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(OdysseyColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(query.isEmpty ? OdysseyColor.border : currentPalette.accentColor, lineWidth: 1.5)
            )
            .shadow(color: OdysseyColor.shadow.opacity(0.05), radius: 4, y: 2)
            .animation(OrbitAnimation.springFast, value: query)

            // Geometric filters
            HStack(spacing: 12) {
                // State filter
                FilterButton(
                    icon: stateFilter.symbol,
                    label: stateFilter.rawValue,
                    isActive: stateFilter != .all,
                    color: currentPalette.accentColor
                ) {
                    // Cycle through filters
                    let allCases = StateFilter.allCases
                    if let currentIndex = allCases.firstIndex(of: stateFilter) {
                        withAnimation(OrbitAnimation.springBouncy) {
                            stateFilter = allCases[(currentIndex + 1) % allCases.count]
                        }
                    }
                }

                // Deck filter
                Menu {
                    Button("All Decks") {
                        withAnimation(OrbitAnimation.spring) {
                            deckFilter = nil
                        }
                    }
                    Divider()
                    ForEach(availableDecks, id: \.self) { deck in
                        Button(deck) {
                            withAnimation(OrbitAnimation.spring) {
                                deckFilter = deck
                            }
                        }
                    }
                } label: {
                    FilterButton(
                        icon: "square.grid.2x2",
                        label: deckFilter ?? "All Decks",
                        isActive: deckFilter != nil,
                        color: currentPalette.secondaryAccentColor
                    ) {}
                }
                .buttonStyle(.plain)

                // Tag filter
                Menu {
                    Button("All Tags") {
                        withAnimation(OrbitAnimation.spring) {
                            tagFilter = nil
                        }
                    }
                    Divider()
                    ForEach(availableTags, id: \.self) { tag in
                        Button(tag) {
                            withAnimation(OrbitAnimation.spring) {
                                tagFilter = tag
                            }
                        }
                    }
                } label: {
                    FilterButton(
                        icon: "tag",
                        label: tagFilter ?? "All Tags",
                        isActive: tagFilter != nil,
                        color: currentPalette.secondaryAccentColor
                    ) {}
                }
                .buttonStyle(.plain)

                Spacer()

                // Sort button
                Menu {
                    ForEach(SortOrder.allCases) { order in
                        Button(order.rawValue) {
                            withAnimation(OrbitAnimation.spring) {
                                sortOrder = order
                            }
                        }
                    }
                } label: {
                    FilterButton(
                        icon: "arrow.up.arrow.down",
                        label: sortOrder.rawValue,
                        isActive: true,
                        color: OdysseyColor.mutedText
                    ) {}
                }
                .buttonStyle(.plain)
            }
        }
        .orbitAppear(delay: 0.3)
    }

    // MARK: - Chip Grid

    private var cardGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.adaptive(minimum: 280, maximum: 300), spacing: 16)
            ],
            spacing: 16
        ) {
            ForEach(Array(filteredCards.enumerated()), id: \.element.id) { index, card in
                GeometricChip(
                    card: card,
                    palette: currentPalette,
                    onTap: {
                        // Future: Navigate to detail view
                        print("Tapped card: \(card.front)")
                    }
                )
                .orbitAppear(delay: 0.4 + Double(index) * 0.02)
                .onAppear {
                    // Load more when near end
                    if index == filteredCards.count - 3 {
                        Task {
                            await viewModel.loadMoreCards()
                        }
                    }
                }
            }

            // Loading more indicator
            if viewModel.isLoadingMore {
                VStack {
                    RotatingStarburstView(size: 40, color: currentPalette.accentColor)
                }
                .frame(width: 280, height: 180)
            }
        }
    }

    // MARK: - Loading, Error & Empty States

    private var loadingView: some View {
        VStack(spacing: 32) {
            Spacer()
            RotatingStarburstView(size: 80, color: currentPalette.accentColor)
            Text("Loading cards...")
                .font(OdysseyFont.label)
                .foregroundStyle(OdysseyColor.mutedText)
            Spacer()
        }
    }

    private func errorView(error: Error) -> some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 16) {
                // Geometric error icon
                ZStack {
                    Circle()
                        .fill(OdysseyColor.destructive.opacity(0.1))
                        .frame(width: 80, height: 80)

                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(OdysseyColor.destructive)
                }

                Text("Failed to load cards")
                    .font(OdysseyFont.title)
                    .foregroundStyle(OdysseyColor.ink)

                Text(error.localizedDescription)
                    .font(OdysseyFont.bodySmall)
                    .foregroundStyle(OdysseyColor.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Button {
                    Task {
                        await viewModel.refreshCards()
                    }
                } label: {
                    Text("Try Again")
                        .font(OdysseyFont.labelSmall)
                        .foregroundStyle(OdysseyColor.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(
                            Capsule()
                                .fill(currentPalette.accentColor)
                        )
                }
                .buttonStyle(.plain)
                .interactiveSpring()
            }

            Spacer()
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 16) {
                // Geometric empty state icon
                CompactStarburstView(rayCount: 8, size: 80, color: OdysseyColor.mutedText.opacity(0.3))

                Text("No cards yet")
                    .font(OdysseyFont.title)
                    .foregroundStyle(OdysseyColor.ink)

                Text("Create your first flashcard from the Add tab")
                    .font(OdysseyFont.bodySmall)
                    .foregroundStyle(OdysseyColor.mutedText)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
    }
}

// MARK: - Filter Button

struct FilterButton: View {
    let icon: String
    let label: String
    let isActive: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))

                Text(label)
                    .font(OdysseyFont.labelTiny)
                    .textCase(.uppercase)
                    .tracking(0.3)
            }
            .foregroundStyle(isActive ? color : OdysseyColor.mutedText)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isActive ? color.opacity(0.15) : OdysseyColor.border.opacity(0.3))
            )
        }
        .buttonStyle(.plain)
        .interactiveSpring()
    }
}

// MARK: - Card Summary Model

struct CardSummary: Identifiable, Hashable {
    enum State: CaseIterable {
        case new, review, learning, buried, suspended

        var label: String {
            switch self {
            case .new: return "New"
            case .review: return "Review"
            case .learning: return "Learning"
            case .buried: return "Buried"
            case .suspended: return "Suspended"
            }
        }

        var foreground: Color { tint }
        var background: Color { tint.opacity(0.08) }

        private var tint: Color {
            switch self {
            case .new: return OdysseyColor.browseColors[3]
            case .review: return Color(red: 59/255, green: 166/255, blue: 107/255)
            case .learning: return OdysseyColor.browseColors[10]
            case .buried: return OdysseyColor.browseColors[8]
            case .suspended: return OdysseyColor.mutedText.opacity(0.6)
            }
        }
    }

    let id = UUID()
    var deck: String
    var tag: String
    var front: String
    var back: String
    var source: String
    var state: State
    var dueDate: Date

    // Computed property for backward compatibility
    var dueInHours: Int {
        Int(dueDate.timeIntervalSinceNow / 3600)
    }

    private static let dueDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    var dueDateString: String {
        CardSummary.dueDateFormatter.string(from: dueDate)
    }

    init(
        deck: String,
        tag: String? = nil,
        front: String,
        back: String,
        source: String,
        state: State,
        dueDate: Date
    ) {
        self.deck = deck
        self.tag = tag ?? deck
        self.front = front
        self.back = back
        self.source = source
        self.state = state
        self.dueDate = dueDate
    }

    // Legacy initializer for backward compatibility with sample data
    init(
        deck: String,
        tag: String? = nil,
        front: String,
        back: String,
        source: String,
        state: State,
        dueInHours: Int
    ) {
        self.deck = deck
        self.tag = tag ?? deck
        self.front = front
        self.back = back
        self.source = source
        self.state = state
        self.dueDate = Date().addingTimeInterval(TimeInterval(dueInHours) * 3600)
    }
}

extension CardSummary {
    static let samples: [CardSummary] = [
        .init(
            deck: "FSRS Fundamentals",
            tag: "Memory",
            front: "What is the retention benefit of spaced repetition?",
            back: "Spaced repetition optimizes review intervals to keep recall near 90% while minimizing total study time.",
            source: "Excerpt • Space Repetition Fundamentals",
            state: .review,
            dueInHours: -5
        ),
        .init(
            deck: "Design Systems",
            tag: "UI",
            front: "List the core Orbit color tokens used by Odyssey.",
            back: "Ink, Accent, Background, Secondary Background, Secondary Text, Yellow Accent.",
            source: "Odyssey design tokens",
            state: .new,
            dueInHours: 4
        ),
        .init(
            deck: "Cryptography",
            tag: "Security",
            front: "What is the difference between symmetric and asymmetric encryption?",
            back: "Symmetric encryption uses one shared key (fast, but key exchange is hard). Asymmetric encryption uses public/private keys (great for sharing secrets, but slower). Most systems combine them: public key to exchange a random symmetric key, symmetric key for the heavy lifting.",
            source: "Applied Cryptography",
            state: .learning,
            dueInHours: 12
        ),
        .init(
            deck: "Machine Learning",
            tag: "ML Theory",
            front: "Explain why ReLU activations ease the vanishing gradient problem.",
            back: "ReLU stays linear for positive inputs, so gradients propagate without shrinking, unlike sigmoid/tanh which squash signals toward zero.",
            source: "Deep Learning • Goodfellow et al.",
            state: .review,
            dueInHours: 2
        ),
        .init(
            deck: "System Design",
            tag: "Architecture",
            front: "Outline a cache invalidation strategy for a write-heavy API.",
            back: "Prefer write-through for strong consistency, supplement with background revalidation and targeted purge hooks for hot keys.",
            source: "Personal notes",
            state: .buried,
            dueInHours: 18
        ),
        .init(
            deck: "Physics",
            tag: "Electromagnetism",
            front: "State Gauss's law in integral form.",
            back: "The electric flux through a closed surface equals the enclosed charge divided by ε₀.",
            source: "Resnick & Halliday",
            state: .suspended,
            dueInHours: 8
        )
    ]
}

// MARK: - Preview

#Preview {
    BrowseView()
}
