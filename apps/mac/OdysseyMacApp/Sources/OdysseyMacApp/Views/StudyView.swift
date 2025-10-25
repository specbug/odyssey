import SwiftUI

struct StudyView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: StudyViewModel
    @State private var showStudySession: Bool = false
    @State private var network: OrganicNetwork = OrganicNetwork.generate(nodeCount: 12)
    @State private var animateIn: Bool = false

    init(viewModel: StudyViewModel? = nil) {
        if let viewModel = viewModel {
            _viewModel = StateObject(wrappedValue: viewModel)
        } else {
            // This will be replaced when the view is created with the actual backend
            _viewModel = StateObject(wrappedValue: StudyViewModel(backend: Backend()))
        }
    }

    private var cardsDueToday: Int {
        viewModel.cardsDueToday + viewModel.newCardsToday + viewModel.learningCardsToday
    }

    private var cardsCompletedToday: Int {
        viewModel.cardsCompletedToday
    }

    var body: some View {
        ZStack {
            OdysseyColor.canvas
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Subtle header with time
                headerView
                    .padding(.top, OdysseySpacing.xxxl.value)

                Spacer()

                // Organic network visualization
                networkVisualization

                Spacer()

                // Stats display
                statsDisplay
                    .padding(.bottom, OdysseySpacing.xxxl.value)

                // Learn button
                learnButton
                    .padding(.bottom, OdysseySpacing.xxxl.value)
            }
            .frame(maxWidth: 700)
            .padding(.horizontal, OdysseySpacing.xl.value)
        }
        .onAppear {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.75).delay(0.2)) {
                animateIn = true
            }
        }
        .task {
            await viewModel.loadDueCardStats()
            // Update network node count based on actual cards
            network = OrganicNetwork.generate(nodeCount: max(1, cardsDueToday))
        }
    }

    private var headerView: some View {
        HStack {
            Text(currentTimeString)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText)
            Spacer()
        }
        .opacity(animateIn ? 1.0 : 0.0)
    }

    private var currentTimeString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    private var networkVisualization: some View {
        OrganicNetworkView(
            total: cardsDueToday,
            completed: cardsCompletedToday,
            network: network,
            size: 450
        )
        .frame(height: 500)
        .scaleEffect(animateIn ? 1.0 : 0.85)
        .opacity(animateIn ? 1.0 : 0.0)
    }

    private var statsDisplay: some View {
        VStack(spacing: OdysseySpacing.md.value) {
            // Cards due
            HStack(alignment: .firstTextBaseline, spacing: OdysseySpacing.sm.value) {
                Text("\(cardsDueToday)")
                    .font(.system(size: 72, weight: .bold))
                    .foregroundStyle(OdysseyColor.ink)

                Text(cardsDueToday == 1 ? "card due" : "cards due")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(OdysseyColor.mutedText)
            }

            // Cards completed
            if cardsCompletedToday > 0 {
                Text("\(cardsCompletedToday) completed today")
                    .font(.system(size: 16))
                    .foregroundStyle(OdysseyColor.mutedText)
            }
        }
        .opacity(animateIn ? 1.0 : 0.0)
        .animation(.easeOut(duration: 0.6).delay(0.4), value: animateIn)
    }

    private var learnButton: some View {
        Button {
            appState.isInStudySession = true
        } label: {
            HStack(spacing: OdysseySpacing.sm.value) {
                Text(cardsCompletedToday > 0 ? "Keep Learning" : "Learn")
                    .font(.system(size: 18, weight: .semibold))
                Image(systemName: "arrow.right")
                    .font(.system(size: 16, weight: .semibold))
            }
            .frame(minWidth: 240)
        }
        .buttonStyle(OdysseyPrimaryButtonStyle())
        .opacity(animateIn ? 1.0 : 0.0)
        .animation(.easeOut(duration: 0.6).delay(0.6), value: animateIn)
    }
}

// MARK: - Organic Network Visualization

