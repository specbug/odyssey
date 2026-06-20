import Foundation
import SwiftUI

struct APIEnvironment: Equatable {
    let name: String
    let baseURL: URL

    private static let storageKey = "odyssey.api.baseURL"

    static let local = APIEnvironment(
        name: "Local",
        baseURL: URL(string: "http://localhost:8000")!
    )

    static let production = APIEnvironment(
        name: "Production",
        baseURL: URL(string: "http://192.168.0.139:8000")!
    )

    static var current: APIEnvironment {
        guard
            let stored = UserDefaults.standard.string(forKey: storageKey),
            let url = URL(string: stored)
        else {
            return .local  // Default to local for development
        }

        return APIEnvironment(name: "Custom", baseURL: url)
    }

    func persist() {
        if self == .local || self == .production {
            Self.reset()  // Clear UserDefaults for presets
        } else {
            UserDefaults.standard.set(baseURL.absoluteString, forKey: Self.storageKey)
        }
    }

    static func reset() {
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    func with(name: String) -> APIEnvironment {
        APIEnvironment(name: name, baseURL: baseURL)
    }
}

private struct APIEnvironmentKey: EnvironmentKey {
    static let defaultValue: APIEnvironment = .current
}

extension EnvironmentValues {
    var apiEnvironment: APIEnvironment {
        get { self[APIEnvironmentKey.self] }
        set { self[APIEnvironmentKey.self] = newValue }
    }
}
