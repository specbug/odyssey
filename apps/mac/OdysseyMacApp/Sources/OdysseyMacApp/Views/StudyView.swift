import SwiftUI

struct StudyView: View {
    @State private var queue: [StudyCard] = StudyCard.samples
    @State private var currentIndex: Int = 0
    @State private var revealAnswer: Bool = false
    @State private var completedCount: Int = 0
    @State private var lastFeedback: StudyFeedback?
    @State private var rescheduleDate: Date = Calendar.current.date(byAdding: .hour, value: 12, to: Date()) ?? Date()
    @State private var isReschedulePresented: Bool = false
    @State private var editingCard: StudyCard?

    private var currentCard: StudyCard? {
        guard !queue.isEmpty else { return nil }
        return queue[currentIndex]
    }

    var body: some View {
        ZStack(alignment: .top) {
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
                header(for: currentCard)

                if let card = currentCard {
                    progress(for: card)
                    cardSurface(for: card)
                    reviewControls(for: card)
                } else {
                    emptyState
                }

                Spacer()
            }
            .padding(.horizontal, OdysseySpacing.xl.value)
            .padding(.vertical, OdysseySpacing.xl.value)
            .frame(maxWidth: 960, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.easeInOut(duration: 0.24), value: revealAnswer)
        .animation(.easeInOut(duration: 0.24), value: queue.count)
        .sheet(item: $editingCard) { card in
            StudyCardEditor(card: card)
        }
    }

    private func header(for card: StudyCard?) -> some View {
        HStack(alignment: .center, spacing: OdysseySpacing.lg.value) {
            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("Today's Study")
                    .font(OdysseyFont.dr(28, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)

                Text(summaryLine)
                    .font(OdysseyFont.dr(14))
                    .foregroundStyle(OdysseyColor.mutedText)
            }

            Spacer()

            HStack(spacing: OdysseySpacing.sm.value) {
                Button {
                    if let card {
                        editingCard = card
                    }
                } label: {
                    Label("View Card", systemImage: "doc.text.magnifyingglass")
                        .font(OdysseyFont.dr(13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.surfaceSubtle,
                        foreground: OdysseyColor.mutedText
                    )
                )
                .disabled(card == nil)
                .opacity(card == nil ? 0.4 : 1)

                Button {
                    if card != nil {
                        isReschedulePresented.toggle()
                    }
                } label: {
                    Label("Reschedule", systemImage: "calendar.badge.clock")
                        .font(OdysseyFont.dr(13, weight: .medium))
                }
                .buttonStyle(
                    OdysseyPillButtonStyle(
                        background: OdysseyColor.accent.opacity(0.12),
                        foreground: OdysseyColor.accent
                    )
                )
                .disabled(card == nil)
                .opacity(card == nil ? 0.4 : 1)
                .popover(isPresented: $isReschedulePresented, arrowEdge: .top) {
                    reschedulePopover
                }
            }
        }
    }

    private var summaryLine: String {
        let remaining = queue.count
        let estimate = estimatedMinutes
        return "\(remaining) cards scheduled · \(completedCount) completed · est. \(estimate) min"
    }

    private var reschedulePopover: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.md.value) {
            Text("Reschedule Review")
                .font(OdysseyFont.dr(16, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Pick a new reminder time for this card.")
                .font(OdysseyFont.dr(13))
                .foregroundStyle(OdysseyColor.mutedText)

            DatePicker(
                "Next review",
                selection: $rescheduleDate,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.field)

            Button("Save") {
                isReschedulePresented = false
            }
            .buttonStyle(OdysseyPrimaryButtonStyle(cornerRadius: OdysseyRadius.sm.value))
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(OdysseySpacing.lg.value)
        .frame(width: 280)
    }

    private func progress(for card: StudyCard) -> some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            ProgressView(value: Double(currentIndex + 1), total: Double(max(queue.count, 1)))
                .tint(OdysseyColor.accent)

            HStack {
                Text("Card \(currentIndex + 1) of \(max(queue.count, 1))")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                Spacer()
                Text(card.deck)
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                    .padding(.horizontal, OdysseySpacing.sm.value)
                    .padding(.vertical, OdysseySpacing.xxs.value)
                    .background(
                        Capsule()
                            .fill(OdysseyColor.surfaceSubtle)
                    )
            }
        }
    }

