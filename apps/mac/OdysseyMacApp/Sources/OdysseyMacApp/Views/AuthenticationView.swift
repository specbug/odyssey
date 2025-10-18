import SwiftUI

struct AuthenticationView: View {
    @EnvironmentObject private var appState: AppState
    @State private var token: String = ""
    @State private var isConnecting: Bool = false

    var body: some View {
        VStack(spacing: OdysseySpacing.lg.value) {
            VStack(spacing: OdysseySpacing.sm.value) {
                Text("Welcome to Odyssey")
                    .font(OdysseyFont.dr(28, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.2), radius: 12, y: 6)

                Text("Enter your API token to connect to the Odyssey backend.")
                    .font(OdysseyFont.dr(16))
                    .foregroundStyle(OdysseyColor.white.opacity(0.8))
            }

            VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                Text("API Token")
                    .font(OdysseyFont.dr(12, weight: .medium))
                    .foregroundStyle(OdysseyColor.white.opacity(0.7))

                SecureField("Paste personal token…", text: $token)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 14, weight: .medium, design: .default))
                    .frame(maxWidth: 360)
            }

            Button(action: connect) {
                Text(isConnecting ? "Connecting…" : "Connect")
                    .font(OdysseyFont.dr(16, weight: .medium))
                    .padding(.horizontal, OdysseySpacing.xl.value)
                    .padding(.vertical, OdysseySpacing.sm.value)
                    .background(
                        LinearGradient(colors: [.white.opacity(0.95), OdysseyColor.yellowAccent], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(OdysseyColor.secondaryText)
                    .clipShape(RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous))
                    .shadow(color: .black.opacity(0.1), radius: 16, y: 12)
            }
            .buttonStyle(.plain)
            .disabled(token.isEmpty || isConnecting)

            if let error = appState.error {
                Text(error.message)
                    .font(OdysseyFont.dr(13, weight: .medium))
                    .foregroundStyle(Color.red)
            }
        }
        .padding(OdysseySpacing.xl.value)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [OdysseyColor.background, OdysseyColor.secondaryBackground],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private func connect() {
        guard !token.isEmpty else { return }

        appState.error = nil

        Task {
            isConnecting = true
            do {
                try await appState.signIn(with: token, displayName: "Me")
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
