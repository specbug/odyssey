import Foundation

actor Backend {
    private var environment: APIEnvironment
    private let urlSession: URLSession
    private var cachedSession: AppState.UserSession?

    init(environment: APIEnvironment = .current,
         urlSession: URLSession = .shared) {
        self.environment = environment
        self.urlSession = urlSession
    }

    func restoreSession() async throws -> AppState.UserSession {
        if let session = cachedSession {
            return session
        }

        // TODO: Pull token from keychain once integrated.
        throw BackendError.sessionNotFound
    }

    func persistSession(_ session: AppState.UserSession) async throws {
        cachedSession = session
        // TODO: Save to keychain.
    }

    func clearSession() {
        cachedSession = nil
        // TODO: Remove from keychain.
    }

    func updateEnvironment(_ newEnvironment: APIEnvironment) async throws {
        guard environment != newEnvironment else { return }
        environment = newEnvironment
        cachedSession = nil
    }

    func currentEnvironment() -> APIEnvironment {
        environment
    }

    func prefetchLibrary() async {
        // TODO: orchestrate initial library fetch leveraging backend APIs.
    }
}

enum BackendError: LocalizedError {
    case sessionNotFound

    var errorDescription: String? {
        switch self {
        case .sessionNotFound:
            return "Sign in to connect with Odyssey."
        }
    }
}
