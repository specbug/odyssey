import SwiftUI

struct BrowseView: View {
    @State private var query: String = ""
    @State private var cards: [CardSummary] = CardSummary.samples
    @State private var sortOrder: [KeyPathComparator<CardSummary>] = [
        .init(\.deck, order: .forward)
    ]

    var filteredCards: [CardSummary] {
        guard !query.isEmpty else { return cards }
        return cards.filter {
            $0.front.localizedCaseInsensitiveContains(query) ||
            $0.back.localizedCaseInsensitiveContains(query) ||
            $0.deck.localizedCaseInsensitiveContains(query) ||
            $0.source.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            header
            searchBar
            table
        }
        .padding(OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(NSColor.windowBackgroundColor))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Text("Browse Cards")
                .font(OdysseyFont.dr(28, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Manage every card in Odyssey. Filter, edit, or review directly from here.")
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))
        }
    }

    private var searchBar: some View {
        HStack(spacing: OdysseySpacing.sm.value) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.6))

            TextField("Search question, answer, deck, or source…", text: $query)
                .textFieldStyle(.plain)
                .font(OdysseyFont.dr(14))
                .autocorrectionDisabled()

            Spacer()

            Button {
                // TODO: Trigger bulk actions (suspend, tag, etc.)
            } label: {
                Label("Actions", systemImage: "slider.horizontal.3")
                    .labelStyle(.titleAndIcon)
                    .font(OdysseyFont.dr(13, weight: .medium))
            }
            .buttonStyle(.borderedProminent)
            .tint(OdysseyColor.accent)
        }
        .padding(.horizontal, OdysseySpacing.md.value)
        .padding(.vertical, OdysseySpacing.sm.value)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .fill(Color.white.opacity(0.96))
                .shadow(color: .black.opacity(0.05), radius: 18, y: 8)
        )
    }

    private var table: some View {
        Table(filteredCards, sortOrder: $sortOrder) {
            TableColumn("Deck", value: \.deck)
                .width(min: 120, ideal: 160)
            TableColumn("Question") { card in
                VStack(alignment: .leading, spacing: OdysseySpacing.xxs.value) {
                    Text(card.front)
                        .font(OdysseyFont.dr(14, weight: .medium))
                        .lineLimit(2)
                    Text(card.source)
                        .font(OdysseyFont.dr(11))
                        .foregroundStyle(OdysseyColor.secondaryText.opacity(0.6))
                }
            }
            .width(min: 220, ideal: 280)

            TableColumn("Answer") { card in
                Text(card.back)
                    .font(OdysseyFont.dr(13))
                    .foregroundStyle(OdysseyColor.secondaryText)
                    .lineLimit(2)
            }
            .width(min: 240, ideal: 300)

            TableColumn("Status") { card in
                StatusBadge(status: card.status)
            }
            .width(min: 120, ideal: 140)

            TableColumn("Due") { card in
                Text(card.dueDescription)
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(card.dueColor)
            }
            .width(min: 80)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                .fill(Color.white.opacity(0.95))
                .shadow(color: .black.opacity(0.08), radius: 20, y: 12)
        )
    }
}

private struct StatusBadge: View {
    var status: CardSummary.Status

    var body: some View {
        Text(status.label.uppercased())
            .font(OdysseyFont.dr(11, weight: .medium))
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
            .background(status.background)
            .clipShape(Capsule())
            .foregroundStyle(status.foreground)
    }
}

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
            case .suspended: return Color.gray
            }
        }

        var background: Color {
            switch self {
            case .learning: return OdysseyColor.yellowAccent.opacity(0.25)
            case .review: return OdysseyColor.accent.opacity(0.2)
            case .suspended: return Color.gray.opacity(0.2)
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
