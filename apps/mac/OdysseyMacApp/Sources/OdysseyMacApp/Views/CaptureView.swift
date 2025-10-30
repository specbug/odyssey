import SwiftUI
import AppKit

struct CaptureView: View {
    @EnvironmentObject var appState: AppState
    @State private var primaryText: String = ""
    @State private var secondaryText: String = ""
    @State private var source: String = ""
    @State private var tag: String = ""
    @State private var tagDraft: String = ""
    @State private var availableTags: [String] = [
        "Design Systems",
        "Learning Science",
        "FSRS Fundamentals",
        "Neural Nets",
        "Productivity"
    ]
    @State private var selectedDeck: String = "Default"
    @State private var isSubmitting: Bool = false
    @State private var showSuccessFlash: Bool = false
    @State private var showTagCreator: Bool = false
    @State private var isPreviewMode: Bool = false
    @State private var primaryTextHeight: CGFloat = 110
    @State private var secondaryTextHeight: CGFloat = 140
    @State private var imageStore: [String: NSImage] = [:]  // UUID -> NSImage mapping
    @State private var errorMessage: String? = nil
    @FocusState private var focusedField: Field?
    @FocusState private var isPrimaryFocused: Bool
    @FocusState private var isSecondaryFocused: Bool

    enum Field: Hashable {
        case primary, secondary, source
    }

