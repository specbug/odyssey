import SwiftUI

/// Timeline visualization showing spaced repetition intervals
struct TimelineVisualizationView: View {
    let intervals: [IntervalInfo]?
    let isLoading: Bool
    let foregroundColor: Color

    struct IntervalInfo {
        let intervalText: String
    }

    var body: some View {
        HStack(spacing: 16) {
            if isLoading || intervals == nil {
                // Loading state - show 4 placeholder dots
                ForEach(0..<4, id: \.self) { _ in
                    loadingDot
                }
            } else if let intervals = intervals {
                // Active state - show actual intervals
                ForEach(Array(intervals.enumerated()), id: \.offset) { index, interval in
                    intervalDot(text: interval.intervalText)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var loadingDot: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(foregroundColor.opacity(0.2))
                .frame(width: 8, height: 8)

            Rectangle()
                .fill(foregroundColor.opacity(0.15))
                .frame(width: 20, height: 8)
                .cornerRadius(2)
        }
        .opacity(0.5)
    }

    private func intervalDot(text: String) -> some View {
        VStack(spacing: 6) {
            // Dot marker
            Circle()
                .fill(foregroundColor.opacity(0.7))
                .frame(width: 8, height: 8)

            // Interval label
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(foregroundColor.opacity(0.8))
                .lineLimit(1)
        }
    }
}

#Preview("Loading State") {
    ZStack {
        Color.black
            .ignoresSafeArea()

        TimelineVisualizationView(
            intervals: nil,
            isLoading: true,
            foregroundColor: .white
        )
    }
}

#Preview("Active State") {
    ZStack {
        Color(hex: "#3778BF")
            .ignoresSafeArea()

        TimelineVisualizationView(
            intervals: [
                .init(intervalText: "10m"),
                .init(intervalText: "1d"),
                .init(intervalText: "3d"),
                .init(intervalText: "1w")
            ],
            isLoading: false,
            foregroundColor: .white
        )
    }
}