struct OrganicNetworkView: View {
    let total: Int
    let completed: Int
    let network: OrganicNetwork
    let size: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60)) { timeline in
            Canvas { context, canvasSize in
                let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                let time = timeline.date.timeIntervalSinceReferenceDate

                // Draw pathways first (background)
                for pathway in network.pathways {
                    drawPathway(
                        context: context,
                        pathway: pathway,
                        center: center,
                        time: time,
                        isActive: pathway.fromIndex < completed || pathway.toIndex < completed
                    )
                }

                // Draw neurons on top
                for (index, neuron) in network.neurons.enumerated() {
                    drawNeuron(
                        context: context,
                        neuron: neuron,
                        center: center,
                        time: time,
                        isActive: index < completed
                    )
                }
            }
            .frame(width: size, height: size)
        }
    }

    private func drawPathway(
        context: GraphicsContext,
        pathway: Pathway,
        center: CGPoint,
        time: Double,
        isActive: Bool
    ) {
        let from = network.neurons[pathway.fromIndex]
        let to = network.neurons[pathway.toIndex]

        let startPoint = CGPoint(
            x: center.x + from.x,
            y: center.y + from.y
        )
        let endPoint = CGPoint(
            x: center.x + to.x,
            y: center.y + to.y
        )

        // Create curved path
        var path = Path()
        path.move(to: startPoint)
        path.addCurve(
            to: endPoint,
            control1: CGPoint(
                x: startPoint.x + pathway.controlPoint1.x,
                y: startPoint.y + pathway.controlPoint1.y
            ),
            control2: CGPoint(
                x: endPoint.x + pathway.controlPoint2.x,
                y: endPoint.y + pathway.controlPoint2.y
            )
        )

        // Draw pathway with electric cyan colors
        let pathColor = isActive ?
            Color(red: 0, green: 0.8, blue: 1.0, opacity: 0.6) :
            Color(red: 0.3, green: 0.35, blue: 0.45, opacity: 0.3)

        context.stroke(
            path,
            with: .color(pathColor),
            lineWidth: isActive ? 2.5 : 1.5
        )

        // Draw pulses along active pathways
        if isActive {
            for pulse in pathway.pulses {
                let adjustedProgress = (pulse.progress + time * 0.18).truncatingRemainder(dividingBy: 1.0)
                let point = bezierPoint(
                    start: startPoint,
                    control1: CGPoint(
                        x: startPoint.x + pathway.controlPoint1.x,
                        y: startPoint.y + pathway.controlPoint1.y
                    ),
                    control2: CGPoint(
                        x: endPoint.x + pathway.controlPoint2.x,
                        y: endPoint.y + pathway.controlPoint2.y
                    ),
                    end: endPoint,
                    t: adjustedProgress
                )

                let pulseSize: CGFloat = 3.5
                let pulseOpacity = 1.0 - abs(adjustedProgress - 0.5) * 2

                // Outer electric glow
                context.fill(
                    Circle().path(in: CGRect(
                        x: point.x - pulseSize * 2,
                        y: point.y - pulseSize * 2,
                        width: pulseSize * 4,
                        height: pulseSize * 4
                    )),
                    with: .color(Color(red: 0, green: 0.8, blue: 1.0, opacity: pulseOpacity * 0.25))
                )

                // Bright cyan core
                context.fill(
                    Circle().path(in: CGRect(
                        x: point.x - pulseSize / 2,
                        y: point.y - pulseSize / 2,
                        width: pulseSize,
                        height: pulseSize
                    )),
                    with: .color(Color(red: 0, green: 1.0, blue: 1.0, opacity: pulseOpacity))
                )
            }
        }
    }

    private func drawNeuron(
        context: GraphicsContext,
        neuron: Neuron,
        center: CGPoint,
        time: Double,
        isActive: Bool
    ) {
        let position = CGPoint(
            x: center.x + neuron.x,
            y: center.y + neuron.y
        )

        let pulse = sin(time * 2 + neuron.phase) * 0.5 + 0.5
        // Subtle size variation based on neuron's phase
        let sizeVariation = neuron.size
        let baseSize: CGFloat = 16 + sizeVariation * 4
        let neuronSize = baseSize + (isActive ? pulse * 3 : 0)

        // Electric cyan outer glow for active neurons
        if isActive {
            let glowSize = neuronSize * 3
            context.fill(
                Circle().path(in: CGRect(
                    x: position.x - glowSize / 2,
                    y: position.y - glowSize / 2,
                    width: glowSize,
                    height: glowSize
                )),
                with: .color(Color(red: 0, green: 0.8, blue: 1.0, opacity: pulse * 0.15))
            )
        }

        // Middle ring with electric cyan
        let midSize = neuronSize * 1.8
        let midOpacity = isActive ? 0.4 : 0.1
        context.fill(
            Circle().path(in: CGRect(
                x: position.x - midSize / 2,
                y: position.y - midSize / 2,
                width: midSize,
                height: midSize
            )),
            with: .color(isActive ?
                Color(red: 0, green: 0.8, blue: 1.0, opacity: midOpacity) :
                Color(red: 0.35, green: 0.4, blue: 0.5, opacity: midOpacity)
            )
        )

        // Outer circle
        let outerColor = isActive ?
            Color(red: 0.2, green: 0.6, blue: 1.0, opacity: 0.6) :
            Color(red: 0.35, green: 0.4, blue: 0.5, opacity: 0.3)

        context.fill(
            Circle().path(in: CGRect(
                x: position.x - neuronSize / 2,
                y: position.y - neuronSize / 2,
                width: neuronSize,
                height: neuronSize
            )),
            with: .color(outerColor)
        )

        // Inner core - bright electric cyan
        let coreSize = neuronSize * 0.5
        let coreColor = isActive ?
            Color(red: 0, green: 1.0, blue: 1.0, opacity: 0.9) :
            Color(red: 0.4, green: 0.45, blue: 0.55, opacity: 0.5)

        context.fill(
            Circle().path(in: CGRect(
                x: position.x - coreSize / 2,
                y: position.y - coreSize / 2,
                width: coreSize,
                height: coreSize
            )),
            with: .color(coreColor)
        )
    }

    private func bezierPoint(
        start: CGPoint,
        control1: CGPoint,
        control2: CGPoint,
        end: CGPoint,
        t: Double
    ) -> CGPoint {
        let t2 = t * t
        let t3 = t2 * t
        let mt = 1 - t
        let mt2 = mt * mt
        let mt3 = mt2 * mt

        return CGPoint(
            x: mt3 * start.x + 3 * mt2 * t * control1.x + 3 * mt * t2 * control2.x + t3 * end.x,
            y: mt3 * start.y + 3 * mt2 * t * control1.y + 3 * mt * t2 * control2.y + t3 * end.y
        )
    }
}

