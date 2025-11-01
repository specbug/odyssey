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

    private var totalCardsToday: Int {
        viewModel.totalScheduledToday
    }

    private var cardsDueToday: Int {
        viewModel.cardsDueToday + viewModel.newCardsToday + viewModel.learningCardsToday
    }

    private var cardsCompletedToday: Int {
        viewModel.reviewedToday
    }

    var body: some View {
        ZStack {
            OdysseyColor.canvas
                .ignoresSafeArea()

            if viewModel.isLoading {
                // Loading state
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Loading cards...")
                        .font(.system(size: 16))
                        .foregroundStyle(OdysseyColor.mutedText)
                }
            } else if let error = viewModel.error {
                // Error state
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundStyle(OdysseyColor.mutedText)
                    Text("Failed to load cards")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(OdysseyColor.ink)
                    Text(error.localizedDescription)
                        .font(.system(size: 14))
                        .foregroundStyle(OdysseyColor.mutedText)
                        .multilineTextAlignment(.center)
                    Button("Try Again") {
                        Task {
                            await viewModel.loadDueCardStats()
                            network = OrganicNetwork.generate(nodeCount: max(1, totalCardsToday))
                        }
                    }
                    .buttonStyle(OdysseyPrimaryButtonStyle())
                }
                .frame(maxWidth: 400)
                .padding()
            } else {
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

                    // Learn button or empty state message
                    if cardsDueToday > 0 {
                        learnButton
                            .padding(.bottom, OdysseySpacing.xxxl.value)
                    } else {
                        emptyStateMessage
                            .padding(.bottom, OdysseySpacing.xxxl.value)
                    }
                }
                .frame(maxWidth: 900)
                .padding(.horizontal, OdysseySpacing.xl.value)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.75).delay(0.2)) {
                animateIn = true
            }
        }
        .task {
            await viewModel.loadDueCardStats()
            // Update network node count based on total cards scheduled for today
            network = OrganicNetwork.generate(nodeCount: max(1, totalCardsToday))
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
            total: totalCardsToday,
            completed: cardsCompletedToday,
            network: network,
            size: 650
        )
        .frame(height: 650)
        .scaleEffect(animateIn ? 1.0 : 0.85)
        .opacity(animateIn ? 1.0 : 0.0)
    }

    private var statsDisplay: some View {
        VStack(spacing: 8) {
            // Total cards to review today (main count)
            Text("\(totalCardsToday)")
                .font(.system(size: 72, weight: .bold))
                .foregroundStyle(OdysseyColor.ink)

            // "cards to review today" label
            Text(totalCardsToday == 1 ? "card to review today" : "cards to review today")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(OdysseyColor.mutedText)

            // Show "X due" subtext if there are cards due
            if cardsDueToday > 0 {
                Text("\(cardsDueToday) due")
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
                Text(cardsCompletedToday > 0 ? "KEEP LEARNING" : "LEARN")
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

    private var emptyStateMessage: some View {
        VStack(spacing: 0) {
            Text("All caught up!")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(OdysseyColor.ink)

            Text("Nothing's due for review.")
                .font(.system(size: 14))
                .foregroundStyle(OdysseyColor.mutedText)
        }
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

        // Apply 3D projection to both endpoints
        let projectedFrom = OrganicNetwork.project3D(x: from.x, y: from.y, z: from.z)
        let projectedTo = OrganicNetwork.project3D(x: to.x, y: to.y, z: to.z)

        let startPoint = CGPoint(
            x: center.x + projectedFrom.x,
            y: center.y + projectedFrom.y
        )
        let endPoint = CGPoint(
            x: center.x + projectedTo.x,
            y: center.y + projectedTo.y
        )

        // Average depth for control points
        let avgScale = (projectedFrom.scale + projectedTo.scale) / 2
        let avgOpacity = (projectedFrom.opacity + projectedTo.opacity) / 2

        // Create curved path
        var path = Path()
        path.move(to: startPoint)
        path.addCurve(
            to: endPoint,
            control1: CGPoint(
                x: startPoint.x + pathway.controlPoint1.x * avgScale,
                y: startPoint.y + pathway.controlPoint1.y * avgScale
            ),
            control2: CGPoint(
                x: endPoint.x + pathway.controlPoint2.x * avgScale,
                y: endPoint.y + pathway.controlPoint2.y * avgScale
            )
        )

        // Draw pathway with electric cyan colors (with depth opacity)
        let baseOpacity = isActive ? 0.6 : 0.3
        let pathColor = isActive ?
            Color(red: 0, green: 0.8, blue: 1.0, opacity: baseOpacity * avgOpacity) :
            Color(red: 0.3, green: 0.35, blue: 0.45, opacity: baseOpacity * avgOpacity)

        context.stroke(
            path,
            with: .color(pathColor),
            lineWidth: (isActive ? 2.25 : 1.35) * avgScale
        )

        // Draw pulses along active pathways
        if isActive {
            for pulse in pathway.pulses {
                let adjustedProgress = (pulse.progress + time * 0.18).truncatingRemainder(dividingBy: 1.0)
                let point = bezierPoint(
                    start: startPoint,
                    control1: CGPoint(
                        x: startPoint.x + pathway.controlPoint1.x * avgScale,
                        y: startPoint.y + pathway.controlPoint1.y * avgScale
                    ),
                    control2: CGPoint(
                        x: endPoint.x + pathway.controlPoint2.x * avgScale,
                        y: endPoint.y + pathway.controlPoint2.y * avgScale
                    ),
                    end: endPoint,
                    t: adjustedProgress
                )

                let pulseSize: CGFloat = 2.975 * avgScale  // Scale pulse size with depth (15% smaller)
                let pulseOpacity = (1.0 - abs(adjustedProgress - 0.5) * 2) * avgOpacity  // Apply depth opacity

                // Outer electric glow (using pathway's XKCD color with depth)
                context.fill(
                    Circle().path(in: CGRect(
                        x: point.x - pulseSize * 2,
                        y: point.y - pulseSize * 2,
                        width: pulseSize * 4,
                        height: pulseSize * 4
                    )),
                    with: .color(pathway.color.opacity(pulseOpacity * 0.25))
                )

                // Bright colorful core (using pathway's XKCD color with depth)
                context.fill(
                    Circle().path(in: CGRect(
                        x: point.x - pulseSize / 2,
                        y: point.y - pulseSize / 2,
                        width: pulseSize,
                        height: pulseSize
                    )),
                    with: .color(pathway.color.opacity(pulseOpacity))
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
        // Apply 3D perspective projection
        let projected = OrganicNetwork.project3D(x: neuron.x, y: neuron.y, z: neuron.z)
        let position = CGPoint(
            x: center.x + projected.x,
            y: center.y + projected.y
        )

        let pulse = sin(time * 2 + neuron.phase) * 0.5 + 0.5
        // Subtle size variation based on neuron's phase
        let sizeVariation = neuron.size
        let baseSize: CGFloat = 16 + sizeVariation * 4
        // Apply perspective scaling to size
        let neuronSize = (baseSize + (isActive ? pulse * 3 : 0)) * projected.scale

        // Use depth-based opacity
        let depthOpacity = projected.opacity

        // Electric cyan outer glow for active neurons (with depth opacity)
        if isActive {
            let glowSize = neuronSize * 3
            context.fill(
                Circle().path(in: CGRect(
                    x: position.x - glowSize / 2,
                    y: position.y - glowSize / 2,
                    width: glowSize,
                    height: glowSize
                )),
                with: .color(Color(red: 0, green: 0.8, blue: 1.0, opacity: pulse * 0.15 * depthOpacity))
            )
        }

        // Middle ring with electric cyan (with depth opacity)
        let midSize = neuronSize * 1.8
        let midOpacity = (isActive ? 0.4 : 0.1) * depthOpacity
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

        // Outer circle (with depth opacity)
        let outerOpacity = (isActive ? 0.6 : 0.3) * depthOpacity
        let outerColor = isActive ?
            Color(red: 0.2, green: 0.6, blue: 1.0, opacity: outerOpacity) :
            Color(red: 0.35, green: 0.4, blue: 0.5, opacity: outerOpacity)

        context.fill(
            Circle().path(in: CGRect(
                x: position.x - neuronSize / 2,
                y: position.y - neuronSize / 2,
                width: neuronSize,
                height: neuronSize
            )),
            with: .color(outerColor)
        )

        // Inner core - bright electric cyan (with depth opacity)
        let coreSize = neuronSize * 0.5
        let coreOpacity = (isActive ? 0.9 : 0.5) * depthOpacity
        let coreColor = isActive ?
            Color(red: 0, green: 1.0, blue: 1.0, opacity: coreOpacity) :
            Color(red: 0.4, green: 0.45, blue: 0.55, opacity: coreOpacity)

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
    let z: CGFloat  // Depth coordinate for 3D visualization
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
    let color: Color  // XKCD color for electric pulses
}

struct OrganicNetwork {
    let neurons: [Neuron]
    let pathways: [Pathway]

    // Get a random vibrant XKCD color for electric pulses
    static func randomPulseColor() -> Color {
        // Sample from all XKCD colors
        let randomTheme = XKCDColors.all.randomElement()!
        return Color(hex: randomTheme.bg)
    }

    // Perspective projection: convert 3D coordinates to 2D with depth scaling
    static func project3D(x: CGFloat, y: CGFloat, z: CGFloat) -> (x: CGFloat, y: CGFloat, scale: CGFloat, opacity: CGFloat) {
        let focalLength: CGFloat = 700.0  // Distance from camera
        let scale = focalLength / (focalLength + z)

        // Calculate opacity based on depth (closer = more opaque)
        // Map z from [-182, 182] to opacity [0.4, 1.0]
        let normalizedZ = (z + 182) / 364  // 0 to 1
        let opacity = 0.4 + (normalizedZ * 0.6)

        return (x: x * scale, y: y * scale, scale: scale, opacity: opacity)
    }

    // Apply repulsion forces to prevent node overlap (3D version using Coulomb's Law)
    static func applyRepulsionForces(to neurons: inout [Neuron], iterations: Int = 120) {
        let minSeparation: CGFloat = 55.0  // Minimum distance between node centers
        let repulsionStrength: CGFloat = 8000.0  // Coulomb constant (k)
        let damping: CGFloat = 0.8

        for _ in 0..<iterations {
            var adjustments: [(dx: CGFloat, dy: CGFloat, dz: CGFloat)] = Array(repeating: (0, 0, 0), count: neurons.count)

            // Calculate repulsion forces between all pairs (3D) using Coulomb's Law
            for i in 0..<neurons.count {
                for j in (i+1)..<neurons.count {
                    let dx = neurons[j].x - neurons[i].x
                    let dy = neurons[j].y - neurons[i].y
                    let dz = neurons[j].z - neurons[i].z
                    let distance = sqrt(dx * dx + dy * dy + dz * dz)

                    // Use minimum distance to prevent infinite forces
                    let effectiveDistance = max(distance, minSeparation / 2)

                    if distance < minSeparation * 2.0 {
                        // Coulomb's Law: F = k / r²
                        let force = repulsionStrength / (effectiveDistance * effectiveDistance)
                        let fx = (dx / effectiveDistance) * force
                        let fy = (dy / effectiveDistance) * force
                        let fz = (dz / effectiveDistance) * force

                        // Apply force to both neurons (Newton's third law)
                        adjustments[i].dx -= fx
                        adjustments[i].dy -= fy
                        adjustments[i].dz -= fz
                        adjustments[j].dx += fx
                        adjustments[j].dy += fy
                        adjustments[j].dz += fz
                    }
                }
            }

            // Apply adjustments with damping
            for i in 0..<neurons.count {
                neurons[i] = Neuron(
                    x: neurons[i].x + adjustments[i].dx * damping,
                    y: neurons[i].y + adjustments[i].dy * damping,
                    z: neurons[i].z + adjustments[i].dz * damping,
                    phase: neurons[i].phase,
                    size: neurons[i].size
                )
            }
        }
    }

    static func generate(nodeCount: Int) -> OrganicNetwork {
        var neurons: [Neuron] = []

        // 3D ellipsoidal distribution (brain-like shape)
        let radiusX: CGFloat = 260  // Width (30% larger)
        let radiusY: CGFloat = 234  // Height (slightly shorter, 30% larger)
        let radiusZ: CGFloat = 182  // Depth (most compressed for brain shape, 30% larger)

        // Generate neurons in 3D spherical distribution
        for i in 0..<nodeCount {
            // Use golden ratio spiral for even distribution on sphere
            let goldenRatio = (1 + sqrt(5)) / 2
            let theta = 2 * .pi * Double(i) / goldenRatio  // Azimuthal angle
            let phi = acos(1 - 2 * (Double(i) + 0.5) / Double(nodeCount))  // Polar angle

            // Variable distance for organic clustering
            let distanceVariation = Double.random(in: 0.6...1.0)

            // Convert spherical to Cartesian with ellipsoidal shape
            let x = radiusX * sin(phi) * cos(theta) * distanceVariation
            let y = radiusY * sin(phi) * sin(theta) * distanceVariation
            let z = radiusZ * cos(phi) * distanceVariation

            // Add random jitter for organic feel
            let xJitter = Double.random(in: -25...25)
            let yJitter = Double.random(in: -25...25)
            let zJitter = Double.random(in: -20...20)

            neurons.append(Neuron(
                x: x + xJitter,
                y: y + yJitter,
                z: z + zJitter,
                phase: Double.random(in: 0...(2 * .pi)),
                size: CGFloat.random(in: 0...1)
            ))
        }

        // Apply repulsion forces to prevent overlap
        applyRepulsionForces(to: &neurons)

        // Generate pathways with reduced density
        var pathways: [Pathway] = []
        var connections: Set<String> = []

        // Only generate connections if there are at least 2 nodes
        if nodeCount > 1 {
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
                    pulses: pulses,
                    color: randomPulseColor()
                ))
            }
        }
        }  // End of nodeCount > 1 check

        // Sort neurons by z-depth (back to front) for proper rendering
        neurons.sort { $0.z < $1.z }

        return OrganicNetwork(neurons: neurons, pathways: pathways)
    }
}

#Preview {
    StudyView()
}