    private var canSave: Bool {
        !primaryText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Color Palette (Odyssey Neon)

    private var primaryAccent: Color {
        Color(hex: "#ff4d06") // Odyssey orange accent
    }

    private var latexPink: Color {
        Color(hex: "#ff5252") // Pink/red for LaTeX
    }

    private var clozeBlue: Color {
        Color(red: 114.0 / 255.0, green: 174.0 / 255.0, blue: 248.0 / 255.0) // #72AEF8 solid
    }

    private var ink: Color {
        Color.black.opacity(0.8)
    }

    private var mutedText: Color {
        Color.black.opacity(0.4)
    }

    private var subtleBorder: Color {
        Color.black.opacity(0.08)
    }

    private var surfaceBackground: Color {
        OdysseyColor.surface
    }

    private var shadowColor: Color {
        OdysseyColor.shadow.opacity(0.05)
    }

    private var tagDisplayText: String {
        tag.isEmpty ? "Tag" : tag
    }

    var body: some View {
        ZStack {
            // Match BrowseView background
            OdysseyColor.canvas
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Preview/Edit Toggle Button (top-right, labeled)
                    HStack {
                        Spacer()
                        Button(action: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 1.0)) {
                                isPreviewMode.toggle()
                            }
                        }) {
                            HStack(spacing: 6) {
                                if isPreviewMode {
                                    // Edit icon (SF Symbol)
                                    Image(systemName: "pencil.circle")
                                        .font(.system(size: 14, weight: .medium))
                                } else {
                                    // Preview icon (SF Symbol)
                                    Image(systemName: "circle")
                                        .font(.system(size: 14, weight: .regular))
                                }
                                Text(isPreviewMode ? "Edit" : "Preview")
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .foregroundStyle(ink)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                ZStack {
                                    // Geometric offset shadow layer
                                    Rectangle()
                                        .fill(Color.black.opacity(0.08))
                                        .offset(x: 2, y: 3)

                                    // Main background
                                    Rectangle()
                                        .fill(Color.white)
                                }
                            )
                            .overlay(
                                Rectangle()
                                    .stroke(OdysseyColor.border.opacity(0.5), lineWidth: 1.5)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 48)
                    .padding(.top, 24)

                    // Primary text field
                    VStack(alignment: .leading, spacing: 4) {
                        if isPreviewMode {
                            // Preview mode - render LaTeX, cloze, and images inline
                            if !primaryText.isEmpty {
                                InlineImageRenderer(
                                    text: primaryText,
                                    imageStore: imageStore,
                                    clozeColor: "rgba(114, 174, 248, 1.0)"
                                )
                                .frame(minHeight: 120, alignment: .topLeading)
                            } else {
                                Text("Add the thought you want to keep...")
                                    .font(OdysseyFont.dr(28))
                                    .foregroundStyle(mutedText)
                                    .padding(.top, 4)
                                    .frame(minHeight: 120, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor with image markers
                            ZStack(alignment: .topLeading) {
                                if primaryText.isEmpty {
                                    Text("Add the thought you want to keep...")
                                        .font(OdysseyFont.dr(28))
                                        .foregroundStyle(mutedText)
                                        .padding(.top, 4)
                                        .padding(.leading, 2)
                                        .allowsHitTesting(false)
                                }

                                LatexTextEditor(
                                    text: $primaryText,
                                    placeholder: "Add the thought you want to keep...",
                                    font: NSFont(name: "Dr", size: 28) ?? NSFont.systemFont(ofSize: 28, weight: .light),
                                    textColor: NSColor(ink),
                                    latexColor: NSColor(latexPink),
                                    clozeColor: NSColor(clozeBlue),
                                    heightBinding: $primaryTextHeight,
                                    onImagePasted: { image, uuid in
                                        imageStore[uuid] = image
                                    }
                                )
                                .frame(height: max(primaryTextHeight, 120), alignment: .topLeading)
                            }
                        }

                        Rectangle()
                            .fill(primaryAccent.opacity(0.2))
                            .frame(height: 2)
                    }
                    .padding(.horizontal, 48)
                    .padding(.top, 24)

                    // Secondary text field
                    VStack(alignment: .leading, spacing: 4) {
                        if isPreviewMode {
                            // Preview mode - render LaTeX, cloze, and images inline
                            if !secondaryText.isEmpty {
                                InlineImageRenderer(
                                    text: secondaryText,
                                    imageStore: imageStore,
                                    clozeColor: "rgba(114, 174, 248, 1.0)"
                                )
                                .frame(minHeight: 140, alignment: .topLeading)
                            } else {
                                Text("Remember forever...")
                                    .font(OdysseyFont.dr(28))
                                    .foregroundStyle(mutedText)
                                    .padding(.top, 4)
                                    .frame(minHeight: 140, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor with image markers
                            ZStack(alignment: .topLeading) {
                                if secondaryText.isEmpty {
                                    Text("Remember forever...")
                                        .font(OdysseyFont.dr(28))
                                        .foregroundStyle(mutedText)
                                        .padding(.top, 4)
                                        .padding(.leading, 2)
                                        .allowsHitTesting(false)
                                }

                                LatexTextEditor(
                                    text: $secondaryText,
                                    placeholder: "Remember forever...",
                                    font: NSFont(name: "Dr", size: 28) ?? NSFont.systemFont(ofSize: 28, weight: .light),
                                    textColor: NSColor(ink),
                                    latexColor: NSColor(latexPink),
                                    clozeColor: NSColor(clozeBlue),
                                    heightBinding: $secondaryTextHeight,
                                    onImagePasted: { image, uuid in
                                        imageStore[uuid] = image
                                    }
                                )
                                .frame(height: max(secondaryTextHeight, 140), alignment: .topLeading)
                            }
                        }

                        Rectangle()
                            .fill(primaryAccent.opacity(0.2))
                            .frame(height: 2)
                    }
                    .padding(.horizontal, 48)
                    .padding(.top, 32)

                    // Source, Tag & Deck row
                    HStack(spacing: 12) {
                        // Source field (BrowseView search bar style)
                        HStack(spacing: 12) {
                            Image(systemName: "link")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(primaryAccent)

                            TextField("Source", text: $source)
                                .textFieldStyle(.plain)
                                .font(OdysseyFont.bodySmall)
                                .foregroundStyle(ink)
                                .focused($focusedField, equals: .source)

                            if !source.isEmpty {
                                Button {
                                    withAnimation(.spring(response: 0.2, dampingFraction: 1.0)) {
                                        source = ""
                                    }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 16))
                                        .foregroundStyle(mutedText)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(surfaceBackground)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(
                                    focusedField == .source ? primaryAccent : OdysseyColor.border,
                                    lineWidth: 1.5
                                )
                        )
                        .shadow(color: shadowColor, radius: 4, y: 2)
                        .animation(.spring(response: 0.2, dampingFraction: 1.0), value: focusedField)
                        .animation(.spring(response: 0.2, dampingFraction: 1.0), value: source)
                        .frame(minWidth: 320, maxWidth: .infinity)

                        // Tag field
                        Menu {
                            Button {
                                tagDraft = ""
                                showTagCreator = true
                            } label: {
                                Label("Create Tag…", systemImage: "plus")
                            }

                            if !availableTags.isEmpty {
                                if !tag.isEmpty {
                                    Button {
                                        tag = ""
                                    } label: {
                                        Label("No Tag", systemImage: "slash.circle")
                                    }
                                }

                                Divider()

                                ForEach(availableTags, id: \.self) { suggestion in
                                    Button {
                                        tag = suggestion
                                    } label: {
                                        Label(
                                            suggestion,
                                            systemImage: tag == suggestion ? "checkmark" : "tag"
                                        )
                                    }
                                }
                            }
                        } label: {
                            ChipMenuLabel(
                                iconName: "tag",
                                text: tag.isEmpty ? "Tag" : tag,
                                isActive: !tag.isEmpty,
                                accentColor: primaryAccent
                            )
                        }
                        .buttonStyle(.plain)
                        .popover(isPresented: $showTagCreator, arrowEdge: .bottom) {
                            TagCreationPopover(
                                tagDraft: $tagDraft,
                                onCancel: { showTagCreator = false },
                                onCreate: { name in
                                    createTag(named: name)
                                    showTagCreator = false
                                }
                            )
                        }

                        // Deck selector
                        Menu {
                            Button("Default") { selectedDeck = "Default" }
                            Button("FSRS Fundamentals") { selectedDeck = "FSRS Fundamentals" }
                            Button("Design Systems") { selectedDeck = "Design Systems" }
                            Button("Neural Nets") { selectedDeck = "Neural Nets" }
                        } label: {
                            ChipMenuLabel(
                                iconName: "folder",
                                text: selectedDeck,
                                isActive: true,
                                accentColor: primaryAccent
                            )
                        }
                        .buttonStyle(.plain)

                        // Save button - animated rainbow logo
                        AnimatedLogoButton(
                            isEnabled: canSave,
                            isSubmitting: isSubmitting,
                            showSuccess: showSuccessFlash,
                            action: submit
                        )
                        .accessibilityLabel("Save Card")
                    }
                    .padding(.horizontal, 48)
                    .padding(.top, 32)

                    Spacer(minLength: 48)
                }
                .frame(maxWidth: .infinity)
            }

            // Error banner
            if let errorMessage = errorMessage {
                VStack {
                    Spacer()
                    HStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(primaryAccent)
                            .font(.system(size: 14))
                        Text(errorMessage)
                            .foregroundColor(ink)
                            .font(.system(size: 13, weight: .medium))
                        Spacer()
                        Button(action: { self.errorMessage = nil }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(mutedText)
                                .font(.system(size: 16))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(16)
                    .background(primaryAccent.opacity(0.08))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(primaryAccent.opacity(0.2), lineWidth: 1)
                    )
                    .padding(16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.easeInOut(duration: 0.25), value: errorMessage)
            }
        }
        .onAppear {
            // Auto-focus primary field for quicker capture
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                focusedField = .primary
            }
        }
    }

    private func createTag(named name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if !availableTags.contains(where: { $0.compare(trimmed, options: .caseInsensitive) == .orderedSame }) {
            availableTags.append(trimmed)
        }

        tag = trimmed
        tagDraft = ""
    }

    private func submit() {
        guard canSave, !isSubmitting else { return }

        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                // 1. Upload all images first
                print("📤 Uploading \(imageStore.count) images...")
                for (uuid, nsImage) in imageStore {
                    // Convert NSImage to PNG data
                    guard let tiffData = nsImage.tiffRepresentation,
                          let bitmapImage = NSBitmapImageRep(data: tiffData),
                          let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
                        throw NSError(domain: "CaptureView", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to convert image to PNG"])
                    }

                    // Upload image to backend
                    let uploadedUUID = try await appState.backend.uploadImage(imageData: pngData, uuid: uuid)
                    print("✅ Uploaded image: \(uploadedUUID)")
                }

                // 2. Create standalone annotation
                print("📝 Creating annotation...")
                let annotationId = UUID().uuidString
                let annotation = try await appState.backend.createStandaloneAnnotation(
                    annotationId: annotationId,
                    question: primaryText,
                    answer: secondaryText,
                    source: source.isEmpty ? nil : source,
                    tag: tag.isEmpty ? nil : tag,
                    deck: selectedDeck
                )
                print("✅ Created annotation: \(annotation.id)")

                // 3. Create study card
                print("🎯 Creating study card...")
                let studyCard = try await appState.backend.createStudyCardForAnnotation(annotationId: annotation.id)
                print("✅ Created study card: \(studyCard.id)")

                // 4. Show success and clear form
                await MainActor.run {
                    isSubmitting = false

                    withAnimation(.easeInOut(duration: 0.25)) {
                        showSuccessFlash = true
                    }

                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        primaryText = ""
                        secondaryText = ""
                        source = ""
                        tag = ""
                        imageStore = [:]
                        errorMessage = nil

                        withAnimation(.easeInOut(duration: 0.25)) {
                            showSuccessFlash = false
                        }

                        focusedField = .primary
                    }
                }

            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                    print("❌ Error submitting note: \(error)")

                    // Auto-dismiss error after 5 seconds
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                        errorMessage = nil
                    }
                }
            }
        }
    }
}

