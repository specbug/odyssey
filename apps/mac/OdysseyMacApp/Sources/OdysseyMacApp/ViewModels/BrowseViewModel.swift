import Foundation
import SwiftUI

@MainActor
class BrowseViewModel: ObservableObject {
    @Published var cards: [CardSummary] = []
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: Error?
    @Published var hasMoreCards: Bool = true

    private let backend: Backend
    private var currentSkip: Int = 0
    private let pageSize: Int = 50
    private var fileCache: [Int: PDFFile] = [:]

    init(backend: Backend) {
        self.backend = backend
    }

    func loadInitialCards() async {
        guard !isLoading else { return }

        isLoading = true
        error = nil
        currentSkip = 0
        cards = []
        hasMoreCards = true

        do {
            let studyCards = try await backend.fetchStudyCards(skip: currentSkip, limit: pageSize)
            let mappedCards = await mapStudyCardsToCardSummary(studyCards)
            cards = mappedCards
            currentSkip += studyCards.count
            hasMoreCards = studyCards.count == pageSize
        } catch {
            self.error = error
        }

        isLoading = false
    }

    func loadMoreCards() async {
        guard !isLoadingMore, hasMoreCards else { return }

        isLoadingMore = true

        do {
            let studyCards = try await backend.fetchStudyCards(skip: currentSkip, limit: pageSize)
            let mappedCards = await mapStudyCardsToCardSummary(studyCards)
            cards.append(contentsOf: mappedCards)
            currentSkip += studyCards.count
            hasMoreCards = studyCards.count == pageSize
        } catch {
            self.error = error
        }

        isLoadingMore = false
    }

    func refreshCards() async {
        await loadInitialCards()
    }

    // MARK: - Private Helpers

    private func mapStudyCardsToCardSummary(_ studyCards: [APIStudyCard]) async -> [CardSummary] {
        var summaries: [CardSummary] = []

        for studyCard in studyCards {
            guard let annotation = studyCard.annotation else {
                continue
            }

            // Fetch file info for source display (with caching)
            let sourceText = await getSourceText(for: annotation)

            // Map state
            let state = mapState(studyCard.state)

            // Use actual due date from API (default to now if missing)
            let dueDate = studyCard.due ?? Date()

            // Clean HTML and images from question/answer text
            let cleanedQuestion = annotation.question.stripImagesAndHTML()
            let cleanedAnswer = annotation.answer.stripImagesAndHTML()

            // Create CardSummary
            let summary = CardSummary(
                deck: "Default",
                tag: "Default",
                front: cleanedQuestion,
                back: cleanedAnswer,
                source: sourceText,
                state: state,
                dueDate: dueDate
            )

            summaries.append(summary)
        }

        return summaries
    }

    private func getSourceText(for annotation: Annotation) async -> String {
        // Check cache first
        if let cachedFile = fileCache[annotation.fileId] {
            return "Page \(annotation.pageIndex + 1) • \(cachedFile.displayName)"
        }

        // Fetch file info
        do {
            let file = try await backend.fetchPDFFile(fileId: annotation.fileId)
            fileCache[annotation.fileId] = file
            return "Page \(annotation.pageIndex + 1) • \(file.displayName)"
        } catch {
            // Fallback to just page number if file fetch fails
            return "Page \(annotation.pageIndex + 1)"
        }
    }

    private func mapState(_ apiState: String) -> CardSummary.State {
        switch apiState.lowercased() {
        case "new":
            return .new
        case "review":
            return .review
        case "learning", "relearning":
            return .learning
        case "buried":
            return .buried
        case "suspended":
            return .suspended
        default:
            return .new
        }
    }
}