    private func cardSurface(for card: StudyCard) -> some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.md.value) {
            HStack(alignment: .center) {
                Text(card.deck.uppercased())
                    .font(OdysseyFont.dr(11, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                Spacer()
                statusBadge(for: card)
            }

            Text(card.front)
                .font(OdysseyFont.dr(22, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)
                .multilineTextAlignment(.leading)

            if revealAnswer {
                Divider()

                VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
                    Text(card.back)
                        .font(OdysseyFont.dr(18))
                        .foregroundStyle(OdysseyColor.ink)

                    Label(card.source, systemImage: "link")
                        .font(OdysseyFont.dr(12))
                        .foregroundStyle(OdysseyColor.mutedText)

                    if let note = card.note, !note.isEmpty {
                        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                            Text("Note")
                                .font(OdysseyFont.dr(12, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText)
                            Text(note)
                                .font(OdysseyFont.dr(13))
                                .foregroundStyle(OdysseyColor.mutedText)
                        }
                        .padding(.top, OdysseySpacing.xs.value)
                    }
                }
            } else {
                Text("Flip to reveal the answer when you're ready.")
                    .font(OdysseyFont.dr(13))
                    .foregroundStyle(OdysseyColor.mutedText)
            }
        }
        .padding(OdysseySpacing.lg.value)
        .frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                .stroke(OdysseyColor.border, lineWidth: 1)
        )
        .shadow(color: OdysseyColor.shadow, radius: 26, y: 18)
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

    private func reviewControls(for card: StudyCard) -> some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    revealAnswer.toggle()
                }
            } label: {
                HStack {
                    Spacer()
                    Text(revealAnswer ? "Hide Answer" : "Show Answer")
                        .font(OdysseyFont.dr(16, weight: .medium))
                    Spacer()
                }
            }
            .buttonStyle(OdysseyPrimaryButtonStyle())
            .frame(maxWidth: 280)

            if let feedback = lastFeedback {
                FeedbackBanner(feedback: feedback)
            }

            if revealAnswer {
                ratingButtons
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
    }

    private var ratingButtons: some View {
        HStack(spacing: OdysseySpacing.md.value) {
            ForEach(StudyRating.allCases) { rating in
                Button {
                    advance(with: rating)
                } label: {
                    VStack(spacing: OdysseySpacing.xs.value) {
                        Text(rating.title)
                            .font(OdysseyFont.dr(16, weight: .medium))
                            .foregroundStyle(rating.foreground)
                        Text(rating.subtitle)
                            .font(OdysseyFont.dr(12))
                            .foregroundStyle(OdysseyColor.mutedText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, OdysseySpacing.sm.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(rating.background)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(rating.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
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
                .foregroundStyle(OdysseyColor.mutedText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)

            Button {
                reloadSamples()
            } label: {
                Label("Load sample session", systemImage: "arrow.clockwise")
                    .font(OdysseyFont.dr(13, weight: .medium))
            }
            .buttonStyle(
                OdysseyPillButtonStyle(
                    background: OdysseyColor.surfaceSubtle,
                    foreground: OdysseyColor.mutedText
                )
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private var estimatedMinutes: Int {
        max(Int(round(Double(queue.count) * 1.1)), queue.isEmpty ? 0 : 1)
    }

    private func reloadSamples() {
        queue = StudyCard.samples
        currentIndex = 0
        completedCount = 0
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
        case .hard: return "Later today"
        case .good: return "Tomorrow"
        case .easy: return "In a few days"
        }
    }

    var background: Color {
        switch self {
        case .again:
            return OdysseyColor.accent.opacity(0.14)
        case .hard:
            return OdysseyColor.yellowAccent.opacity(0.18)
        case .good:
            return Color(red: 0.84, green: 0.93, blue: 0.86)
        case .easy:
            return Color(red: 0.85, green: 0.9, blue: 0.97)
        }
    }

    var border: Color {
        switch self {
        case .again:
            return OdysseyColor.accent.opacity(0.35)
        case .hard:
            return OdysseyColor.yellowAccent.opacity(0.35)
        case .good:
            return Color(red: 0.63, green: 0.8, blue: 0.66)
        case .easy:
            return Color(red: 0.58, green: 0.72, blue: 0.89)
        }
    }

    var foreground: Color {
        switch self {
        case .again:
            return OdysseyColor.accent
        case .hard:
            return OdysseyColor.secondaryText
        case .good:
            return Color(red: 0.27, green: 0.56, blue: 0.36)
        case .easy:
            return Color(red: 0.24, green: 0.44, blue: 0.71)
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
            return OdysseyColor.yellowAccent.opacity(0.22)
        case .review:
            return OdysseyColor.accent.opacity(0.16)
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
                detail: "Expect to see it again tomorrow.",
                accent: Color(red: 0.27, green: 0.56, blue: 0.36)
            )
        case .easy:
            return StudyFeedback(
                title: "Marked Easy",
                detail: "Confidence logged—next review in several days.",
                accent: Color(red: 0.24, green: 0.44, blue: 0.71)
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
            front: "List the core Odyssey design tokens used across surfaces.",
            back: "Canvas, Surface, Surface Subtle, Border, Ink, Accent, Muted Text.",
            source: "Odyssey design tokens",
            note: nil,
            status: .learning
        ),
        .init(
            deck: "GPU Notes",
            front: "Why does shared memory matter for CUDA kernels?",
            back: "Shared memory enables low-latency data exchange between threads in a block, reducing expensive global memory access.",
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
        HStack(spacing: OdysseySpacing.md.value) {
            Circle()
                .fill(feedback.accent)
                .frame(width: 12, height: 12)

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text(feedback.title)
                    .font(OdysseyFont.dr(14, weight: .medium))
                    .foregroundStyle(OdysseyColor.ink)
                Text(feedback.detail)
                    .font(OdysseyFont.dr(12))
                    .foregroundStyle(OdysseyColor.mutedText)
            }

            Spacer()
        }
        .padding(.horizontal, OdysseySpacing.lg.value)
        .padding(.vertical, OdysseySpacing.sm.value)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                .stroke(OdysseyColor.border, lineWidth: 1)
        )
        .shadow(color: OdysseyColor.shadow, radius: 18, y: 12)
    }
}

private struct StudyCardEditor: View {
    @Environment(\.dismiss) private var dismiss

    var card: StudyCard
    @State private var front: String
    @State private var back: String
    @State private var note: String

    init(card: StudyCard) {
        self.card = card
        _front = State(initialValue: card.front)
        _back = State(initialValue: card.back)
        _note = State(initialValue: card.note ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            Text("Edit Card")
                .font(OdysseyFont.dr(20, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Make quick edits to the prompt or answer, then copy them into Capture to persist changes.")
                .font(OdysseyFont.dr(13))
                .foregroundStyle(OdysseyColor.mutedText)

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("Question")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                TextEditor(text: $front)
                    .font(OdysseyFont.dr(14))
                    .padding(OdysseySpacing.md.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(OdysseyColor.surfaceSubtle)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )
                    .frame(minHeight: 120)
                    .scrollContentBackground(.hidden)
            }

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("Answer")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                TextEditor(text: $back)
                    .font(OdysseyFont.dr(14))
                    .padding(OdysseySpacing.md.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(OdysseyColor.surfaceSubtle)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )
                    .frame(minHeight: 160)
                    .scrollContentBackground(.hidden)
            }

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("Notes")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
                TextEditor(text: $note)
                    .font(OdysseyFont.dr(14))
                    .padding(OdysseySpacing.md.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(OdysseyColor.surfaceSubtle)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )
                    .frame(minHeight: 100)
                    .scrollContentBackground(.hidden)
            }

            HStack {
                Spacer()
                Button("Done") {
                    dismiss()
                }
                .buttonStyle(OdysseyPrimaryButtonStyle())
            }
        }
        .padding(OdysseySpacing.xl.value)
        .frame(minWidth: 540, minHeight: 620)
        .background(OdysseyColor.surface)
    }
}

#Preview {
    StudyView()
}
