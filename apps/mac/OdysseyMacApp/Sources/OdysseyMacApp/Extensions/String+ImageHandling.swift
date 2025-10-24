import Foundation

extension String {
    /// Strips HTML tags and replaces embedded base64 images with readable placeholders
    /// Useful for displaying content from the backend that may contain images
    func stripImagesAndHTML() -> String {
        var result = self

        // Replace <img> tags (including base64 data) with [Image] placeholder
        result = result.replacingOccurrences(
            of: "<img[^>]*>",
            with: " [Image] ",
            options: .regularExpression
        )

        // Replace <br> and <br/> with newlines for readability
        result = result.replacingOccurrences(
            of: "<br\\s*/?>",
            with: "\n",
            options: [.regularExpression, .caseInsensitive]
        )

        // Strip all other HTML tags
        result = result.replacingOccurrences(
            of: "<[^>]+>",
            with: "",
            options: .regularExpression
        )

        // Clean up multiple consecutive spaces
        result = result.replacingOccurrences(
            of: "\\s{2,}",
            with: " ",
            options: .regularExpression
        )

        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Truncates string to a maximum length and adds ellipsis if needed
    func truncated(to length: Int, addEllipsis: Bool = true) -> String {
        guard self.count > length else { return self }
        let truncated = String(self.prefix(length))
        return addEllipsis ? truncated + "..." : truncated
    }
}
