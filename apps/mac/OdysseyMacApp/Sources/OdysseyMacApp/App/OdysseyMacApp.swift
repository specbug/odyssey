import SwiftUI
#if os(macOS)
import AppKit
#endif

@main
struct OdysseyMacApp: App {
    @StateObject private var appState = AppState()
#if os(macOS)
    @NSApplicationDelegateAdaptor(OdysseyAppDelegate.self) private var appDelegate
#endif

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

#if os(macOS)
final class OdysseyAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        NSApp.windows
            .filter { $0.isVisible }
            .forEach { $0.makeKeyAndOrderFront(nil) }
    }
}
#endif
