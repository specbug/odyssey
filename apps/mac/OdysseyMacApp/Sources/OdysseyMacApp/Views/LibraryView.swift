import SwiftUI

struct LibraryView: View {
    @State private var documents: [DocumentSummary] = DocumentSummary.samples

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            Header(title: "Library", subtitle: "Continue your journey through annotated knowledge.")

            ScrollView {
                LazyVGrid(columns: [.init(.adaptive(minimum: 260), spacing: OdysseySpacing.md.value)]) {
                    ForEach(documents) { document in
                        DocumentCard(document: document)
                    }
                }
                .padding(.horizontal, OdysseySpacing.lg.value)
            }
        }
        .padding(.vertical, OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            Color(NSColor.windowBackgroundColor)
                .overlay(alignment: .top) {
                    LinearGradient(colors: [.white.opacity(0.6), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 120)
                }
        )
    }
}

struct DocumentSummary: Identifiable {
    let id: UUID = UUID()
    let title: String
    let subtitle: String
    let progress: Double
    let dueCount: Int
}

extension DocumentSummary {
    static let samples: [DocumentSummary] = [
        .init(title: "Space Repetition Fundamentals", subtitle: "FSRS research notes", progress: 0.76, dueCount: 4),
        .init(title: "Designing Interfaces", subtitle: "Chapter 3 - Flow", progress: 0.42, dueCount: 9),
        .init(title: "Neural Nets Paper", subtitle: "Arxiv: 2404.15824", progress: 0.9, dueCount: 1)
    ]
}

private struct DocumentCard: View {
    let document: DocumentSummary

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
            Text(document.title)
                .font(OdysseyFont.dr(18, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text(document.subtitle)
                .font(OdysseyFont.dr(13))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.8))

            ProgressView(value: document.progress)
                .tint(OdysseyColor.accent)

            HStack(spacing: OdysseySpacing.sm.value) {
                Text("\(Int(document.progress * 100))% complete")
                    .padding(.horizontal, OdysseySpacing.sm.value)
                    .padding(.vertical, OdysseySpacing.xxs.value)
                    .background(OdysseyColor.yellowAccent.opacity(0.2))
                    .clipShape(Capsule())
                    .foregroundStyle(OdysseyColor.secondaryText)
                    .font(OdysseyFont.dr(11, weight: .medium))
                Spacer()

                if document.dueCount > 0 {
                    Badge(text: "\(document.dueCount) due")
                } else {
                    Badge(text: "Up to date", color: OdysseyColor.accent.opacity(0.25))
                }
            }
            .font(OdysseyFont.dr(12, weight: .medium))
        }
        .padding(OdysseySpacing.lg.value)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                .fill(Color.white.opacity(0.94))
                .shadow(color: .black.opacity(0.08), radius: 20, y: 12)
        )
    }
}

private struct Badge: View {
    var text: String
    var color: Color = OdysseyColor.accent.opacity(0.18)

    var body: some View {
        Text(text.uppercased())
            .padding(.horizontal, OdysseySpacing.sm.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
            .background(color)
            .clipShape(Capsule())
            .foregroundStyle(OdysseyColor.accent)
    }
}

private struct Header: View {
    var title: String
    var subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Text(title)
                .font(OdysseyFont.dr(28, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text(subtitle)
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.7))
        }
        .padding(.horizontal, OdysseySpacing.lg.value)
    }
}

#Preview {
    LibraryView()
        .environmentObject(AppState())
}
