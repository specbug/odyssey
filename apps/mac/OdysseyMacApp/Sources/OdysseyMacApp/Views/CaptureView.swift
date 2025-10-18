import SwiftUI

struct CaptureView: View {
    @State private var question: String = ""
    @State private var answer: String = ""
    @State private var source: String = ""
    @State private var isSubmitting: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            header
            fields
            Spacer()
            actionBar
        }
        .padding(OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(NSColor.windowBackgroundColor))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Text("Create Card")
                .font(OdysseyFont.dr(26, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Capture a prompt-response pair and link it back to a source for future context.")
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.75))
        }
    }

    private var fields: some View {
        VStack(spacing: OdysseySpacing.lg.value) {
            CardField(
                title: "Question",
                systemImage: "questionmark.circle",
                placeholder: "Type the recall prompt or cloze deletion…",
                text: $question,
                minHeight: 140
            )

            CardField(
                title: "Answer",
                systemImage: "lightbulb",
                placeholder: "Write the ideal answer learners should recall…",
                text: $answer,
                minHeight: 160
            )

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Label("Source", systemImage: "link")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.secondaryText.opacity(0.8))

                TextField("Optional — e.g. 'Neural Nets.pdf · page 32'", text: $source)
                    .textFieldStyle(.roundedBorder)
                    .font(OdysseyFont.dr(13))
                    .autocorrectionDisabled()
            }
        }
    }

    private var actionBar: some View {
        HStack {
            Spacer()
            Button(action: submit) {
                HStack(spacing: OdysseySpacing.xs.value) {
                    Image(systemName: "paperplane.fill")
                    Text(isSubmitting ? "Saving…" : "Save Card")
                }
                .font(OdysseyFont.dr(16, weight: .medium))
                .padding(.horizontal, OdysseySpacing.xl.value)
                .padding(.vertical, OdysseySpacing.sm.value)
                .background(
                    LinearGradient(colors: [OdysseyColor.accent, OdysseyColor.secondaryBackground], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous))
                .shadow(color: OdysseyColor.accent.opacity(0.4), radius: 20, y: 16)
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting || question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private func submit() {
        guard !question.isEmpty, !answer.isEmpty else { return }
        isSubmitting = true
        // TODO: Hit backend create endpoint.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            isSubmitting = false
            question = ""
            answer = ""
            source = ""
        }
    }
}

private struct CardField: View {
    var title: String
    var systemImage: String
    var placeholder: String
    @Binding var text: String
    var minHeight: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Label(title, systemImage: systemImage)
                .font(OdysseyFont.dr(12, weight: .medium))
                .foregroundStyle(OdysseyColor.secondaryText.opacity(0.8))

            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                    .fill(Color.white.opacity(0.96))
                    .shadow(color: .black.opacity(0.05), radius: 18, y: 10)

                TextEditor(text: $text)
                    .font(OdysseyFont.dr(15))
                    .padding(.all, OdysseySpacing.md.value)
                    .background(Color.clear)
                    .frame(minHeight: minHeight)

                if text.isEmpty {
                    Text(placeholder)
                        .font(OdysseyFont.dr(14))
                        .foregroundStyle(OdysseyColor.secondaryText.opacity(0.5))
                        .padding(.all, OdysseySpacing.md.value)
                        .allowsHitTesting(false)
                }
            }
        }
    }
}

#Preview {
    CaptureView()
}
