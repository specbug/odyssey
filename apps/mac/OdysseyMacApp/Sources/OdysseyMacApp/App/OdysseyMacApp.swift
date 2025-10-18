import SwiftUI

@main
struct OdysseyMacApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environment(\.apiEnvironment, appState.apiEnvironment)
                .preferredColorScheme(.light)
        }
        .commands {
            OdysseyCommands(appState: appState)
        }

        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}
