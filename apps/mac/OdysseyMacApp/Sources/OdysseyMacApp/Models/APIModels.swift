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
