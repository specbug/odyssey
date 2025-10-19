import SwiftUI

struct BrowseView: View {
    @State private var query: String = ""
    @State private var cards: [CardSummary] = CardSummary.samples
    @State private var expandedCardId: UUID? = nil
    @State private var hoveredCardId: UUID? = nil
    @State private var selectedCards: Set<UUID> = []
    @State private var statusFilter: StatusFilter = .all
    @State private var sortOrder: SortOrder = .dueDate

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
                listView
            }
            .padding(.horizontal, 48)
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
        Text("Browse Cards")
            .font(OdysseyFont.dr(28, weight: .semibold))
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

                if !selectedCards.isEmpty {
                    Text("\(selectedCards.count) selected")
                        .font(OdysseyFont.dr(13, weight: .medium))
                        .foregroundStyle(OdysseyColor.accent)
                } else {
                    Text("\(filteredCards.count) cards")
                        .font(OdysseyFont.dr(13, weight: .medium))
                        .foregroundStyle(OdysseyColor.mutedText)
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
            .padding(.bottom, selectedCards.isEmpty ? 0 : 100)
        }
        .scrollBounceBehavior(.basedOnSize)
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
                        background: OdysseyColor.browseColors[9].opacity(0.15),
                        foreground: OdysseyColor.browseColors[9]
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
                        background: OdysseyColor.browseColors[3].opacity(0.15),
                        foreground: OdysseyColor.browseColors[3]
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
                        background: OdysseyColor.browseColors[11].opacity(0.15),
                        foreground: OdysseyColor.browseColors[11]
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
                        .textSelection(.disabled)

                    // Metadata
                    HStack(spacing: OdysseySpacing.sm.value) {
                        // Deck (plain text)
                        Text(card.deck)
                            .font(OdysseyFont.dr(12, weight: .medium))
                            .foregroundStyle(OdysseyColor.mutedText)

                        // Status (plain text)
                        Text(card.status.label)
                            .font(OdysseyFont.dr(12, weight: .medium))
                            .foregroundStyle(OdysseyColor.mutedText.opacity(0.8))

                        // Due date (plain text)
                        Text(card.dueDescription)
                            .font(OdysseyFont.dr(12, weight: .medium))
                            .foregroundStyle(OdysseyColor.mutedText.opacity(0.8))

                        Spacer()

                        // Source chip (always visible on hover)
                        HStack(spacing: 4) {
                            Image(systemName: "link")
                                .font(.system(size: 10))
                            Text(card.source)
                                .font(OdysseyFont.dr(11, weight: .medium))
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        .foregroundStyle(OdysseyColor.mutedText)
                        .padding(.horizontal, OdysseySpacing.sm.value)
                        .padding(.vertical, OdysseySpacing.xxs.value)
                        .background(
                            Capsule()
                                .fill(OdysseyColor.surfaceSubtle)
                        )
                        .frame(maxWidth: 200)
                        .opacity(isHovered ? 1 : 0)
                        .animation(.timingCurve(0.4, 0.0, 0.2, 1, duration: 0.5), value: isHovered)
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
                                .textSelection(.disabled)
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
            return .white
        }

        var background: Color {
            switch self {
            case .learning: return OdysseyColor.browseColors[8] // Yellow
            case .review: return OdysseyColor.browseColors[11] // Red
            case .suspended: return Color.gray.opacity(0.6)
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
            return OdysseyColor.browseColors[11] // Red for overdue
        case 0...1:
            return OdysseyColor.browseColors[8] // Yellow for due now
        default:
            return OdysseyColor.browseColors[6] // Green for future
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
        ),
        .init(
            deck: "Machine Learning",
            front: "Explain the mathematical derivation of backpropagation through a multi-layer perceptron, including the role of the chain rule and how gradients flow through non-linear activation functions. How does this relate to vanishing and exploding gradient problems?",
            back: """
            Backpropagation computes gradients by applying the chain rule recursively from output to input layers. Consider a simple MLP with layers L₁, L₂, ..., Lₙ.

            For each layer l, we compute ∂L/∂Wₗ where L is the loss function. Using the chain rule:
            ∂L/∂Wₗ = ∂L/∂aₗ × ∂aₗ/∂zₗ × ∂zₗ/∂Wₗ

            where aₗ is the activation output and zₗ is the pre-activation (weighted sum). The gradient flows backward through each layer, multiplying by the local gradients of activations like σ'(z) for sigmoid or ReLU'(z).

            [See Figure 3.2 for gradient flow diagram]

            The vanishing gradient problem occurs when |∂aₗ/∂zₗ| < 1 repeatedly, causing gradients to exponentially decay as they propagate backward. This is particularly severe with sigmoid activations where σ'(z) ∈ (0, 0.25]. Conversely, exploding gradients occur when products exceed 1, leading to numerical instability.

            Modern solutions include:
            • ReLU and variants (Leaky ReLU, ELU) with better gradient properties
            • Batch normalization to maintain stable activation statistics
            • Residual connections (ResNets) providing gradient highways
            • Careful weight initialization (Xavier, He initialization)

            [LaTeX formula for gradient computation shown in equation 4.7]
            """,
            source: "Deep Learning • Goodfellow et al. Chapter 6",
            status: .learning,
            dueInHours: 2
        ),
        .init(
            deck: "Algorithms",
            front: "What is the time complexity of the merge sort algorithm?",
            back: "O(n log n) in all cases - best, average, and worst case. The algorithm divides the array into halves recursively (log n levels) and merges them (n operations per level).",
            source: "CLRS Chapter 2",
            status: .review,
            dueInHours: 48
        ),
        .init(
            deck: "Quantum Computing",
            front: "Explain quantum entanglement and its role in quantum computing.",
            back: "Quantum entanglement is a phenomenon where two or more qubits become correlated such that the state of one cannot be described independently of the others, even when separated by large distances. In quantum computing, entanglement enables quantum parallelism and is essential for algorithms like Shor's and quantum error correction.",
            source: "Nielsen & Chuang • Quantum Computation and Quantum Information",
            status: .learning,
            dueInHours: 6
        ),
        .init(
            deck: "System Design",
            front: "How would you design a URL shortener like bit.ly?",
            back: "Key components: 1) Hashing service to generate short codes (base62 encoding of auto-increment ID or hash collision handling), 2) Database (key-value store) mapping short codes to original URLs, 3) Redirection service (301/302), 4) Rate limiting, 5) Analytics tracking, 6) CDN for global distribution. Consider sharding strategy for scale.",
            source: "System Design Interview Vol 1 • Chapter 8",
            status: .suspended,
            dueInHours: 0
        ),
        .init(
            deck: "Databases",
            front: "What is database normalization and why is it important?",
            back: "Normalization is the process of organizing data to minimize redundancy and dependency. It involves dividing large tables into smaller ones and defining relationships. Benefits include reduced data redundancy, improved data integrity, easier maintenance, and more efficient queries.",
            source: "Database Systems Concepts • Chapter 7",
            status: .review,
            dueInHours: 72
        ),
        .init(
            deck: "Computer Networks",
            front: "Explain the TCP three-way handshake.",
            back: "1) SYN: Client sends SYN packet with initial sequence number to server. 2) SYN-ACK: Server responds with SYN-ACK, acknowledging client's sequence number and sending its own. 3) ACK: Client sends ACK to server. Connection established. This ensures both sides are ready to transmit data and agree on initial sequence numbers.",
            source: "Computer Networking: A Top-Down Approach • Chapter 3",
            status: .learning,
            dueInHours: 1
        ),
        .init(
            deck: "Cryptography",
            front: "What is the difference between symmetric and asymmetric encryption?",
            back: "Symmetric encryption uses the same key for encryption and decryption (e.g., AES). It's fast but requires secure key exchange. Asymmetric encryption uses a public-private key pair (e.g., RSA). Public key encrypts, private key decrypts. Slower but solves key distribution problem. Often used together: asymmetric for key exchange, symmetric for data.",
            source: "Applied Cryptography • Schneier • Chapter 2",
            status: .review,
            dueInHours: -2
        ),
        .init(
            deck: "Programming Languages",
            front: "What is the difference between a compiler and an interpreter?",
            back: "A compiler translates entire source code to machine code before execution (e.g., C, C++). Results in faster execution but longer initial compilation. An interpreter executes code line-by-line at runtime (e.g., Python, JavaScript). Slower execution but faster development cycle. JIT compilers combine both approaches.",
            source: "Compilers: Principles, Techniques, and Tools • Chapter 1",
            status: .review,
            dueInHours: 24
        ),
        .init(
            deck: "Operating Systems",
            front: "Explain the difference between a process and a thread.",
            back: "A process is an independent program in execution with its own memory space. A thread is a lightweight unit of execution within a process, sharing the process's memory space. Multiple threads in a process can run concurrently, enabling parallelism. Threads are cheaper to create and context switch than processes.",
            source: "Operating System Concepts • Silberschatz • Chapter 4",
            status: .learning,
            dueInHours: 12
        )
    ]
}

// MARK: - Color Helpers

private extension String {
    func browseColor() -> Color {
        let hash = abs(self.hashValue)
        return OdysseyColor.browseColors[hash % OdysseyColor.browseColors.count]
    }

    func browseForegroundColor() -> Color {
        // Use white text for better contrast with vibrant colors
        return .white
    }
}

#Preview {
    BrowseView()
}