// MARK: - Inline Image Renderer

private struct TextSegmentView: View {
    let text: String
    let clozeColor: String
    let textColor: Color
    @State private var contentHeight: CGFloat = 100

    var body: some View {
        LatexRenderView(
            text: text,
            clozeColor: clozeColor,
            textColor: textColor,
            fontSize: 28,
            heightBinding: $contentHeight
        )
        .frame(height: max(contentHeight, 100))
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct InlineImageRenderer: View {
    let text: String
    let imageStore: [String: NSImage]
    let clozeColor: String

    var body: some View {
        let segments = parseAndMergeContent()

        // Debug logging
        print("📊 InlineImageRenderer - Segments: \(segments.count)")
        for (index, segment) in segments.enumerated() {
            switch segment {
            case .text(let content):
                print("  [\(index)] Text: \(content.prefix(50))...")
            case .image(let uuid):
                let found = imageStore[uuid] != nil
                print("  [\(index)] Image: \(uuid.prefix(8))... (found: \(found))")
            }
        }
        print("📦 ImageStore has \(imageStore.count) images")

        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                switch segment {
                case .text(let content):
                    // Use wrapper with height tracking
                    TextSegmentView(
                        text: content,
                        clozeColor: clozeColor,
                        textColor: Color.black.opacity(0.8)
                    )
                case .image(let uuid):
                    if let image = imageStore[uuid] {
                        // Get image size and calculate appropriate display size
                        let imageSize = image.size
                        let maxWidth: CGFloat = 450   // Increased for readability
                        let maxHeight: CGFloat = 350  // Increased for readability

                        let widthRatio = maxWidth / imageSize.width
                        let heightRatio = maxHeight / imageSize.height
                        let scale = min(widthRatio, heightRatio, 1.0) // Don't upscale

                        let displayWidth = imageSize.width * scale
                        let displayHeight = imageSize.height * scale

                        Image(nsImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(width: displayWidth, height: displayHeight)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
                            )
                            .padding(.vertical, 8)
                    } else {
                        // Image not found in store - show placeholder
                        Text("[Image not loaded: \(uuid.prefix(8))...]")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                            .padding(8)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
        }
    }

    private enum ContentSegment {
        case text(String)
        case image(String) // UUID
    }

    // Parse content and merge consecutive text segments
    private func parseAndMergeContent() -> [ContentSegment] {
        let rawSegments = parseRawSegments()
        var mergedSegments: [ContentSegment] = []
        var accumulatedText = ""

        for segment in rawSegments {
            switch segment {
            case .text(let content):
                // Accumulate text
                accumulatedText += content
            case .image(let uuid):
                // Flush accumulated text before image
                if !accumulatedText.isEmpty {
                    mergedSegments.append(.text(accumulatedText))
                    accumulatedText = ""
                }
                // Add image
                mergedSegments.append(.image(uuid))
            }
        }

        // Flush any remaining text
        if !accumulatedText.isEmpty {
            mergedSegments.append(.text(accumulatedText))
        }

        return mergedSegments.isEmpty ? [.text(text)] : mergedSegments
    }

    private func parseRawSegments() -> [ContentSegment] {
        var segments: [ContentSegment] = []
        let pattern = "\\[image:([a-fA-F0-9\\-]+)\\]"

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return [.text(text)]
        }

        let nsString = text as NSString
        let range = NSRange(location: 0, length: nsString.length)
        let matches = regex.matches(in: text, options: [], range: range)

        var lastIndex = 0

        for match in matches {
            // Add text before the match
            if match.range.location > lastIndex {
                let textRange = NSRange(location: lastIndex, length: match.range.location - lastIndex)
                let textContent = nsString.substring(with: textRange)
                segments.append(.text(textContent))
            }

            // Add the image
            if match.numberOfRanges > 1 {
                let uuidRange = match.range(at: 1)
                let uuid = nsString.substring(with: uuidRange)
                segments.append(.image(uuid))
            }

            lastIndex = match.range.location + match.range.length
        }

        // Add any remaining text
        if lastIndex < nsString.length {
            let textRange = NSRange(location: lastIndex, length: nsString.length - lastIndex)
            let textContent = nsString.substring(with: textRange)
            segments.append(.text(textContent))
        }

        return segments
    }
}

// MARK: - Tag Creation

private struct TagCreationPopover: View {
    @Binding var tagDraft: String
    var onCancel: () -> Void
    var onCreate: (String) -> Void
    @FocusState private var isFieldFocused: Bool

    private var trimmedDraft: String {
        tagDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Create Tag")
                .font(.system(size: 14, weight: .bold))
                .kerning(0.28)

            TextField("Name", text: $tagDraft)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 13))
                .focused($isFieldFocused)
                .onSubmit(handleCreate)

            HStack(spacing: 8) {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                    .font(.system(size: 12))
                Button("Create") {
                    handleCreate()
                }
                .font(.system(size: 12, weight: .bold))
                .disabled(trimmedDraft.isEmpty)
            }
        }
        .padding(16)
        .frame(width: 240)
        .onAppear {
            DispatchQueue.main.async {
                isFieldFocused = true
            }
        }
    }

    private func handleCreate() {
        guard !trimmedDraft.isEmpty else { return }
        onCreate(trimmedDraft)
    }
}

private struct ChipMenuLabel: View {
    let iconName: String
    let text: String
    let isActive: Bool
    let accentColor: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: iconName)
                .font(.system(size: 12, weight: .semibold))

            Text(text)
                .font(OdysseyFont.labelTiny)
                .textCase(.uppercase)
                .tracking(0.3)
                .lineLimit(1)
        }
        .foregroundStyle(isActive ? accentColor : OdysseyColor.mutedText)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(isActive ? accentColor.opacity(0.15) : OdysseyColor.border.opacity(0.3))
        )
        .contentShape(Capsule())
    }
}

#Preview {
    CaptureView()
}
