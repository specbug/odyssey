import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var baseURLString: String = ""
    @State private var statusMessage: String?
    @State private var statusIsError: Bool = false
    @State private var isSaving: Bool = false

    var body: some View {
        Form {
            Section(header: Text("Backend")) {
                // Quick preset buttons
                HStack(spacing: 8) {
                    Button("Local") {
                        baseURLString = APIEnvironment.local.baseURL.absoluteString
                        save()
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSaving)

                    Button("Production") {
                        baseURLString = APIEnvironment.production.baseURL.absoluteString
                        save()
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSaving)
                }

                TextField("API Base URL", text: $baseURLString)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .onSubmit(save)

                if let statusMessage {
                    Text(statusMessage)
                        .font(OdysseyFont.dr(12))
                        .foregroundStyle(statusColor)
                }
            }

            Section {
                HStack {
                    Button("Save", action: save)
                        .keyboardShortcut(.defaultAction)
                        .disabled(isSaving)

                    Button("Reset to Defaults", action: resetToDefaults)
                        .disabled(isSaving)
                }
            }
        }
        .padding(24)
        .frame(width: 380)
        .task {
            baseURLString = appState.apiEnvironment.baseURL.absoluteString
        }
    }

    private var statusColor: Color {
        statusIsError ? .red : OdysseyColor.secondaryText
    }

    private func save() {
        guard !isSaving else { return }
        statusMessage = nil
        statusIsError = false
        isSaving = true

        Task {
            do {
                try await appState.updateEnvironment(baseURLString: baseURLString)
                await MainActor.run {
                    baseURLString = appState.apiEnvironment.baseURL.absoluteString
                    statusMessage = "Saved"
                    statusIsError = false
                    isSaving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    statusMessage = error.localizedDescription
                    statusIsError = true
                    isSaving = false
                }
            }
        }
    }

    private func resetToDefaults() {
        guard !isSaving else { return }
        statusMessage = nil
        statusIsError = false
        isSaving = true

        Task {
            await appState.resetEnvironment()
            await MainActor.run {
                baseURLString = APIEnvironment.local.baseURL.absoluteString
                statusMessage = "Reverted to defaults"
                statusIsError = false
                isSaving = false
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
