import SwiftUI

struct BrowseView: View {
    @State private var query: String = ""
    @State private var cards: [CardSummary] = CardSummary.samples
    @State private var expandedCardId: UUID? = nil
    @State private var selectedCards: Set<UUID> = []
    @State private var stateFilter: StateFilter = .all
    @State private var deckFilter: String? = nil
    @State private var tagFilter: String? = nil
    @State private var sortOrder: SortOrder = .dueDate

    enum StateFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case new = "New"
        case review = "Review"
        case learning = "Learning"
        case buried = "Buried"
        case suspended = "Suspended"

        var id: String { rawValue }
    }

    enum SortOrder: String, CaseIterable, Identifiable {
        case dueDate = "Due Date"
        case created = "Created"
        case difficulty = "Difficulty"
        case deck = "Deck"

        var id: String { rawValue }
    }

    var availableDecks: [String] {
        Array(Set(cards.map { $0.deck })).sorted()
    }

    var availableTags: [String] {
        Array(Set(cards.map { $0.tag })).sorted()
    }

    var filteredCards: [CardSummary] {
        var filtered = cards

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
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
                header
                searchAndFilters
                listView
            }
            .padding(.horizontal, 48)
            .padding(.vertical, OdysseySpacing.xl.value)
            .frame(maxWidth: 1320, alignment: .topLeading)

            // Bulk actions bar
            if !selectedCards.isEmpty {
                bulkActionsBar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        Text("Browse Cards")
            .font(.system(size: 28, weight: .semibold))
            .foregroundStyle(OdysseyColor.ink)
    }

    private var searchAndFilters: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            // Search bar
            HStack(spacing: OdysseySpacing.sm.value) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))

                TextField("Search question, deck, or source…", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .autocorrectionDisabled()
                    .foregroundStyle(OdysseyColor.ink)

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(OdysseyColor.mutedText.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, OdysseySpacing.md.value)
            .padding(.vertical, OdysseySpacing.sm.value)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(OdysseyColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(query.isEmpty ? OdysseyColor.border : OdysseyColor.accent.opacity(0.5), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 2, y: 1)

            // Filters and Sort
            HStack(spacing: OdysseySpacing.md.value) {
                // State filter
                Menu {
                    ForEach(StateFilter.allCases) { filter in
                        Button(filter.rawValue) {
                            stateFilter = filter
                        }
                    }
                } label: {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                        Text("State: \(stateFilter.rawValue)")
                            .font(.system(size: 13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: stateFilter == .all ? OdysseyColor.border.opacity(0.25) : OdysseyColor.accent.opacity(0.16),
                        foreground: stateFilter == .all ? OdysseyColor.mutedText : OdysseyColor.accent
                    )
                )

                // Deck filter
                Menu {
                    Button("All Decks") {
                        deckFilter = nil
                    }

                    ForEach(availableDecks, id: \.self) { deck in
                        Button(deck) {
                            deckFilter = deck
                        }
                    }
                } label: {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "square.grid.2x2")
                        Text("Deck: \(deckFilter ?? "All")")
                            .font(.system(size: 13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: deckFilter == nil ? OdysseyColor.border.opacity(0.25) : OdysseyColor.border.opacity(0.35),
                        foreground: OdysseyColor.mutedText
                    )
                )

                // Tag filter
                Menu {
                    Button("All Tags") {
                        tagFilter = nil
                    }

                    ForEach(availableTags, id: \.self) { tag in
                        Button(tag) {
                            tagFilter = tag
                        }
                    }
                } label: {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "tag")
                        Text("Tag: \(tagFilter ?? "All")")
                            .font(.system(size: 13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: tagFilter == nil ? OdysseyColor.border.opacity(0.25) : OdysseyColor.border.opacity(0.35),
                        foreground: OdysseyColor.mutedText
                    )
                )

                // Sort order
                Menu {
                    ForEach(SortOrder.allCases) { order in
                        Button(order.rawValue) {
                            sortOrder = order
                        }
                    }
                } label: {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "arrow.up.arrow.down")
                        Text("Sort: \(sortOrder.rawValue)")
                            .font(.system(size: 13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.border.opacity(0.25),
                        foreground: OdysseyColor.mutedText
                    )
                )

                Spacer()

                if !selectedCards.isEmpty {
                    Text("\(selectedCards.count) selected")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(OdysseyColor.accent)
                } else {
                    Text("\(filteredCards.count) cards")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(OdysseyColor.mutedText)
                }
            }
        }
    }

    private var listView: some View {
        ScrollView {
            LazyVStack(spacing: OdysseySpacing.lg.value) {
                ForEach(filteredCards) { card in
                    CardRow(
                        card: card,
                        isExpanded: expandedCardId == card.id,
                        isSelected: selectedCards.contains(card.id),
                        onTap: {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                expandedCardId = expandedCardId == card.id ? nil : card.id
                            }
                        },
                        onSelect: {
                            if selectedCards.contains(card.id) {
                                selectedCards.remove(card.id)
                            } else {
                                selectedCards.insert(card.id)
                            }
                        }
                    )
                }
            }
            .padding(.bottom, selectedCards.isEmpty ? 0 : 100)
            .padding(.vertical, OdysseySpacing.lg.value)
            .padding(.horizontal, OdysseySpacing.lg.value)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var bulkActionsBar: some View {
        VStack {
            Spacer()

            HStack(spacing: OdysseySpacing.md.value) {
                Text("\(selectedCards.count) cards selected")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(OdysseyColor.ink)

                Spacer()

                Button {
                    // Suspend selected cards
                    selectedCards.removeAll()
                } label: {
                    Label("Suspend", systemImage: "pause.circle")
                        .font(.system(size: 13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.browseColors[8].opacity(0.15),
                        foreground: OdysseyColor.browseColors[8].opacity(0.85)
                    )
                )

                Button {
                    // Change deck
                    selectedCards.removeAll()
                } label: {
                    Label("Change Deck", systemImage: "folder")
                        .font(.system(size: 13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.browseColors[3].opacity(0.15),
                        foreground: OdysseyColor.browseColors[3]
                    )
                )

                Button {
                    // Delete selected cards
                    selectedCards.removeAll()
                } label: {
                    Label("Delete", systemImage: "trash")
                        .font(.system(size: 13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.browseColors[11].opacity(0.15),
                        foreground: OdysseyColor.browseColors[11]
                    )
                )

                Button {
                    selectedCards.removeAll()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.surfaceSubtle,
                        foreground: OdysseyColor.mutedText
                    )
                )
            }
            .padding(.horizontal, OdysseySpacing.lg.value)
            .padding(.vertical, OdysseySpacing.md.value)
            .background(
                RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                    .fill(OdysseyColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                    .stroke(OdysseyColor.border, lineWidth: 1)
            )
            .shadow(color: OdysseyColor.shadow.opacity(0.4), radius: 32, y: 20)
            .padding(.horizontal, OdysseySpacing.xl.value)
            .padding(.bottom, OdysseySpacing.lg.value)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

// MARK: - Card Row (List View)

private struct CardRow: View {
    let card: CardSummary
    let isExpanded: Bool
    let isSelected: Bool
    let onTap: () -> Void
    let onSelect: () -> Void
    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Main content
            HStack(alignment: .top, spacing: OdysseySpacing.md.value) {
                // Checkbox
                Button(action: onSelect) {
                    Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                        .font(.system(size: 18))
                        .foregroundStyle(isSelected ? OdysseyColor.accent : OdysseyColor.mutedText.opacity(0.5))
                }
                .buttonStyle(.plain)
                .opacity(isHovered || isSelected ? 1 : 0)
                .animation(.easeInOut(duration: 0.2), value: isHovered)

                // Card content
                VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
                    // Question
                    Text(card.front)
                        .font(OdysseyFont.dr(20, weight: .medium))
                        .foregroundStyle(OdysseyColor.ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.disabled)

                    // Metadata
                    ZStack(alignment: .topTrailing) {
                        HStack(alignment: .center, spacing: OdysseySpacing.sm.value) {
                            Text(card.deck)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.85))

                            Text(card.tag)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))

                            StateBadge(state: card.state)

                            Text(card.dueDateString)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.8))

                            Spacer(minLength: 0)
                        }

                        // Source chip
                        HStack(spacing: 4) {
                            Image(systemName: "link")
                                .font(.system(size: 10))
                            Text(card.source)
                                .font(.system(size: 12, weight: .medium))
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.75))
                        .padding(.horizontal, OdysseySpacing.sm.value)
                        .padding(.vertical, OdysseySpacing.xxs.value)
                        .background(
                            Capsule()
                                .fill(OdysseyColor.border.opacity(0.25))
                        )
                        .frame(maxWidth: 200, alignment: .trailing)
                    }

                    // Answer (expanded)
                    if isExpanded {
                        VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
                            Divider()
                                .padding(.vertical, OdysseySpacing.xs.value)

                            Text(card.back)
                                .font(OdysseyFont.dr(16))
                                .foregroundStyle(OdysseyColor.ink)
                                .multilineTextAlignment(.leading)
                                .textSelection(.disabled)
                        }
                        .padding(.top, OdysseySpacing.sm.value)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Expand chevron & actions
                HStack(spacing: OdysseySpacing.sm.value) {
                    if isHovered || isExpanded {
                        Button {
                            // Play card
                        } label: {
                            Image(systemName: "play.circle")
                                .font(.system(size: 18))
                                .foregroundStyle(OdysseyColor.accent)
                        }
                        .buttonStyle(.plain)
                        .transition(.opacity)

                        Button {
                            // Edit card
                        } label: {
                            Image(systemName: "square.and.pencil")
                                .font(.system(size: 18))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                        .transition(.opacity)
                    }

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(OdysseyColor.mutedText)
                }
            }
            .padding(.horizontal, OdysseySpacing.lg.value)
            .padding(.vertical, OdysseySpacing.xl.value)
        }
        .frame(minHeight: 120)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    isSelected ? OdysseyColor.accent : (isHovered ? Color(red: 255/255, green: 77/255, blue: 6/255).opacity(0.2) : Color.black.opacity(0.06)),
                    lineWidth: isSelected ? 2 : 1
                )
        )
        .shadow(color: Color.black.opacity(isHovered ? 0.08 : 0.04), radius: isHovered ? 8 : 2, y: isHovered ? 2 : 1)
        .animation(.timingCurve(0.4, 0.0, 0.2, 1, duration: 0.5), value: isHovered)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            if hovering != isHovered {
                isHovered = hovering
            }
        }
    }
}

// MARK: - State Badge

private struct StateBadge: View {
    var state: CardSummary.State

    var body: some View {
        Text(state.label)
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
            .background(state.background)
            .clipShape(Capsule())
            .foregroundStyle(state.foreground)
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
    var dueInHours: Int

    private static let dueDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    var dueDate: Date {
        Date().addingTimeInterval(TimeInterval(dueInHours) * 3600)
    }

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
        dueInHours: Int
    ) {
        self.deck = deck
        self.tag = tag ?? deck
        self.front = front
        self.back = back
        self.source = source
        self.state = state
        self.dueInHours = dueInHours
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

#Preview {
    BrowseView()
}
