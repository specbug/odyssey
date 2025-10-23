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
                // Hide top bar when in study session for true fullscreen
                if !appState.isInStudySession {
                    topBar
                }
                content
            }
        }
    }

    private var topBar: some View {
        VStack(spacing: 0) {
            ZStack {
                HStack(spacing: OdysseySpacing.sm.value) {
                    brand
                    Spacer()
                    trailingControls
                }

                navControl
                    .frame(width: 320)
            }
            .padding(.horizontal, OdysseySpacing.lg.value)
            .padding(.vertical, OdysseySpacing.xxs.value)
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
        .frame(height: 52, alignment: .center)
    }

    private var brand: some View {
#if os(macOS)
        Group {
            if let logo = odysseyLogo {
                Image(nsImage: logo)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 24, height: 24)
                    .accessibilityLabel("Odyssey")
            }
        }
#else
        EmptyView()
#endif
    }

    private var navControl: some View {
        HStack(spacing: OdysseySpacing.lg.value) {
            ForEach(AppState.Section.allCases) { section in
                let isActive = section == appState.activeSection
                Button {
                    appState.activeSection = section
                } label: {
                    VStack(spacing: OdysseySpacing.xxs.value) {
                        Text(section.rawValue)
#if os(macOS)
                            .font(.system(size: 14, weight: isActive ? .semibold : .medium, design: .default))
#else
                            .font(OdysseyFont.dr(14, weight: isActive ? .semibold : .medium))
#endif
                            .kerning(-0.2)
                            .foregroundStyle(isActive ? OdysseyColor.ink : OdysseyColor.mutedText)

                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [OdysseyColor.accent, OdysseyColor.accentHover],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: 2)
                            .opacity(isActive ? 1 : 0)
                            .animation(.easeInOut(duration: 0.2), value: isActive)
                    }
                    .padding(.vertical, OdysseySpacing.xs.value)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, OdysseySpacing.sm.value)
    }

    private var trailingControls: some View {
        HStack(spacing: OdysseySpacing.sm.value) {
            if appState.isSyncing {
                ProgressView()
                    .progressViewStyle(.circular)
                    .controlSize(.small)
            }

            Menu {
                Button("Settings") {
                    openSettings()
                }
                Button("Sign Out", role: .destructive) {
                    appState.signOut()
                }
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .fill(OdysseyColor.surfaceSubtle.opacity(0.7))
                    RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                        .stroke(OdysseyColor.border, lineWidth: 0.8)
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(OdysseyColor.ink)
                }
                .frame(width: 34, height: 30)
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
                if appState.isInStudySession {
                    StudySessionView()
                } else {
                    StudyView()
                }
            case .add:
                CaptureView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func openSettings() {
#if os(macOS)
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
#endif
    }

#if os(macOS)
    private var odysseyLogo: NSImage? {
        guard let url = Bundle.module.url(forResource: "odyssey-logo", withExtension: "png"),
              let image = NSImage(contentsOf: url) else {
            return nil
        }
        return image
    }
#endif
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
