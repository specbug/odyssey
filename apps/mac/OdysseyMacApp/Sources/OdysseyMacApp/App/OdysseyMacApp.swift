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
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        // Ensure main window becomes key and accepts first responder
        DispatchQueue.main.async {
            if let window = NSApp.windows.first {
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(window.contentView)
            }
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        // Ensure all visible windows can accept input
        NSApp.windows
            .filter { $0.isVisible }
            .forEach { window in
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(window.contentView)
            }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            sender.windows.first?.makeKeyAndOrderFront(nil)
        }
        return true
    }
}
#endif
