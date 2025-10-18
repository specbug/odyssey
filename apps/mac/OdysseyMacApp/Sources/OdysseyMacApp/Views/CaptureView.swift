import SwiftUI

struct CaptureView: View {
    @State private var title: String = ""
    @State private var content: String = ""
    @State private var isSubmitting: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: OdysseySpacing.lg.value) {
            Text("Capture Note")
                .font(OdysseyFont.dr(26, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            TextField("Title", text: $title)
                .textFieldStyle(.plain)
                .font(OdysseyFont.dr(18, weight: .medium))
                .padding(.bottom, OdysseySpacing.xs.value)
                .overlay(alignment: .bottom) {
                    Divider()
                        .overlay(OdysseyColor.accent)
                }

            TextEditor(text: $content)
                .font(OdysseyFont.dr(15))
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .fill(Color.white.opacity(0.96))
                        .shadow(color: .black.opacity(0.05), radius: 18, y: 10)
                )
                .frame(minHeight: 320)

            HStack {
                Spacer()
                Button(action: submit) {
                    HStack(spacing: OdysseySpacing.xs.value) {
                        Image(systemName: "paperplane.fill")
                        Text(isSubmitting ? "Uploading…" : "Publish")
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
                .disabled(isSubmitting || title.isEmpty || content.isEmpty)
            }
        }
        .padding(OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(NSColor.windowBackgroundColor))
    }

    private func submit() {
        isSubmitting = true
        // TODO: Hit backend create endpoint.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            isSubmitting = false
            title = ""
            content = ""
        }
    }
}

#Preview {
    CaptureView()
}