// MARK: - Circular Progress Indicator

struct CircularProgressIndicator: View {
    let total: Int
    let completed: Int
    @State private var glowPulse: Bool = false

    private var progress: Double {
        guard total > 0 else { return 0 }
        return Double(completed) / Double(total)
    }

    private var percentage: Int {
        Int(progress * 100)
    }

    var body: some View {
        // Subtle percentage text with gentle glow pulse
        if completed > 0 {
            Text("\(percentage)%")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(Color(red: 0, green: 0.85, blue: 1.0))
                .shadow(color: Color(red: 0, green: 0.8, blue: 1.0).opacity(glowPulse ? 0.5 : 0.3), radius: glowPulse ? 12 : 8)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                        glowPulse = true
                    }
                }
        }
    }
}

// MARK: - Data Models

struct Neuron {
    let x: CGFloat
    let y: CGFloat
    let phase: Double
    let size: CGFloat  // Subtle size variation (0.0 to 1.0)
}

struct Pulse {
    let progress: Double
}

struct Pathway {
    let fromIndex: Int
    let toIndex: Int
    let controlPoint1: CGPoint
    let controlPoint2: CGPoint
    let pulses: [Pulse]
}

struct OrganicNetwork {
    let neurons: [Neuron]
    let pathways: [Pathway]

    static func generate(nodeCount: Int) -> OrganicNetwork {
        var neurons: [Neuron] = []
        let radius: CGFloat = 195  // Increased for more spacing

        // Generate neurons with more organic spread
        for i in 0..<nodeCount {
            let angle = Double(i) * (2 * .pi / Double(nodeCount)) + Double.random(in: -0.4...0.4)
            // Variable distance creates more organic clustering
            let distanceVariation = Double.random(in: 0...1)
            let distance = radius * (0.6 + distanceVariation * 0.4)

            // Asymmetric bias for more natural positioning
            let xBias = Double.random(in: -35...35)
            let yBias = Double.random(in: -35...35)

            neurons.append(Neuron(
                x: cos(angle) * distance + xBias,
                y: sin(angle) * distance + yBias,
                phase: Double.random(in: 0...(2 * .pi)),
                size: CGFloat.random(in: 0...1)
            ))
        }

        // Generate pathways with reduced density
        var pathways: [Pathway] = []
        var connections: Set<String> = []

        for i in 0..<nodeCount {
            let connectionCount = Int.random(in: 1...3)  // Reduced from 2-4

            for _ in 0..<connectionCount {
                var targetIndex = Int.random(in: 0..<nodeCount)
                while targetIndex == i {
                    targetIndex = Int.random(in: 0..<nodeCount)
                }

                let connectionKey = "\(min(i, targetIndex))-\(max(i, targetIndex))"
                if connections.contains(connectionKey) {
                    continue
                }
                connections.insert(connectionKey)

                let from = neurons[i]
                let to = neurons[targetIndex]

                let midX = (to.x - from.x) / 2
                let midY = (to.y - from.y) / 2
                let perpX = -midY
                let perpY = midX

                // More organic, dendrite-like curves with asymmetry
                let curvature1 = Double.random(in: 0.2...0.5)
                let curvature2 = Double.random(in: 0.2...0.5)
                let cp1Offset = Double.random(in: 0.3...0.6)
                let cp2Offset = Double.random(in: 0.4...0.7)

                let cp1 = CGPoint(
                    x: midX * cp1Offset + perpX * curvature1 + Double.random(in: -15...15),
                    y: midY * cp1Offset + perpY * curvature1 + Double.random(in: -15...15)
                )
                let cp2 = CGPoint(
                    x: midX * cp2Offset - perpX * curvature2 + Double.random(in: -15...15),
                    y: midY * cp2Offset - perpY * curvature2 + Double.random(in: -15...15)
                )

                // Fewer pulses per pathway
                var pulses: [Pulse] = []
                let pulseCount = Int.random(in: 1...2)  // Reduced from 2-4
                for j in 0..<pulseCount {
                    pulses.append(Pulse(
                        progress: Double(j) / Double(pulseCount)
                    ))
                }

                pathways.append(Pathway(
                    fromIndex: i,
                    toIndex: targetIndex,
                    controlPoint1: cp1,
                    controlPoint2: cp2,
                    pulses: pulses
                ))
            }
        }

        return OrganicNetwork(neurons: neurons, pathways: pathways)
    }
}

#Preview {
    StudyView()
}
