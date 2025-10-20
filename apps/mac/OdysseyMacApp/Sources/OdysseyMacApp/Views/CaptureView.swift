import SwiftUI

struct CaptureView: View {
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
                            // Preview mode - render LaTeX and cloze
                            if !primaryText.isEmpty {
                                LatexRenderView(text: primaryText, clozeColor: "rgba(114, 174, 248, 0.35)", heightBinding: $primaryTextHeight)
                                    .frame(height: max(primaryTextHeight, 110), alignment: .topLeading)
                            } else {
                                Text("Add the thought you want to keep...")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 4)
                                    .frame(minHeight: 110, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor
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
                                    heightBinding: $primaryTextHeight
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
                            // Preview mode - render LaTeX and cloze
                            if !secondaryText.isEmpty {
                                LatexRenderView(text: secondaryText, clozeColor: "rgba(114, 174, 248, 0.35)", heightBinding: $secondaryTextHeight)
                                    .frame(height: max(secondaryTextHeight, 140), alignment: .topLeading)
                            } else {
                                Text("Remember forever...")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 4)
                                    .frame(minHeight: 140, alignment: .topLeading)
                            }
                        } else {
                            // Edit mode - show syntax-highlighted editor
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
                                    heightBinding: $secondaryTextHeight
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

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            isSubmitting = false

            withAnimation(.easeInOut(duration: 0.25)) {
                showSuccessFlash = true
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                primaryText = ""
                secondaryText = ""
                source = ""
                tag = ""

                withAnimation(.easeInOut(duration: 0.25)) {
                    showSuccessFlash = false
                }

                focusedField = .primary
            }
        }
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
