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

    private var dividerColor: Color {
        OdysseyColor.browseColors[3]
    }

    private var chipBackground: Color {
        Color(red: 240.0 / 255.0, green: 241.0 / 255.0, blue: 243.0 / 255.0)
    }

    private var chipBorder: Color {
        Color(red: 210.0 / 255.0, green: 211.0 / 255.0, blue: 213.0 / 255.0)
    }

    private var chipPrimary: Color {
        OdysseyColor.ink
    }

    private var chipSecondary: Color {
        OdysseyColor.mutedText.opacity(0.7)
    }

    private var saveGradient: LinearGradient {
        LinearGradient(
            colors: [OdysseyColor.accent, OdysseyColor.accentHover],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var successGradient: LinearGradient {
        LinearGradient(
            colors: [
                OdysseyColor.browseColors[6],
                OdysseyColor.browseColors[5]
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var tagDisplayText: String {
        tag.isEmpty ? "Tag" : tag
    }

    var body: some View {
        ZStack {
            OdysseyColor.canvas
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Preview/Edit Toggle Button
                    HStack {
                        Spacer()
                        Button(action: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                isPreviewMode.toggle()
                            }
                        }) {
                            ZStack {
                                // Background circle
                                Circle()
                                    .fill(isPreviewMode ? OdysseyColor.accent.opacity(0.12) : OdysseyColor.mutedText.opacity(0.08))
                                    .frame(width: 32, height: 32)

                                // Icon
                                Image(systemName: isPreviewMode ? "pencil.line" : "eye.fill")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(isPreviewMode ? OdysseyColor.accent : OdysseyColor.mutedText.opacity(0.7))
                            }
                        }
                        .buttonStyle(.plain)
                        .help(isPreviewMode ? "Edit" : "Preview")
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.md.value)

                    // Primary text field
                    VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                        if isPreviewMode {
                            // Preview mode - render LaTeX, cloze, and images inline
                            if !primaryText.isEmpty {
                                InlineImageRenderer(
                                    text: primaryText,
                                    imageStore: imageStore,
                                    clozeColor: "rgba(114, 174, 248, 0.35)"
                                )
                                .frame(minHeight: 110, alignment: .topLeading)
                            } else {
                                Text("Add the thought you want to keep...")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 4)
                                    .frame(minHeight: 110, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor with image markers
                            ZStack(alignment: .topLeading) {
                                if primaryText.isEmpty {
                                    Text("Add the thought you want to keep...")
                                        .font(OdysseyFont.dr(22))
                                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                        .padding(.top, 4)
                                        .padding(.leading, 2)
                                        .allowsHitTesting(false)
                                }

                                LatexTextEditor(
                                    text: $primaryText,
                                    placeholder: "Add the thought you want to keep...",
                                    font: NSFont(name: "Dr", size: 22) ?? NSFont.systemFont(ofSize: 22),
                                    textColor: NSColor(OdysseyColor.ink),
                                    latexColor: NSColor(OdysseyColor.browseColors[0]),
                                    clozeColor: NSColor(OdysseyColor.browseColors[3]),
                                    heightBinding: $primaryTextHeight,
                                    onImagePasted: { image, uuid in
                                        imageStore[uuid] = image
                                    }
                                )
                                .frame(height: max(primaryTextHeight, 110), alignment: .topLeading)
                            }
                        }

                        Rectangle()
                            .fill(dividerColor)
                            .frame(height: 2)
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.md.value)

                    // Secondary text field
                    VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                        if isPreviewMode {
                            // Preview mode - render LaTeX, cloze, and images inline
                            if !secondaryText.isEmpty {
                                InlineImageRenderer(
                                    text: secondaryText,
                                    imageStore: imageStore,
                                    clozeColor: "rgba(114, 174, 248, 0.35)"
                                )
                                .frame(minHeight: 140, alignment: .topLeading)
                            } else {
                                Text("Remember forever...")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 4)
                                    .frame(minHeight: 140, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor with image markers
                            ZStack(alignment: .topLeading) {
                                if secondaryText.isEmpty {
                                    Text("Remember forever...")
                                        .font(OdysseyFont.dr(22))
                                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                        .padding(.top, 4)
                                        .padding(.leading, 2)
                                        .allowsHitTesting(false)
                                }

                                LatexTextEditor(
                                    text: $secondaryText,
                                    placeholder: "Remember forever...",
                                    font: NSFont(name: "Dr", size: 22) ?? NSFont.systemFont(ofSize: 22),
                                    textColor: NSColor(OdysseyColor.ink),
                                    latexColor: NSColor(OdysseyColor.browseColors[0]),
                                    clozeColor: NSColor(OdysseyColor.browseColors[3]),
                                    heightBinding: $secondaryTextHeight,
                                    onImagePasted: { image, uuid in
                                        imageStore[uuid] = image
                                    }
                                )
                                .frame(height: max(secondaryTextHeight, 140), alignment: .topLeading)
                            }
                        }

                        Rectangle()
                            .fill(OdysseyColor.border.opacity(0.35))
                            .frame(height: 1)
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.xxxxxl.value)

                    // Source, Tag & Deck row
                    HStack(spacing: OdysseySpacing.md.value) {
                        // Source field
                        HStack(spacing: OdysseySpacing.sm.value) {
                            Image(systemName: "link")
                                .font(.system(size: 13))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.65))

                            ZStack(alignment: .leading) {
                                if source.isEmpty {
                                    Text("Source")
                                        .font(.system(size: 15))
                                        .foregroundStyle(OdysseyColor.mutedText.opacity(0.5))
                                }

                                TextField("", text: $source)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 15))
                                    .foregroundStyle(OdysseyColor.ink)
                                    .focused($focusedField, equals: .source)
                            }
                        }
                        .padding(.horizontal, OdysseySpacing.md.value)
                        .padding(.vertical, OdysseySpacing.sm.value)
                        .background(
                            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                                .fill(chipBackground)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                                .stroke(
                                    focusedField == .source ? OdysseyColor.accent.opacity(0.45) : Color.clear,
                                    lineWidth: 1
                                )
                        )
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
                                iconName: "tag.fill",
                                text: tagDisplayText,
                                isPlaceholder: tag.isEmpty,
                                background: chipBackground,
                                border: chipBorder,
                                iconColor: chipSecondary,
                                textColor: chipPrimary,
                                placeholderColor: chipSecondary.opacity(0.6),
                                minWidth: 160
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
                                iconName: "folder.fill",
                                text: selectedDeck,
                                isPlaceholder: false,
                                background: chipBackground,
                                border: chipBorder,
                                iconColor: chipSecondary,
                                textColor: chipPrimary,
                                placeholderColor: chipSecondary,
                                minWidth: 190
                            )
                        }
                        .buttonStyle(.plain)

                        Button(action: submit) {
                            ZStack {
                                if isSubmitting {
                                    ProgressView()
                                        .progressViewStyle(.circular)
                                        .controlSize(.small)
                                        .tint(OdysseyColor.white)
                                } else {
                                    Image(systemName: "square.and.arrow.down")
                                        .font(.system(size: 18, weight: .semibold))
                                }
                            }
                            .frame(width: 44, height: 44)
                            .background(
                                Circle()
                                    .fill(
                                        showSuccessFlash ? successGradient :
                                        (canSave ? saveGradient : LinearGradient(colors: [chipBackground, chipBackground], startPoint: .top, endPoint: .bottom))
                                    )
                            )
                            .overlay(
                                Circle()
                                    .stroke(
                                        !canSave && !showSuccessFlash ? chipBorder : Color.clear,
                                        lineWidth: 1
                                    )
                            )
                            .foregroundStyle((canSave || showSuccessFlash) ? OdysseyColor.white : chipSecondary)
                        }
                        .buttonStyle(.plain)
                        .disabled(!canSave || isSubmitting || showSuccessFlash)
                        .animation(.easeInOut(duration: 0.2), value: canSave)
                        .animation(.easeInOut(duration: 0.2), value: showSuccessFlash)
                        .accessibilityLabel("Save Card")
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.xxxl.value)

                    Spacer(minLength: 120)
                }
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
            }

            // Error banner
            if let errorMessage = errorMessage {
                VStack {
                    Spacer()
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.white)
                        Text(errorMessage)
                            .foregroundColor(.white)
                            .font(.system(size: 13))
                        Spacer()
                        Button(action: { self.errorMessage = nil }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.white.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding()
                    .background(Color.red.opacity(0.9))
                    .cornerRadius(8)
                    .padding()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.easeInOut(duration: 0.3), value: errorMessage)
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
    @State private var contentHeight: CGFloat = 100

    var body: some View {
        LatexRenderView(
            text: text,
            clozeColor: clozeColor,
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
                        clozeColor: clozeColor
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
                            .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(OdysseyColor.border.opacity(0.2), lineWidth: 1)
                            )
                            .padding(.vertical, 4)
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
        VStack(alignment: .leading, spacing: OdysseySpacing.sm.value) {
            Text("Create Tag")
                .font(.system(size: 15, weight: .semibold))

            TextField("Name", text: $tagDraft)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 14))
                .focused($isFieldFocused)
                .onSubmit(handleCreate)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                    .font(.system(size: 13))
                Button("Create") {
                    handleCreate()
                }
                .font(.system(size: 13, weight: .semibold))
                .disabled(trimmedDraft.isEmpty)
            }
        }
        .padding(OdysseySpacing.md.value)
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
    let isPlaceholder: Bool
    let background: Color
    let border: Color
    let iconColor: Color
    let textColor: Color
    let placeholderColor: Color
    let minWidth: CGFloat

    var body: some View {
        HStack(spacing: OdysseySpacing.xs.value) {
            Image(systemName: iconName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(iconColor)

            Text(text)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isPlaceholder ? placeholderColor : textColor)
                .lineLimit(1)

            Spacer(minLength: 0)

            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(iconColor)
        }
        .padding(.horizontal, OdysseySpacing.md.value)
        .padding(.vertical, OdysseySpacing.sm.value)
        .frame(minWidth: minWidth, alignment: .leading)
        .background(
            Capsule()
                .fill(background)
        )
        .overlay(
            Capsule()
                .stroke(border, lineWidth: 1)
        )
        .contentShape(Capsule())
        .fixedSize(horizontal: true, vertical: false)
    }
}

#Preview {
    CaptureView()
}
