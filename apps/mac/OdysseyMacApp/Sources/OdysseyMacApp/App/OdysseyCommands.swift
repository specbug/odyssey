import SwiftUI

struct OdysseyCommands: Commands {
    @ObservedObject var appState: AppState

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About Odyssey") {
                // TODO: Present about window.
            }
        }

        CommandGroup(after: .appTermination) {
            Button("Sign Out") {
                appState.signOut()
            }
            .keyboardShortcut("q", modifiers: [.command, .shift])
            .disabled(!appState.isSignedIn)
        }
    }
}

private extension AppState {
    var isSignedIn: Bool {
        if case .signedIn = authState { return true }
        return false
    }
}
