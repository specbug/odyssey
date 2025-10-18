import SwiftUI

struct ReviewDeskView: View {
    @EnvironmentObject private var appState: AppState
    @State private var session: ReviewSession = .placeholder

    var body: some View {
        VStack(spacing: OdysseySpacing.lg.value) {
            Header(title: "Review Desk", subtitle: "\(session.dueCount) cards waiting")

            VStack(spacing: OdysseySpacing.md.value) {
                Text(session.currentPrompt)
                    .font(OdysseyFont.dr(22, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
                    .multilineTextAlignment(.leading)

                Text(session.context)
                    .font(OdysseyFont.dr(15))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.8))

                Divider()

                HStack(spacing: OdysseySpacing.md.value) {
                    ForEach(ReviewRating.allCases) { rating in
                        Button {
                            rate(rating)
                        } label: {
                            VStack(spacing: OdysseySpacing.xs.value) {
                                Text(rating.title)
                                    .font(OdysseyFont.dr(16, weight: .medium))
                                Text(rating.subtitle)
                                    .font(OdysseyFont.dr(12))
                                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))
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
            }
            .padding(OdysseySpacing.lg.value)
            .frame(maxWidth: 620)
            .background(
                RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                    .fill(Color.white.opacity(0.96))
                    .shadow(color: .black.opacity(0.1), radius: 24, y: 18)
            )

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.top, OdysseySpacing.xl.value)
        .background(Color(NSColor.windowBackgroundColor))
    }

    private func rate(_ rating: ReviewRating) {
        // TODO: Send rating to backend and advance session.
    }
}

private struct Header: View {
    var title: String
    var subtitle: String

    var body: some View {
        VStack(spacing: OdysseySpacing.xs.value) {
            Text(title)
                .font(OdysseyFont.dr(26, weight: .semibold))
            Text(subtitle)
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))
        }
        .padding(.bottom, OdysseySpacing.md.value)
    }
}

private struct ReviewSession {
    var dueCount: Int
    var currentPrompt: String
    var context: String

    static let placeholder = ReviewSession(
        dueCount: 5,
        currentPrompt: "What is the retention benefit of spaced repetition?",
        context: "Excerpt from \"Space Repetition Fundamentals\""
    )
}

private enum ReviewRating: CaseIterable, Identifiable {
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
        case .hard: return "3 min"
        case .good: return "12 hr"
        case .easy: return "4 days"
        }
    }

    var background: AnyShapeStyle {
        switch self {
        case .again:
            AnyShapeStyle(OdysseyColor.accent.opacity(0.18))
        case .hard:
            AnyShapeStyle(OdysseyColor.yellowAccent.opacity(0.2))
        case .good:
            AnyShapeStyle(
                LinearGradient(
                    colors: [OdysseyColor.accent.opacity(0.2), OdysseyColor.yellowAccent.opacity(0.3)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
        case .easy:
            AnyShapeStyle(OdysseyColor.secondaryBackground.opacity(0.2))
        }
    }
}

#Preview {
    ReviewDeskView()
        .environmentObject(AppState())
}
