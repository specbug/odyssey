import SwiftUI

struct BrowseView: View {
    @State private var query: String = ""
    @State private var cards: [CardSummary] = CardSummary.samples
    @State private var expandedCardId: UUID? = nil
    @State private var hoveredCardId: UUID? = nil
    @State private var viewMode: ViewMode = .list
    @State private var selectedCards: Set<UUID> = []
    @State private var statusFilter: StatusFilter = .all
    @State private var sortOrder: SortOrder = .dueDate

    enum ViewMode {
        case list, grid
    }

    enum StatusFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case learning = "Learning"
        case review = "Review"
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

    var filteredCards: [CardSummary] {
        var filtered = cards

        // Apply search filter
        if !query.isEmpty {
            filtered = filtered.filter {
                $0.front.localizedCaseInsensitiveContains(query) ||
                $0.deck.localizedCaseInsensitiveContains(query) ||
                $0.source.localizedCaseInsensitiveContains(query)
            }
        }

        // Apply status filter
        if statusFilter != .all {
            filtered = filtered.filter { card in
                switch statusFilter {
                case .all: return true
                case .learning: return card.status == .learning
                case .review: return card.status == .review
                case .suspended: return card.status == .suspended
                }
            }
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

                if viewMode == .list {
                    listView
                } else {
                    gridView
                }
            }
            .padding(.horizontal, OdysseySpacing.xl.value)
            .padding(.vertical, OdysseySpacing.xl.value)
            .frame(maxWidth: 1200, alignment: .topLeading)

            // Bulk actions bar
            if !selectedCards.isEmpty {
                bulkActionsBar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Text("Browse Cards")
                .font(OdysseyFont.dr(28, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("\(filteredCards.count) cards • Click to expand and reveal answers")
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.mutedText)
        }
    }

    private var searchAndFilters: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            // Search bar with view toggle
            HStack(spacing: OdysseySpacing.sm.value) {
                // Search
                HStack(spacing: OdysseySpacing.sm.value) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.7))

                    TextField("Search question, deck, or source…", text: $query)
                        .textFieldStyle(.plain)
                        .font(OdysseyFont.dr(15))
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
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .fill(OdysseyColor.surface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .stroke(query.isEmpty ? OdysseyColor.border : OdysseyColor.accent.opacity(0.5), lineWidth: 1)
                )
                .shadow(color: OdysseyColor.shadow, radius: 16, y: 10)

                // View mode toggle
                HStack(spacing: 0) {
                    Button {
                        viewMode = .list
                    } label: {
                        Image(systemName: "list.bullet")
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.sm.value, style: .continuous)
                            .fill(viewMode == .list ? OdysseyColor.accent.opacity(0.12) : Color.clear)
                    )
                    .foregroundStyle(viewMode == .list ? OdysseyColor.accent : OdysseyColor.mutedText)

