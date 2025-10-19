import SwiftUI

struct CaptureView: View {
    @State private var question: String = ""
    @State private var answer: String = ""
    @State private var source: String = ""
    @State private var selectedDeck: String = "Default"
    @State private var isSubmitting: Bool = false
    @State private var showSuccess: Bool = false
    @State private var questionFocused: Bool = false
    @State private var answerFocused: Bool = false
    @State private var sourceFocused: Bool = false
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case question, answer, source
    }

    private var canSave: Bool {
        !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            OdysseyColor.canvas
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Question field
                    VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                        if focusedField == .question || !question.isEmpty {
                            Text("Question")
                                .font(OdysseyFont.dr(13, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        ZStack(alignment: .topLeading) {
                            if question.isEmpty {
                                Text("What do you want to remember?")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }

                            TextEditor(text: $question)
                                .font(OdysseyFont.dr(22))
                                .foregroundStyle(OdysseyColor.ink)
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .frame(minHeight: 100)
                                .focused($focusedField, equals: .question)
                        }

                        // Minimal focus underline
                        if focusedField == .question {
                            Rectangle()
                                .fill(OdysseyColor.accent)
                                .frame(height: 2)
                                .transition(.opacity)
                        } else {
                            Rectangle()
                                .fill(OdysseyColor.border.opacity(0.3))
                                .frame(height: 1)
                        }
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.xxxxl.value)
                    .animation(.easeInOut(duration: 0.25), value: focusedField)

                    // Answer field
                    VStack(alignment: .leading, spacing: OdysseySpacing.xs.value) {
                        if focusedField == .answer || !answer.isEmpty {
                            Text("Answer")
                                .font(OdysseyFont.dr(13, weight: .medium))
                                .foregroundStyle(OdysseyColor.mutedText)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        ZStack(alignment: .topLeading) {
                            if answer.isEmpty {
                                Text("The answer or key information to recall...")
                                    .font(OdysseyFont.dr(22))
                                    .foregroundStyle(OdysseyColor.mutedText.opacity(0.4))
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }

                            TextEditor(text: $answer)
                                .font(OdysseyFont.dr(22))
                                .foregroundStyle(OdysseyColor.ink)
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .frame(minHeight: 120)
                                .focused($focusedField, equals: .answer)
                        }

                        // Minimal focus underline
                        if focusedField == .answer {
                            Rectangle()
                                .fill(OdysseyColor.accent)
                                .frame(height: 2)
                                .transition(.opacity)
                        } else {
                            Rectangle()
                                .fill(OdysseyColor.border.opacity(0.3))
                                .frame(height: 1)
                        }
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.xxxxxl.value)
                    .animation(.easeInOut(duration: 0.25), value: focusedField)

                    // Source & Deck row
                    HStack(spacing: OdysseySpacing.lg.value) {
                        // Source field
                        HStack(spacing: OdysseySpacing.sm.value) {
                            Image(systemName: "link")
                                .font(.system(size: 14))
                                .foregroundStyle(OdysseyColor.mutedText.opacity(0.6))

                            TextField("Source (optional)", text: $source)
                                .textFieldStyle(.plain)
                                .font(OdysseyFont.dr(15))
                                .foregroundStyle(OdysseyColor.ink)
                                .focused($focusedField, equals: .source)
                        }
                        .padding(.horizontal, OdysseySpacing.md.value)
                        .padding(.vertical, OdysseySpacing.sm.value)
                        .background(
                            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                                .fill(focusedField == .source ? OdysseyColor.surface : OdysseyColor.surfaceSubtle)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: OdysseyRadius.md.value, style: .continuous)
                                .stroke(
                                    focusedField == .source ? OdysseyColor.accent.opacity(0.5) : Color.clear,
                                    lineWidth: 1
                                )
                        )

                        // Deck selector
                        Menu {
                            Button("Default") { selectedDeck = "Default" }
                            Button("FSRS Fundamentals") { selectedDeck = "FSRS Fundamentals" }
                            Button("Design Systems") { selectedDeck = "Design Systems" }
                            Button("Neural Nets") { selectedDeck = "Neural Nets" }
                        } label: {
                            HStack(spacing: OdysseySpacing.xs.value) {
                                Image(systemName: "folder")
                                    .font(.system(size: 13))
                                Text(selectedDeck)
                                    .font(OdysseyFont.dr(14, weight: .medium))
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(OdysseyColor.mutedText)
                            .padding(.horizontal, OdysseySpacing.md.value)
                            .padding(.vertical, OdysseySpacing.sm.value)
                            .background(
                                Capsule()
                                    .fill(OdysseyColor.surfaceSubtle)
                            )
                            .overlay(
                                Capsule()
                                    .stroke(OdysseyColor.border.opacity(0.6), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, OdysseySpacing.xxxxl.value)
                    .padding(.top, OdysseySpacing.xxxl.value)

                    Spacer(minLength: 120)
                }
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
            }

            // Floating save button (appears when both fields filled)
            if canSave {
                VStack {
                    Spacer()

                    Button(action: submit) {
                        HStack(spacing: OdysseySpacing.sm.value) {
                            if isSubmitting {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .controlSize(.small)
                                    .tint(OdysseyColor.white)
                                Text("Saving...")
                            } else {
                                Image(systemName: "checkmark")
                                Text("Save Card")
                            }
                        }
                        .font(OdysseyFont.dr(16, weight: .medium))
                        .foregroundStyle(OdysseyColor.white)
                        .padding(.horizontal, OdysseySpacing.xl.value)
                        .padding(.vertical, OdysseySpacing.md.value)
                        .background(
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [OdysseyColor.accent, OdysseyColor.accentHover],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                        )
                        .shadow(color: OdysseyColor.accent.opacity(0.4), radius: 20, y: 10)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSubmitting)
                    .keyboardShortcut(.return, modifiers: .command)
                }
                .padding(.bottom, OdysseySpacing.xl.value)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .animation(.spring(response: 0.5, dampingFraction: 0.7), value: canSave)
            }

            // Success overlay
            if showSuccess {
                SuccessOverlay()
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .onAppear {
            // Auto-focus question field
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                focusedField = .question
            }
        }
    }

    private func submit() {
        guard canSave, !isSubmitting else { return }

        isSubmitting = true

        // Simulate save
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            isSubmitting = false

            // Show success animation
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                showSuccess = true
            }

            // Clear fields after showing success
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                withAnimation {
                    showSuccess = false
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    question = ""
                    answer = ""
                    source = ""
                    focusedField = .question
                }
            }
        }
    }
}

// MARK: - Success Overlay

private struct SuccessOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.2)
                .ignoresSafeArea()

            VStack(spacing: OdysseySpacing.lg.value) {
                // Checkmark circle
                ZStack {
                    Circle()
                        .fill(OdysseyColor.accent)
                        .frame(width: 80, height: 80)
                        .shadow(color: OdysseyColor.accent.opacity(0.4), radius: 30, y: 15)

                    Image(systemName: "checkmark")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(OdysseyColor.white)
                }

                Text("Card Saved")
                    .font(OdysseyFont.dr(24, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)

                Text("Ready to capture another")
                    .font(OdysseyFont.dr(15))
                    .foregroundStyle(OdysseyColor.mutedText)
            }
            .padding(OdysseySpacing.xxxl.value)
            .background(
                RoundedRectangle(cornerRadius: OdysseyRadius.lg.value, style: .continuous)
                    .fill(OdysseyColor.surface)
            )
            .shadow(color: OdysseyColor.shadow.opacity(0.3), radius: 40, y: 20)
        }
    }
}

#Preview {
    CaptureView()
}
