import Foundation
import SwiftUI

@MainActor
class StudyViewModel: ObservableObject {
    @Published var cardsDueToday: Int = 0
    @Published var newCardsToday: Int = 0
    @Published var learningCardsToday: Int = 0
    @Published var cardsCompletedToday: Int = 0
    @Published var isLoading: Bool = false
    @Published var error: Error?

    private let backend: Backend

    init(backend: Backend) {
        self.backend = backend
    }

    func loadDueCardStats() async {
        guard !isLoading else {
            print("⚠️ loadDueCardStats: Already loading, skipping")
            return
        }

        print("📊 loadDueCardStats: Starting...")
        isLoading = true
        error = nil

        do {
            print("📊 Fetching due cards from backend...")
            let dueCardsResponse = try await backend.fetchDueCards(limit: 100)
            print("✅ Received due cards response: \(dueCardsResponse.totalDue) due, \(dueCardsResponse.totalNew) new, \(dueCardsResponse.totalLearning) learning")

            // Update stats
            cardsDueToday = dueCardsResponse.totalDue
            newCardsToday = dueCardsResponse.totalNew
            learningCardsToday = dueCardsResponse.totalLearning

            // Calculate completed today (cards that have been reviewed today)
            // This would ideally come from a separate API endpoint for session stats
            // For now, we'll set it to 0 as we don't have that data
            cardsCompletedToday = 0

            print("✅ loadDueCardStats: Complete")
        } catch {
            self.error = error
            print("❌ Error loading due card stats: \(error)")
            print("❌ Error type: \(type(of: error))")
        }

        isLoading = false
    }

    func refreshStats() async {
        await loadDueCardStats()
    }
}