                    Button {
                        viewMode = .grid
                    } label: {
                        Image(systemName: "square.grid.2x2")
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.sm.value, style: .continuous)
                            .fill(viewMode == .grid ? OdysseyColor.accent.opacity(0.12) : Color.clear)
                    )
                    .foregroundStyle(viewMode == .grid ? OdysseyColor.accent : OdysseyColor.mutedText)
                }
                .padding(OdysseySpacing.xxs.value)
                .background(
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .fill(OdysseyColor.surface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .stroke(OdysseyColor.border, lineWidth: 1)
                )
            }

            // Filters and Sort
            HStack(spacing: OdysseySpacing.md.value) {
                // Status filter
                Menu {
                    ForEach(StatusFilter.allCases) { filter in
                        Button(filter.rawValue) {
                            statusFilter = filter
                        }
                    }
                } label: {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                        Text("Status: \(statusFilter.rawValue)")
                            .font(OdysseyFont.dr(13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: statusFilter == .all ? OdysseyColor.surfaceSubtle : OdysseyColor.accent.opacity(0.12),
                        foreground: statusFilter == .all ? OdysseyColor.mutedText : OdysseyColor.accent
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
                            .font(OdysseyFont.dr(13, weight: .medium))
                    }
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.surfaceSubtle,
                        foreground: OdysseyColor.mutedText
                    )
                )

                Spacer()

                if selectedCards.isEmpty {
                    Text("\(filteredCards.count) cards")
                        .font(OdysseyFont.dr(13, weight: .medium))
                        .foregroundStyle(OdysseyColor.mutedText)
                } else {
                    Text("\(selectedCards.count) selected")
                        .font(OdysseyFont.dr(13, weight: .medium))
                        .foregroundStyle(OdysseyColor.accent)
                }
            }
        }
    }

    private var listView: some View {
        ScrollView {
            VStack(spacing: OdysseySpacing.md.value) {
                ForEach(filteredCards) { card in
                    CardRow(
                        card: card,
                        isExpanded: expandedCardId == card.id,
                        isHovered: hoveredCardId == card.id,
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
                    .onHover { hovering in
                        hoveredCardId = hovering ? card.id : nil
                    }
                }
            }
        }
    }

    private var gridView: some View {
        ScrollView {
            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 320, maximum: 400), spacing: OdysseySpacing.lg.value)
                ],
                spacing: OdysseySpacing.lg.value
            ) {
                ForEach(filteredCards) { card in
                    CardGridItem(
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
        }
    }

    private var bulkActionsBar: some View {
        VStack {
            Spacer()

            HStack(spacing: OdysseySpacing.md.value) {
                Text("\(selectedCards.count) cards selected")
                    .font(OdysseyFont.dr(14, weight: .medium))
                    .foregroundStyle(OdysseyColor.ink)

                Spacer()

                Button {
                    // Suspend selected cards
                    selectedCards.removeAll()
                } label: {
                    Label("Suspend", systemImage: "pause.circle")
                        .font(OdysseyFont.dr(13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.surfaceSubtle,
                        foreground: OdysseyColor.mutedText
                    )
                )

                Button {
                    // Change deck
                    selectedCards.removeAll()
                } label: {
                    Label("Change Deck", systemImage: "folder")
                        .font(OdysseyFont.dr(13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.accent.opacity(0.12),
                        foreground: OdysseyColor.accent
                    )
                )

                Button {
                    // Delete selected cards
                    selectedCards.removeAll()
                } label: {
                    Label("Delete", systemImage: "trash")
                        .font(OdysseyFont.dr(13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.destructive.opacity(0.12),
                        foreground: OdysseyColor.destructive
                    )
                )

                Button {
                    selectedCards.removeAll()
                } label: {
                    Text("Cancel")
                        .font(OdysseyFont.dr(13, weight: .medium))
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
    let isHovered: Bool
    let isSelected: Bool
    let onTap: () -> Void
    let onSelect: () -> Void

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
                        .font(OdysseyFont.dr(18, weight: .semibold))
                        .foregroundStyle(OdysseyColor.ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    // Metadata
                    HStack(spacing: OdysseySpacing.sm.value) {
                        // Deck badge
                        Text(card.deck)
                            .font(OdysseyFont.dr(12, weight: .medium))
                            .foregroundStyle(OdysseyColor.mutedText)
                            .padding(.horizontal, OdysseySpacing.sm.value)
                            .padding(.vertical, OdysseySpacing.xxs.value)
                            .background(
                                Capsule()
                                    .fill(OdysseyColor.surfaceSubtle)
                            )

                        // Status badge
                        StatusBadge(status: card.status)

                        // Due date
                        Text(card.dueDescription)
                            .font(OdysseyFont.dr(12, weight: .medium))
                            .foregroundStyle(card.dueColor)

                        Spacer()

                        // Source (on hover)
                        if isHovered {
                            Label(card.source, systemImage: "link")
                                .font(OdysseyFont.dr(12))
                                .foregroundStyle(OdysseyColor.mutedText)
                                .transition(.opacity)
                        }
                    }

                    // Answer (expanded)
                    if isExpanded {
                        VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
                            Divider()
                                .padding(.vertical, OdysseySpacing.xs.value)

                            Text("Answer")
                                .font(OdysseyFont.dr(12, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText)
                                .textCase(.uppercase)

                            Text(card.back)
                                .font(OdysseyFont.dr(16))
                                .foregroundStyle(OdysseyColor.ink)
                                .multilineTextAlignment(.leading)

                            Label(card.source, systemImage: "link")
                                .font(OdysseyFont.dr(12))
                                .foregroundStyle(OdysseyColor.mutedText)
                        }
                        .padding(.top, OdysseySpacing.sm.value)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Expand chevron & actions
                HStack(spacing: OdysseySpacing.sm.value) {
                    if isHovered && !isExpanded {
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
                            Image(systemName: "pencil.circle")
                                .font(.system(size: 18))
                                .foregroundStyle(OdysseyColor.mutedText)
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
            .padding(.vertical, OdysseySpacing.lg.value)
        }
        .frame(minHeight: 100)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .stroke(
                    isSelected ? OdysseyColor.accent : (isHovered ? OdysseyColor.border.opacity(1) : OdysseyColor.border.opacity(0.6)),
                    lineWidth: isSelected ? 2 : 1
                )
        )
        .shadow(color: OdysseyColor.shadow.opacity(isHovered ? 0.15 : 0.08), radius: isHovered ? 20 : 12, y: isHovered ? 12 : 8)
        .scaleEffect(isHovered ? 1.005 : 1)
        .animation(.easeInOut(duration: 0.2), value: isHovered)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

// MARK: - Card Grid Item

private struct CardGridItem: View {
    let card: CardSummary
    let isExpanded: Bool
    let isSelected: Bool
    let onTap: () -> Void
    let onSelect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.md.value) {
            // Header
            HStack {
                Text(card.deck)
                    .font(OdysseyFont.dr(11, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                    .textCase(.uppercase)

                Spacer()

                Button(action: onSelect) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 16))
                        .foregroundStyle(isSelected ? OdysseyColor.accent : OdysseyColor.mutedText.opacity(0.4))
                }
                .buttonStyle(.plain)
            }

            // Question
            Text(card.front)
                .font(OdysseyFont.dr(16, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)
                .lineLimit(isExpanded ? nil : 3)
                .multilineTextAlignment(.leading)

            // Answer (if expanded)
            if isExpanded {
                Divider()

                Text("Answer")
                    .font(OdysseyFont.dr(11, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                    .textCase(.uppercase)

                Text(card.back)
                    .font(OdysseyFont.dr(14))
                    .foregroundStyle(OdysseyColor.ink)
                    .lineLimit(4)
                    .multilineTextAlignment(.leading)
            }

            Spacer()

            // Footer
            HStack {
                StatusBadge(status: card.status)
                Spacer()
                Text(card.dueDescription)
                    .font(OdysseyFont.dr(11, weight: .medium))
                    .foregroundStyle(card.dueColor)
            }
        }
        .padding(OdysseySpacing.md.value)
        .frame(minHeight: 240)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .stroke(isSelected ? OdysseyColor.accent : OdysseyColor.border, lineWidth: isSelected ? 2 : 1)
        )
        .shadow(color: OdysseyColor.shadow, radius: 12, y: 8)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

// MARK: - Status Badge

private struct StatusBadge: View {
    var status: CardSummary.Status

    var body: some View {
        Text(status.label.uppercased())
            .font(OdysseyFont.dr(10, weight: .medium))
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
            .background(status.background)
            .clipShape(Capsule())
            .foregroundStyle(status.foreground)
    }
}

// MARK: - Card Summary Model

struct CardSummary: Identifiable, Hashable {
    enum Status {
        case learning, review, suspended

        var label: String {
            switch self {
            case .learning: return "Learning"
            case .review: return "Review"
            case .suspended: return "Suspended"
            }
        }

        var foreground: Color {
            switch self {
            case .learning: return OdysseyColor.secondaryText
            case .review: return OdysseyColor.accent
            case .suspended: return Color.gray.opacity(0.8)
            }
        }

        var background: Color {
            switch self {
            case .learning: return OdysseyColor.yellowAccent.opacity(0.18)
            case .review: return OdysseyColor.accent.opacity(0.16)
            case .suspended: return Color.gray.opacity(0.16)
            }
        }
    }

    let id = UUID()
    var deck: String
    var front: String
    var back: String
    var source: String
    var status: Status
    var dueInHours: Int

    var dueDescription: String {
        switch dueInHours {
        case ..<0:
            return "Overdue"
        case 0...1:
            return "Due now"
        case 2..<24:
            return "In \(dueInHours)h"
        default:
            let days = dueInHours / 24
            return "In \(days)d"
        }
    }

    var dueColor: Color {
        switch dueInHours {
        case ..<0:
            return OdysseyColor.accent
        case 0...1:
            return OdysseyColor.secondaryText
        default:
            return Color.green.opacity(0.8)
        }
    }
}

extension CardSummary {
    static let samples: [CardSummary] = [
        .init(
            deck: "FSRS Fundamentals",
            front: "What is the retention benefit of spaced repetition?",
            back: "Spaced repetition optimizes review intervals to keep recall near 90% while minimizing total study time.",
            source: "Excerpt • Space Repetition Fundamentals",
            status: .review,
            dueInHours: -5
        ),
        .init(
            deck: "Design Systems",
            front: "List the core Orbit color tokens used by Odyssey.",
            back: "Ink, Accent, Background, Secondary Background, Secondary Text, Yellow Accent.",
            source: "Odyssey design tokens",
            status: .learning,
            dueInHours: 4
        ),
        .init(
            deck: "Neural Nets",
            front: "What is the significance of the attention mechanism?",
            back: "Attention lets models focus on relevant tokens dynamically, improving long-range dependency modeling.",
            source: "Arxiv 2404.15824",
            status: .review,
            dueInHours: 28
        ),
        .init(
            deck: "Mindset",
            front: "State the Feynman technique in one sentence.",
            back: "Explain a concept in simple terms as if teaching a child to expose gaps in understanding.",
            source: "Personal notes",
            status: .suspended,
            dueInHours: 0
        )
    ]
}

#Preview {
    BrowseView()
}
