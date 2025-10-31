import Foundation

// MARK: - API Response Models

struct PDFFile: Codable, Identifiable {
    let id: Int
    let filename: String
    let originalFilename: String
    let fileHash: String
    let fileSize: Int
    let mimeType: String
    let zoomLevel: Double
    let lastReadPosition: Int
    let totalPages: Int?
    let uploadDate: Date
    let lastAccessed: Date
    let annotationCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case filename
        case originalFilename = "original_filename"
        case fileHash = "file_hash"
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case zoomLevel = "zoom_level"
        case lastReadPosition = "last_read_position"
        case totalPages = "total_pages"
        case uploadDate = "upload_date"
        case lastAccessed = "last_accessed"
        case annotationCount = "annotation_count"
    }

    var displayName: String {
        originalFilename.replacingOccurrences(of: ".pdf", with: "", options: .caseInsensitive)
    }
}

struct Annotation: Codable, Identifiable {
    let id: Int
    let fileId: Int?  // Optional for standalone notes
    let annotationId: String
    let pageIndex: Int?  // Optional for standalone notes
    let question: String
    let answer: String
    let highlightedText: String?
    let positionData: String?
    let source: String?
    let tag: String?
    let deck: String
    let createdDate: Date
    let updatedDate: Date

    enum CodingKeys: String, CodingKey {
        case id
        case fileId = "file_id"
        case annotationId = "annotation_id"
        case pageIndex = "page_index"
        case question
        case answer
        case highlightedText = "highlighted_text"
        case positionData = "position_data"
        case source
        case tag
        case deck
        case createdDate = "created_date"
        case updatedDate = "updated_date"
    }
}

struct APIImage: Codable, Identifiable {
    let id: Int
    let uuid: String
    let annotationId: Int?
    let fileSize: Int
    let mimeType: String
    let createdDate: Date

    enum CodingKeys: String, CodingKey {
        case id
        case uuid
        case annotationId = "annotation_id"
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case createdDate = "created_date"
    }
}

struct APIStudyCard: Codable, Identifiable {
    let id: Int
    let annotationId: Int?
    let clozeIndex: Int?
    let difficulty: Double
    let stability: Double
    let elapsedDays: Int
    let scheduledDays: Int
    let reps: Int
    let lapses: Int
    let state: String
    let lastReview: Date?
    let createdDate: Date
    let due: Date?
    let annotation: Annotation?

    enum CodingKeys: String, CodingKey {
        case id
        case annotationId = "annotation_id"
        case clozeIndex = "cloze_index"
        case difficulty
        case stability
        case elapsedDays = "elapsed_days"
        case scheduledDays = "scheduled_days"
        case reps
        case lapses
        case state
        case lastReview = "last_review"
        case createdDate = "created_date"
        case due
        case annotation
    }
}

// MARK: - Paginated Response

struct PaginatedResponse<T: Codable>: Codable {
    let items: [T]
    let total: Int
    let skip: Int
    let limit: Int
}

// MARK: - Due Cards Response

struct DueCardsResponse: Codable {
    let dueCards: [APIStudyCard]
    let newCards: [APIStudyCard]
    let learningCards: [APIStudyCard]
    let totalDue: Int
    let totalNew: Int
    let totalLearning: Int
    let totalScheduledToday: Int
    let reviewedToday: Int

    enum CodingKeys: String, CodingKey {
        case dueCards = "due_cards"
        case newCards = "new_cards"
        case learningCards = "learning_cards"
        case totalDue = "total_due"
        case totalNew = "total_new"
        case totalLearning = "total_learning"
        case totalScheduledToday = "total_scheduled_today"
        case reviewedToday = "reviewed_today"
    }
}

// MARK: - Card Review Response

struct CardReviewResponse: Codable {
    let id: Int
    let cardId: Int
    let sessionId: Int?
    let rating: Int
    let timeTaken: Int?
    let reviewDate: Date
    let stateBefore: String?
    let difficultyBefore: Double?
    let stabilityBefore: Double?
    let stateAfter: String?
    let difficultyAfter: Double?
    let stabilityAfter: Double?
    let scheduledDaysAfter: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case cardId = "card_id"
        case sessionId = "session_id"
        case rating
        case timeTaken = "time_taken"
        case reviewDate = "review_date"
        case stateBefore = "state_before"
        case difficultyBefore = "difficulty_before"
        case stabilityBefore = "stability_before"
        case stateAfter = "state_after"
        case difficultyAfter = "difficulty_after"
        case stabilityAfter = "stability_after"
        case scheduledDaysAfter = "scheduled_days_after"
    }
}

struct CardReviewResult: Codable {
    let card: APIStudyCard
    let review: CardReviewResponse
    let nextReviewDate: Date
    let message: String

    enum CodingKeys: String, CodingKey {
        case card
        case review
        case nextReviewDate = "next_review_date"
        case message
    }
}

// MARK: - Timeline Response

struct TimelinePoint: Codable {
    let rating: Int
    let ratingLabel: String
    let nextReviewDate: Date
    let intervalDays: Int
    let intervalText: String
    let cardState: String
    let difficultyAfter: Double
    let stabilityAfter: Double

    enum CodingKeys: String, CodingKey {
        case rating
        case ratingLabel = "rating_label"
        case nextReviewDate = "next_review_date"
        case intervalDays = "interval_days"
        case intervalText = "interval_text"
        case cardState = "card_state"
        case difficultyAfter = "difficulty_after"
        case stabilityAfter = "stability_after"
    }
}

struct CardTimeline: Codable {
    let cardId: Int
    let currentState: String
    let currentDifficulty: Double
    let currentStability: Double
    let currentScheduledDays: Int
    let nextReviewDate: Date?
    let timelinePoints: [TimelinePoint]
    let generatedAt: Date

    enum CodingKeys: String, CodingKey {
        case cardId = "card_id"
        case currentState = "current_state"
        case currentDifficulty = "current_difficulty"
        case currentStability = "current_stability"
        case currentScheduledDays = "current_scheduled_days"
        case nextReviewDate = "next_review_date"
        case timelinePoints = "timeline_points"
        case generatedAt = "generated_at"
    }
}

struct TimelineResponse: Codable {
    let success: Bool
    let timeline: CardTimeline
    let message: String?
}

// MARK: - Progression Models

struct ProgressionInterval: Codable {
    let step: Int
    let intervalText: String
    let intervalDays: Int
    let nextReviewDate: Date
    let cardState: String
    let difficulty: Double
    let stability: Double

    enum CodingKeys: String, CodingKey {
        case step
        case intervalText = "interval_text"
        case intervalDays = "interval_days"
        case nextReviewDate = "next_review_date"
        case cardState = "card_state"
        case difficulty
        case stability
    }
}

struct CardProgression: Codable {
    let cardId: Int
    let currentState: String
    let progressionIntervals: [ProgressionInterval]
    let generatedAt: Date

    enum CodingKeys: String, CodingKey {
        case cardId = "card_id"
        case currentState = "current_state"
        case progressionIntervals = "progression_intervals"
        case generatedAt = "generated_at"
    }
}

struct ProgressionResponse: Codable {
    let success: Bool
    let progression: CardProgression
    let message: String?
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String?)
    case decodingError(Error)
    case networkError(Error)
    case noAnnotation

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode, let message):
            if let message = message {
                return "Server error (\(statusCode)): \(message)"
            }
            return "Server error: \(statusCode)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .noAnnotation:
            return "Card has no associated annotation"
        }
    }
}
