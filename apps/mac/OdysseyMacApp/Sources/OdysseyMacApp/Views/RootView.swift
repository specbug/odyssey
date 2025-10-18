import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            switch appState.authState {
            case .signedOut, .authenticating:
                AuthenticationView()
            case .signedIn:
                authenticatedBody
            }
        }
        .task {
            await appState.bootstrap()
        }
        .background(OdysseyColor.background.gradient)
    }

    private var authenticatedBody: some View {
        NavigationSplitView {
            List(AppState.SidebarSection.allCases, selection: $appState.activeSection) { section in
                Label(section.rawValue, systemImage: section.iconName)
                    .tag(section)
                    .font(OdysseyFont.dr(14, weight: .medium))
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 200, ideal: 220)
        } detail: {
            switch appState.activeSection {
            case .browse:
                BrowseView()
            case .capture:
                CaptureView()
            }
        }
    }
}

private extension AppState.SidebarSection {
    var iconName: String {
        switch self {
        case .browse: return "tray.full"
        case .capture: return "plus.rectangle.on.folder"
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
