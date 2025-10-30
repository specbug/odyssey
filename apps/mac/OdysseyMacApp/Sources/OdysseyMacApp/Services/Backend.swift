import Foundation

actor Backend {
    private var environment: APIEnvironment
    private let urlSession: URLSession
    private var cachedSession: AppState.UserSession?

    init(environment: APIEnvironment = .current,
         urlSession: URLSession = .shared) {
        self.environment = environment
        // Configure URLSession with timeout
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10 // 10 second timeout
        configuration.timeoutIntervalForResource = 10
        self.urlSession = URLSession(configuration: configuration)

        print("🔧 Backend initialized with API URL: \(environment.baseURL.absoluteString)")
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

    // MARK: - Study Cards API

    func fetchStudyCards(skip: Int = 0, limit: Int = 100) async throws -> [APIStudyCard] {
        let urlString = "\(environment.baseURL.absoluteString)/study-cards?skip=\(skip)&limit=\(limit)"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let cards = try decoder.decode([APIStudyCard].self, from: data)
            return cards
        } catch {
            // Log the actual response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Failed to decode response. Actual response:")
                print(responseString)
            }
            print("❌ Decoding error: \(error)")
            if let decodingError = error as? DecodingError {
                switch decodingError {
                case .keyNotFound(let key, let context):
                    print("❌ Key '\(key.stringValue)' not found: \(context.debugDescription)")
                    print("❌ Coding path: \(context.codingPath)")
                case .typeMismatch(let type, let context):
                    print("❌ Type '\(type)' mismatch: \(context.debugDescription)")
                    print("❌ Coding path: \(context.codingPath)")
                case .valueNotFound(let type, let context):
                    print("❌ Value '\(type)' not found: \(context.debugDescription)")
                    print("❌ Coding path: \(context.codingPath)")
                case .dataCorrupted(let context):
                    print("❌ Data corrupted: \(context.debugDescription)")
                    print("❌ Coding path: \(context.codingPath)")
                @unknown default:
                    print("❌ Unknown decoding error")
                }
            }
            throw APIError.decodingError(error)
        }
    }

    func fetchDueCards(limit: Int = 50, fileId: Int? = nil) async throws -> DueCardsResponse {
        var urlString = "\(environment.baseURL.absoluteString)/study-cards/due?limit=\(limit)"
        if let fileId = fileId {
            urlString += "&file_id=\(fileId)"
        }

        print("🌐 fetchDueCards: URL = \(urlString)")

        guard let url = URL(string: urlString) else {
            print("❌ fetchDueCards: Invalid URL")
            throw APIError.invalidURL
        }

        print("🌐 fetchDueCards: Calling URLSession.data...")
        let (data, response) = try await urlSession.data(from: url)
        print("🌐 fetchDueCards: Received response")

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let dueCards = try decoder.decode(DueCardsResponse.self, from: data)
            return dueCards
        } catch {
            // Log the actual response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Failed to decode due cards response. Actual response:")
                print(responseString)
            }
            print("❌ Decoding error: \(error)")
            throw APIError.decodingError(error)
        }
    }

    func reviewCard(cardId: Int, rating: Int, timeTaken: Int? = nil, sessionId: Int? = nil) async throws -> CardReviewResult {
        let urlString = "\(environment.baseURL.absoluteString)/study-cards/\(cardId)/review"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        // Create request body
        struct ReviewRequest: Codable {
            let cardId: Int
            let rating: Int
            let timeTaken: Int?
            let sessionId: Int?

            enum CodingKeys: String, CodingKey {
                case cardId = "card_id"
                case rating
                case timeTaken = "time_taken"
                case sessionId = "session_id"
            }
        }

        let requestBody = ReviewRequest(
            cardId: cardId,
            rating: rating,
            timeTaken: timeTaken,
            sessionId: sessionId
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(requestBody)

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let result = try decoder.decode(CardReviewResult.self, from: data)
            return result
        } catch {
            // Log the actual response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Failed to decode review result. Actual response:")
                print(responseString)
            }
            print("❌ Decoding error: \(error)")
            throw APIError.decodingError(error)
        }
    }

    func fetchCardTimeline(cardId: Int) async throws -> TimelineResponse {
        let urlString = "\(environment.baseURL.absoluteString)/study-cards/\(cardId)/timeline"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let timeline = try decoder.decode(TimelineResponse.self, from: data)
            return timeline
        } catch {
            // Log the actual response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Failed to decode timeline response. Actual response:")
                print(responseString)
            }
            print("❌ Decoding error: \(error)")
            throw APIError.decodingError(error)
        }
    }

    func fetchCardProgression(cardId: Int, steps: Int = 4) async throws -> ProgressionResponse {
        let urlString = "\(environment.baseURL.absoluteString)/study-cards/\(cardId)/progression?steps=\(steps)"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let progression = try decoder.decode(ProgressionResponse.self, from: data)
            return progression
        } catch {
            // Log the actual response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Failed to decode progression response. Actual response:")
                print(responseString)
            }
            print("❌ Decoding error: \(error)")
            throw APIError.decodingError(error)
        }
    }

    func fetchPDFFile(fileId: Int) async throws -> PDFFile {
        let urlString = "\(environment.baseURL.absoluteString)/files/\(fileId)"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let file = try decoder.decode(PDFFile.self, from: data)
            return file
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Image API

    func uploadImage(imageData: Data, uuid: String) async throws -> String {
        let urlString = "\(environment.baseURL.absoluteString)/images/upload?uuid=\(uuid)"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        // Create multipart form data
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // Add image file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"image.png\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/png\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        // Parse response to get UUID
        struct ImageUploadResponse: Codable {
            let success: Bool
            let uuid: String
            let message: String
        }

        do {
            let uploadResponse = try JSONDecoder().decode(ImageUploadResponse.self, from: data)
            return uploadResponse.uuid
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func fetchImage(uuid: String) async throws -> Data {
        let urlString = "\(environment.baseURL.absoluteString)/images/\(uuid)"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        return data
    }

    // MARK: - Annotation API

    func createStandaloneAnnotation(
        annotationId: String,
        question: String,
        answer: String,
        source: String?,
        tag: String?,
        deck: String
    ) async throws -> Annotation {
        let urlString = "\(environment.baseURL.absoluteString)/annotations"
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        // Create request body
        struct AnnotationCreateRequest: Codable {
            let annotationId: String
            let pageIndex: Int?
            let question: String
            let answer: String
            let highlightedText: String?
            let positionData: String?
            let source: String?
            let tag: String?
            let deck: String

            enum CodingKeys: String, CodingKey {
                case annotationId = "annotation_id"
                case pageIndex = "page_index"
                case question
                case answer
                case highlightedText = "highlighted_text"
                case positionData = "position_data"
                case source
                case tag
                case deck
            }
        }

        let requestBody = AnnotationCreateRequest(
            annotationId: annotationId,
            pageIndex: nil,
            question: question,
            answer: answer,
            highlightedText: nil,
            positionData: nil,
            source: source,
            tag: tag,
            deck: deck
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(requestBody)

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let annotation = try decoder.decode(Annotation.self, from: data)
            return annotation
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func createStudyCardForAnnotation(annotationId: Int, clozeIndex: Int? = nil) async throws -> APIStudyCard {
        var urlString = "\(environment.baseURL.absoluteString)/study-cards?annotation_id=\(annotationId)"
        if let clozeIndex = clozeIndex {
            urlString += "&cloze_index=\(clozeIndex)"
        }

        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)["detail"]
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = customDateDecodingStrategy()

        do {
            let studyCard = try decoder.decode(APIStudyCard.self, from: data)
            return studyCard
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Helper Methods

    private func customDateDecodingStrategy() -> JSONDecoder.DateDecodingStrategy {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)  // Backend stores in UTC

        let iso8601Formatter = DateFormatter()
        iso8601Formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        iso8601Formatter.locale = Locale(identifier: "en_US_POSIX")
        iso8601Formatter.timeZone = TimeZone(secondsFromGMT: 0)  // Backend stores in UTC

        return .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            if let date = dateFormatter.date(from: dateString) {
                return date
            }

            if let date = iso8601Formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date string: \(dateString)"
            )
        }
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
