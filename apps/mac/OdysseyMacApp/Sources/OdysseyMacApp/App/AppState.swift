import Combine
import Foundation

@MainActor
final class AppState: ObservableObject {
    enum Section: String, CaseIterable, Identifiable {
        case browse = "Browse"
        case study = "Study"
        case capture = "Capture"

        var id: String { rawValue }
    }

    enum AuthState: Equatable {
        case signedOut
        case authenticating
        case signedIn(UserSession)
    }

    struct UserSession: Equatable {
        let token: String
        let displayName: String
    }

    @Published var activeSection: Section = .study
    @Published var authState: AuthState = .signedOut
    @Published var isSyncing: Bool = false
    @Published var error: AppError?
    @Published private(set) var apiEnvironment: APIEnvironment

    let backend: Backend

    init(backend: Backend? = nil, environment: APIEnvironment = .current) {
        self.apiEnvironment = environment
        if let backend {
            self.backend = backend
        } else {
            self.backend = Backend(environment: environment)
        }
    }

    func bootstrap() async {
        guard case .signedOut = authState else { return }
        do {
            authState = .authenticating
            let session = try await backend.restoreSession()
            authState = .signedIn(session)
            await backend.prefetchLibrary()
        } catch let backendError as BackendError {
            switch backendError {
            case .sessionNotFound:
                authState = .signedOut
                error = nil
            }
        } catch {
            authState = .signedOut
            self.error = AppError(message: error.localizedDescription)
        }
    }

    func signIn(with token: String, displayName: String) async throws {
        let session = UserSession(token: token, displayName: displayName)
        try await backend.persistSession(session)
        authState = .signedIn(session)
        error = nil
    }

    func signOut() {
        authState = .signedOut
        Task {
            await backend.clearSession()
        }
    }

    func updateEnvironment(baseURLString: String) async throws {
        guard
            let url = URL(string: baseURLString),
            let scheme = url.scheme,
            !scheme.isEmpty
        else {
            throw AppStateError.invalidURL
        }

        let targetEnvironment: APIEnvironment
        if url == APIEnvironment.production.baseURL {
            targetEnvironment = .production
        } else {
            targetEnvironment = APIEnvironment(name: "Custom", baseURL: url)
        }

        try await backend.updateEnvironment(targetEnvironment)
        targetEnvironment.persist()
        apiEnvironment = targetEnvironment
        authState = .signedOut
        error = nil
    }

    func resetEnvironment() async {
        APIEnvironment.reset()
        try? await updateEnvironment(baseURLString: APIEnvironment.production.baseURL.absoluteString)
    }
}

struct AppError: Identifiable {
    let id = UUID()
    let message: String
}

enum AppStateError: LocalizedError {
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Enter a valid API URL (including scheme)."
        }
    }
}
