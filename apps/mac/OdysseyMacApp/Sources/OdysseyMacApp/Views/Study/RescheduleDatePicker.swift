import SwiftUI

/// Elegant date picker for rescheduling cards
struct RescheduleDatePicker: View {
    @Binding var selectedDate: Date
    @Binding var isPresented: Bool
    let onConfirm: (Date) -> Void

    @State private var displayedMonth: Date = Date()
    @State private var tempSelectedDate: Date = Date()

    private let calendar = Calendar.current

    var body: some View {
        VStack(spacing: 0) {
            // Header with month/year and navigation
            header

            Divider()
                .padding(.vertical, 12)

            // Calendar grid
            calendarGrid
                .padding(.horizontal, 16)

            Divider()
                .padding(.vertical, 12)

            // Action buttons
            actions
        }
        .padding(20)
        .frame(width: 320)
        .background(Color(NSColor.windowBackgroundColor))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 0, y: 8)
        .onAppear {
            tempSelectedDate = selectedDate
            displayedMonth = selectedDate
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            // Previous month
            Button(action: previousMonth) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
            }
            .buttonStyle(.plain)

            Spacer()

            // Month and year
            VStack(spacing: 2) {
                Text(monthYearString)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
            }

            Spacer()

            // Next month
            Button(action: nextMonth) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(OdysseyColor.ink)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Calendar Grid

    private var calendarGrid: some View {
        VStack(spacing: 8) {
            // Weekday headers
            HStack(spacing: 0) {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(OdysseyColor.mutedText)
                        .frame(maxWidth: .infinity)
                }
            }

            // Calendar days
            let days = daysInMonth()
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                ForEach(days, id: \.self) { day in
                    if let day = day {
                        dayCell(day: day)
                    } else {
                        Color.clear
                            .frame(height: 36)
                    }
                }
            }
        }
    }

    private func dayCell(day: Date) -> some View {
        let isSelected = calendar.isDate(day, inSameDayAs: tempSelectedDate)
        let isToday = calendar.isDateInToday(day)

        return Button(action: {
            tempSelectedDate = day
        }) {
            Text("\(calendar.component(.day, from: day))")
                .font(.system(size: 14, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(
                    isSelected ? .white :
                    isToday ? OdysseyColor.accent :
                    OdysseyColor.ink
                )
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(isSelected ? OdysseyColor.accent : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(isToday && !isSelected ? OdysseyColor.accent : Color.clear, lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions

    private var actions: some View {
        HStack(spacing: 12) {
            // Today button
            Button(action: {
                tempSelectedDate = Date()
                displayedMonth = Date()
            }) {
                Text("Today")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(OdysseyColor.accent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .stroke(OdysseyColor.accent, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Spacer()

            // Cancel
            Button("Cancel") {
                isPresented = false
            }
            .font(.system(size: 14))
            .buttonStyle(.plain)

            // Confirm
            Button("Confirm") {
                selectedDate = tempSelectedDate
                onConfirm(tempSelectedDate)
                isPresented = false
            }
            .font(.system(size: 14, weight: .semibold))
            .buttonStyle(.plain)
        }
    }

    // MARK: - Helpers

    private var monthYearString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: displayedMonth)
    }

    private var weekdaySymbols: [String] {
        let symbols = calendar.veryShortWeekdaySymbols
        // Rotate so week starts on Sunday (or use calendar.firstWeekday)
        return symbols
    }

    private func previousMonth() {
        if let newDate = calendar.date(byAdding: .month, value: -1, to: displayedMonth) {
            displayedMonth = newDate
        }
    }

    private func nextMonth() {
        if let newDate = calendar.date(byAdding: .month, value: 1, to: displayedMonth) {
            displayedMonth = newDate
        }
    }

    private func daysInMonth() -> [Date?] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: displayedMonth),
              let monthFirstWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start) else {
            return []
        }

        var days: [Date?] = []
        let dayCount = calendar.dateComponents([.day], from: monthFirstWeek.start, to: monthInterval.end).day ?? 0

        for dayOffset in 0..<dayCount {
            guard let date = calendar.date(byAdding: .day, value: dayOffset, to: monthFirstWeek.start) else {
                continue
            }

            if calendar.isDate(date, equalTo: displayedMonth, toGranularity: .month) {
                days.append(date)
            } else if date < displayedMonth {
                days.append(nil) // Padding for previous month
            }
        }

        // Pad to complete the grid (6 rows * 7 days = 42 cells)
        while days.count < 42 {
            days.append(nil)
        }

        return days
    }
}

#Preview {
    @Previewable @State var selectedDate = Date()
    @Previewable @State var isPresented = true

    ZStack {
        Color.black.opacity(0.3)
            .ignoresSafeArea()

        RescheduleDatePicker(
            selectedDate: $selectedDate,
            isPresented: $isPresented,
            onConfirm: { date in
                print("Selected date: \(date)")
            }
        )
    }
}
