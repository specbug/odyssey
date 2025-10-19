import SwiftUI

struct CaptureView: View {
    @State private var question: String = ""
    @State private var answer: String = ""
    @State private var source: String = ""
    @State private var isSubmitting: Bool = false

    var body: some View {
        ZStack(alignment: .top) {
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(spacing: OdysseySpacing.lg.value) {
                ScrollView {
                    VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
                        header
                        fields
                    }
                    .padding(.horizontal, OdysseySpacing.xl.value)
                    .padding(.top, OdysseySpacing.xl.value)
                    .frame(maxWidth: 960, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                actionBar
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
            Text("Create Card")
                .font(OdysseyFont.dr(26, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Capture a prompt-response pair and link it back to a source for future context.")
                .font(OdysseyFont.dr(14))
                .foregroundStyle(OdysseyColor.mutedText)
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
                    .foregroundStyle(OdysseyColor.mutedText)

                TextField("Optional — e.g. 'Neural Nets.pdf · page 32'", text: $source)
                    .textFieldStyle(.plain)
                    .font(OdysseyFont.dr(13))
                    .autocorrectionDisabled()
                    .padding(.vertical, OdysseySpacing.sm.value)
                    .padding(.horizontal, OdysseySpacing.md.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(OdysseyColor.surface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )
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
                .frame(maxWidth: 200)
            }
            .buttonStyle(OdysseyPrimaryButtonStyle())
            .disabled(isSubmitting || question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(isSubmitting || question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.6 : 1)
        }
        .padding(.horizontal, OdysseySpacing.xl.value)
        .padding(.vertical, OdysseySpacing.lg.value)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .background(
            OdysseyColor.surface
                .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(OdysseyColor.border.opacity(0.6))
                .frame(height: 0.6)
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
                .foregroundStyle(OdysseyColor.mutedText)

            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                    .fill(OdysseyColor.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )

                TextEditor(text: $text)
                    .font(OdysseyFont.dr(15))
                    .padding(.all, OdysseySpacing.md.value)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: minHeight)
                    .foregroundStyle(OdysseyColor.ink)

                if text.isEmpty {
                    Text(placeholder)
                        .font(OdysseyFont.dr(14))
                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.6))
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
