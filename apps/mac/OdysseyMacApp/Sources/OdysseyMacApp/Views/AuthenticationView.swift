import SwiftUI

struct AuthenticationView: View {
    @EnvironmentObject private var appState: AppState
    @State private var token: String = ""
    @State private var isConnecting: Bool = false

    var body: some View {
        ZStack {
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(spacing: OdysseySpacing.xl.value) {
                header
                tokenEntry

                if let error = appState.error {
                    Text(error.message)
                        .font(OdysseyFont.dr(12, weight: .medium))
                        .foregroundStyle(Color.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(OdysseySpacing.xl.value)
            .frame(maxWidth: 440)
            .background(
                RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                    .fill(OdysseyColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                    .stroke(OdysseyColor.border, lineWidth: 1)
            )
            .shadow(color: OdysseyColor.shadow, radius: 26, y: 18)
            .padding(.horizontal, OdysseySpacing.xl.value)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var header: some View {
        VStack(spacing: OdysseySpacing.sm.value) {
            HStack(spacing: OdysseySpacing.xs.value) {
                Image(systemName: "sun.max.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(OdysseyColor.accent)
                Text("Odyssey")
                    .font(OdysseyFont.dr(22, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
            }

            VStack(spacing: OdysseySpacing.xxs.value) {
                Text("Welcome back")
                    .font(OdysseyFont.dr(26, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
                Text("Connect with your personal API token to continue where you left off.")
                    .font(OdysseyFont.dr(14))
                    .foregroundStyle(OdysseyColor.mutedText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
        }
    }

    private var tokenEntry: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("API Token")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)

                SecureField("Paste personal token…", text: $token)
                    .textFieldStyle(.plain)
                    .font(OdysseyFont.dr(14, weight: .medium))
                    .padding(.vertical, OdysseySpacing.sm.value)
                    .padding(.horizontal, OdysseySpacing.md.value)
                    .background(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .fill(OdysseyColor.surfaceSubtle)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                            .stroke(OdysseyColor.border, lineWidth: 1)
                    )
                    .disableAutocorrection(true)
            }

            Button(action: connect) {
                HStack(spacing: OdysseySpacing.sm.value) {
                    if isConnecting {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .controlSize(.small)
                    }
                    Text(isConnecting ? "Connecting…" : "Connect")
                        .font(OdysseyFont.dr(15, weight: .medium))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(OdysseyPrimaryButtonStyle())
            .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isConnecting)
            .opacity(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isConnecting ? 0.6 : 1)
        }
    }

    private func connect() {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        appState.error = nil

        Task {
            isConnecting = true
            do {
                try await appState.signIn(with: trimmed, displayName: "Me")
                await MainActor.run {
                    token = ""
                }
            } catch {
                await MainActor.run {
                    appState.error = AppError(message: error.localizedDescription)
                }
            }
            await MainActor.run {
                isConnecting = false
            }
        }
    }
}

#Preview {
    AuthenticationView()
        .environmentObject(AppState())
}
