import SwiftUI

struct StudyView: View {
    @State private var queue: [StudyCard] = StudyCard.samples
    @State private var currentIndex: Int = 0
    @State private var revealAnswer: Bool = false
    @State private var completedCount: Int = 0
    @State private var lastFeedback: StudyFeedback?

    private var currentCard: StudyCard? {
        guard !queue.isEmpty else { return nil }
        return queue[currentIndex]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            header
            if let card = currentCard {
                progress(for: card)
                cardSurface(for: card)
                controls
            } else {
                emptyState
            }
            Spacer()
        }
        .padding(OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(NSColor.windowBackgroundColor))
        .animation(.easeInOut(duration: 0.24), value: revealAnswer)
        .animation(.easeInOut(duration: 0.24), value: queue.count)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: OdysseySpacing.lg.value) {
            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("Today's Study")
                    .font(OdysseyFont.dr(28, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)

                Text("\(queue.count) cards scheduled · \(completedCount) completed · est. \(estimatedMinutes) min")
                    .font(OdysseyFont.dr(14))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))
            }

            Spacer()

            Button {
                shuffleQueue()
            } label: {
                Label("Shuffle", systemImage: "shuffle")
                    .font(OdysseyFont.dr(13, weight: .medium))
                    .padding(.horizontal, OdysseySpacing.md.value)
                    .padding(.vertical, OdysseySpacing.xs.value)
                    .background(
                        Capsule()
                            .fill(OdysseyColor.secondaryBackground.opacity(0.2))
                    )
            }
            .buttonStyle(.plain)

            Button {
                // TODO: Hook into backend to defer the deck.
            } label: {
                Label("Reschedule", systemImage: "calendar.badge.clock")
                    .font(OdysseyFont.dr(13, weight: .medium))
            }
            .buttonStyle(.bordered)
        }
    }

    private func progress(for card: StudyCard) -> some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xxs.value) {
            ProgressView(value: Double(currentIndex + 1), total: Double(max(queue.count, 1)))
                .tint(OdysseyColor.accent)

            HStack {
                Text("Card \(currentIndex + 1) of \(max(queue.count, 1))")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.8))
                Spacer()
                Text("Deck: \(card.deck)")
                    .font(OdysseyFont.dr(12))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.6))
            }
        }
    }

    private func cardSurface(for card: StudyCard) -> some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.md.value) {
            Text(card.front)
                .font(OdysseyFont.dr(22, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)
                .multilineTextAlignment(.leading)

            if revealAnswer {
                Divider()

                VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
                    Text(card.back)
                        .font(OdysseyFont.dr(18))
                        .foregroundStyle(OdysseyColor.secondaryText)

                    HStack(spacing: OdysseySpacing.sm.value) {
                        Label(card.source, systemImage: "link")
                            .font(OdysseyFont.dr(12))
                            .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))

                        Spacer()

                        statusBadge(for: card)
                    }
                }

                if let note = card.note {
                    Text(note)
                        .font(OdysseyFont.dr(12))
                        .foregroundStyle(OdysseyColor.secondaryText.opacity(0.65))
                        .padding(.top, OdysseySpacing.xs.value)
                }
            } else {
                Text("Tap “Show Answer” to reveal response.")
                    .font(OdysseyFont.dr(13))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.6))
            }
        }
        .padding(OdysseySpacing.lg.value)
        .frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                .fill(Color.white.opacity(0.97))
                .shadow(color: .black.opacity(0.08), radius: 26, y: 18)
        )
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
    }

    private func statusBadge(for card: StudyCard) -> some View {
        Text(card.statusLabel.uppercased())
            .font(OdysseyFont.dr(11, weight: .medium))
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
            .background(card.statusBackground)
            .clipShape(Capsule())
            .foregroundStyle(card.statusForeground)
    }

    private var controls: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            Button {
                revealAnswer.toggle()
            } label: {
                Text(revealAnswer ? "Hide Answer" : "Show Answer")
                    .font(OdysseyFont.dr(16, weight: .medium))
                    .padding(.horizontal, OdysseySpacing.xl.value)
                    .padding(.vertical, OdysseySpacing.sm.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(
                                LinearGradient(colors: [OdysseyColor.accent, OdysseyColor.secondaryBackground],
                                               startPoint: .topLeading,
                                               endPoint: .bottomTrailing)
                            )
                    )
                    .foregroundStyle(.white)
                    .shadow(color: OdysseyColor.accent.opacity(0.45), radius: 20, y: 14)
            }
            .buttonStyle(.plain)

            if let feedback = lastFeedback {
                FeedbackBanner(feedback: feedback)
            }

            if revealAnswer {
                HStack(spacing: OdysseySpacing.md.value) {
                    ForEach(StudyRating.allCases) { rating in
                        Button {
                            advance(with: rating)
                        } label: {
                            VStack(spacing: OdysseySpacing.xs.value) {
                                Text(rating.title)
                                    .font(OdysseyFont.dr(16, weight: .medium))
                                Text(rating.subtitle)
                                    .font(OdysseyFont.dr(12))
                                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.75))
                            }
                            .padding(.horizontal, OdysseySpacing.lg.value)
                            .padding(.vertical, OdysseySpacing.sm.value)
                            .background(
                                RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                                    .fill(rating.background)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .transition(.opacity)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            Text("You're up to date!")
                .font(OdysseyFont.dr(24, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("No cards are scheduled for review right now. Capture something new or browse existing cards.")
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))

            Button {
                shuffleQueue()
            } label: {
                Label("Load mock session", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
            .tint(OdysseyColor.accent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var estimatedMinutes: Int {
        max(Int(round(Double(queue.count) * 1.2)), queue.isEmpty ? 0 : 1)
    }

    private func shuffleQueue() {
        if queue.isEmpty {
            queue = StudyCard.samples
            completedCount = 0
        } else {
            queue.shuffle()
        }
        currentIndex = 0
        revealAnswer = false
        lastFeedback = nil
    }

    private func advance(with rating: StudyRating) {
        guard !queue.isEmpty else { return }

        var updated = queue
        let card = updated.remove(at: currentIndex)

        queue = updated
        completedCount += 1
        lastFeedback = card.feedback(for: rating)

        if updated.isEmpty {
            currentIndex = 0
            revealAnswer = false
            return
        }

        currentIndex = currentIndex % updated.count
        revealAnswer = false
    }
}

private enum StudyRating: CaseIterable, Identifiable {
    case again, hard, good, easy

    var id: Self { self }

    var title: String {
        switch self {
        case .again: return "Again"
        case .hard: return "Hard"
        case .good: return "Good"
        case .easy: return "Easy"
        }
    }

    var subtitle: String {
        switch self {
        case .again: return "Repeat soon"
        case .hard: return "10 min"
        case .good: return "12 hr"
        case .easy: return "4 days"
        }
    }

    var background: AnyShapeStyle {
        switch self {
        case .again:
            return AnyShapeStyle(OdysseyColor.accent.opacity(0.2))
        case .hard:
            return AnyShapeStyle(OdysseyColor.yellowAccent.opacity(0.24))
        case .good:
            return AnyShapeStyle(
                LinearGradient(
                    colors: [OdysseyColor.accent.opacity(0.22), OdysseyColor.yellowAccent.opacity(0.3)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        case .easy:
            return AnyShapeStyle(Color.green.opacity(0.28))
        }
    }
}

struct StudyCard: Identifiable {
    enum Status {
        case learning
        case review(dueDescription: String)
    }

    let id = UUID()
    var deck: String
    var front: String
    var back: String
    var source: String
    var note: String?
    var status: Status

    var statusLabel: String {
        switch status {
        case .learning:
            return "Learning"
        case .review(let due):
            return due
        }
    }

    var statusForeground: Color {
        switch status {
        case .learning:
            return OdysseyColor.secondaryText
        case .review:
            return OdysseyColor.accent
        }
    }

    var statusBackground: Color {
        switch status {
        case .learning:
            return OdysseyColor.yellowAccent.opacity(0.24)
        case .review:
            return OdysseyColor.accent.opacity(0.2)
        }
    }

    fileprivate func feedback(for rating: StudyRating) -> StudyFeedback {
        switch rating {
        case .again:
            return StudyFeedback(
                title: "Marked Again",
                detail: "This card will resurface in a few minutes.",
                accent: OdysseyColor.accent
            )
        case .hard:
            return StudyFeedback(
                title: "Marked Hard",
                detail: "Scheduled later today with a shorter interval.",
                accent: OdysseyColor.yellowAccent
            )
        case .good:
            return StudyFeedback(
                title: "Marked Good",
                detail: "Great! Expect to see it again in about half a day.",
                accent: OdysseyColor.secondaryBackground
            )
        case .easy:
            return StudyFeedback(
                title: "Marked Easy",
                detail: "Confidence logged—next review in several days.",
                accent: Color.green.opacity(0.7)
            )
        }
    }
}

extension StudyCard {
    static let samples: [StudyCard] = [
        .init(
            deck: "FSRS Fundamentals",
            front: "Define the forgetting curve in one sentence.",
            back: "The forgetting curve models how recall probability decays exponentially after learning unless refreshed by review.",
            source: "Space Repetition Fundamentals · p.42",
            note: "Mention Ebbinghaus if helpful.",
            status: .review(dueDescription: "Due now")
        ),
        .init(
            deck: "Design Systems",
            front: "List the Odyssey gradient stops used for accent surfaces.",
            back: "Top: #ED3749, Bottom: #F4742F with soft-light overlay for depth.",
            source: "Odyssey design tokens",
            note: nil,
            status: .learning
        ),
        .init(
            deck: "GPU Notes",
            front: "Why does shared memory matter for CUDA kernels?",
            back: "Shared memory enables low-latency data exchange between threads within a block, reducing global memory traffic.",
            source: "CUDA Crash Course · section 3",
            note: "Highlight 'low latency' and 'thread blocks'.",
            status: .review(dueDescription: "In 8 hr")
        )
    ]
}

private struct StudyFeedback: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let accent: Color
}

private struct FeedbackBanner: View {
    let feedback: StudyFeedback

    var body: some View {
        HStack(spacing: OdysseySpacing.sm.value) {
            Circle()
                .fill(feedback.accent)
                .frame(width: 10, height: 10)
                .shadow(color: feedback.accent.opacity(0.4), radius: 8, y: 4)

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text(feedback.title)
                    .font(OdysseyFont.dr(14, weight: .medium))
                    .foregroundStyle(OdysseyColor.ink)
                Text(feedback.detail)
                    .font(OdysseyFont.dr(12))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.75))
            }

            Spacer()
        }
        .padding(.horizontal, OdysseySpacing.lg.value)
        .padding(.vertical, OdysseySpacing.sm.value)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .fill(Color.white.opacity(0.95))
                .shadow(color: .black.opacity(0.06), radius: 18, y: 10)
        )
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

#Preview {
    StudyView()
}
