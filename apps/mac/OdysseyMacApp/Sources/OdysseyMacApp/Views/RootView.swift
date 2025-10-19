import SwiftUI
#if os(macOS)
import AppKit
#endif

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            switch appState.authState {
            case .signedOut, .authenticating:
                AuthenticationView()
            case .signedIn:
                signedInShell
            }
        }
        .task {
            await appState.bootstrap()
        }
    }

    private var signedInShell: some View {
        ZStack(alignment: .top) {
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                content
            }
        }
    }

    private var topBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: OdysseySpacing.lg.value) {
                brand
                navControl
                Spacer(minLength: OdysseySpacing.lg.value)
                trailingControls
            }
            .padding(.horizontal, OdysseySpacing.xl.value)
            .padding(.vertical, OdysseySpacing.sm.value)
            .frame(maxWidth: 940)
        }
        .frame(maxWidth: .infinity)
        .background(
            OdysseyColor.surface
                .ignoresSafeArea(edges: .top)
        )
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(OdysseyColor.border.opacity(0.6))
                .frame(height: 0.6)
        }
        .shadow(color: OdysseyColor.shadow, radius: 24, y: 18)
    }

    private var brand: some View {
        HStack(spacing: OdysseySpacing.xs.value) {
            Image(systemName: "sun.max.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(OdysseyColor.accent)
            Text("odyssey")
                .font(OdysseyFont.dr(18, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)
        }
        .padding(.vertical, OdysseySpacing.xxs.value)
        .padding(.horizontal, OdysseySpacing.xs.value)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(OdysseyColor.surfaceSubtle)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(OdysseyColor.border, lineWidth: 1)
        )
    }

    private var navControl: some View {
        HStack(spacing: OdysseySpacing.xxs.value) {
            ForEach(AppState.Section.allCases) { section in
                let isActive = section == appState.activeSection
                Button {
                    appState.activeSection = section
                } label: {
                    HStack(spacing: OdysseySpacing.xxs.value) {
                        Image(systemName: section.iconName)
                            .font(.system(size: 12, weight: .semibold))
                        Text(section.rawValue)
                            .font(OdysseyFont.dr(13, weight: isActive ? .medium : .regular))
                    }
                    .foregroundStyle(isActive ? OdysseyColor.accent : OdysseyColor.mutedText)
                    .padding(.vertical, OdysseySpacing.xs.value)
                    .padding(.horizontal, OdysseySpacing.sm.value)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(isActive ? OdysseyColor.surfaceSubtle : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, OdysseySpacing.xxs.value)
        .padding(.horizontal, OdysseySpacing.xs.value)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(OdysseyColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(OdysseyColor.border, lineWidth: 1)
        )
        .shadow(color: OdysseyColor.shadow, radius: 14, y: 10)
    }

    private var trailingControls: some View {
        HStack(spacing: OdysseySpacing.sm.value) {
            if appState.isSyncing {
                ProgressView()
                    .progressViewStyle(.circular)
                    .controlSize(.small)
            }

            if let name = sessionDisplayName {
                Text(name)
                    .font(OdysseyFont.dr(13, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
            }

            Menu {
                Button("Settings") {
                    openSettings()
                }
                Button("Sign Out", role: .destructive) {
                    appState.signOut()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 18, weight: .medium))
                    .frame(width: 32, height: 32)
                    .foregroundStyle(OdysseyColor.mutedText)
                    .background(
                        Circle()
                            .fill(OdysseyColor.surfaceSubtle)
                    )
                    .overlay(
                        Circle()
                            .stroke(OdysseyColor.border, lineWidth: 0.8)
                    )
            }
            .menuStyle(.borderlessButton)
        }
    }

    private var content: some View {
        Group {
            switch appState.activeSection {
            case .browse:
                BrowseView()
            case .study:
                StudyView()
            case .capture:
                CaptureView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var sessionDisplayName: String? {
        if case let .signedIn(session) = appState.authState {
            return session.displayName
        }
        return nil
    }

    private func openSettings() {
#if os(macOS)
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
#endif
    }
}

private extension AppState.Section {
    var iconName: String {
        switch self {
        case .browse: return "tray.full"
        case .study: return "bolt.heart"
        case .capture: return "plus.rectangle.on.folder"
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
