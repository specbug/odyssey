import Foundation
import SwiftUI

@MainActor
class StudyViewModel: ObservableObject {
    @Published var cardsDueToday: Int = 0
    @Published var newCardsToday: Int = 0
    @Published var learningCardsToday: Int = 0
    @Published var cardsCompletedToday: Int = 0
    @Published var totalScheduledToday: Int = 0
    @Published var reviewedToday: Int = 0
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
            totalScheduledToday = dueCardsResponse.totalScheduledToday
            reviewedToday = dueCardsResponse.reviewedToday

            // Legacy field for backwards compatibility (use reviewedToday)
            cardsCompletedToday = dueCardsResponse.reviewedToday

            print("✅ loadDueCardStats: Complete - Total scheduled today: \(totalScheduledToday), Reviewed: \(reviewedToday)")
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
