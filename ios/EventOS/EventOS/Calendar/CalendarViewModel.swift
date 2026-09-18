import Foundation

@MainActor
final class CalendarViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var healthByCode: [String: EventHealth] = [:]
    @Published var loading = true
    @Published var error: String?
    @Published var visibleMonth: Date = Calendar.current.startOfDay(for: Date())
    @Published var selectedDay: Date?

    private let calendar = Calendar.current

    func load() async {
        loading = true
        error = nil
        do {
            let data = try await EventOSService.fetchEvents()
            events = data.events
            healthByCode = await EventOSService.fetchDashboardHealth(events: data.events)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    func goToPreviousMonth() {
        if let date = calendar.date(byAdding: .month, value: -1, to: visibleMonth) {
            visibleMonth = date
        }
        selectedDay = nil
    }

    func goToNextMonth() {
        if let date = calendar.date(byAdding: .month, value: 1, to: visibleMonth) {
            visibleMonth = date
        }
        selectedDay = nil
    }

    var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: visibleMonth)
    }

    /// Days to render in the grid, including leading/trailing blanks to align to a 7-column week.
    var gridDays: [Date?] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: visibleMonth) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: monthInterval.start)
        let leadingBlanks = (firstWeekday - calendar.firstWeekday + 7) % 7

        var days: [Date?] = Array(repeating: nil, count: leadingBlanks)
        var cursor = monthInterval.start
        while cursor < monthInterval.end {
            days.append(cursor)
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        while days.count % 7 != 0 {
            days.append(nil)
        }
        return days
    }

    var weekdaySymbols: [String] {
        let symbols = calendar.shortWeekdaySymbols
        let offset = calendar.firstWeekday - 1
        return Array(symbols[offset...] + symbols[..<offset])
    }

    /// Events whose date range covers the given day.
    func events(on day: Date) -> [Event] {
        events.filter { event in
            guard let start = parseFlexibleDate(event.startDate) else { return false }
            let end = parseFlexibleDate(event.endDate) ?? start
            return calendar.startOfDay(for: start) <= day && day <= calendar.startOfDay(for: end)
        }
    }

    func hasEvents(on day: Date) -> Bool {
        !events(on: day).isEmpty
    }

    func dominantTier(on day: Date) -> String? {
        let dayEvents = events(on: day)
        let tiers = dayEvents.compactMap { healthByCode[$0.code]?.tier }
        if tiers.contains("critical") || tiers.contains("at-risk") { return "at-risk" }
        if tiers.contains("attention") { return "attention" }
        if !dayEvents.isEmpty { return "on-track" }
        return nil
    }

    var agendaEvents: [Event] {
        if let day = selectedDay {
            return events(on: day).sorted { ($0.startDate) < ($1.startDate) }
        }
        guard let interval = calendar.dateInterval(of: .month, for: visibleMonth) else { return [] }
        return events
            .filter { event in
                guard let start = parseFlexibleDate(event.startDate) else { return false }
                return start >= interval.start && start < interval.end
            }
            .sorted { ($0.startDate) < ($1.startDate) }
    }

    func isSameDay(_ a: Date, _ b: Date) -> Bool {
        calendar.isDate(a, inSameDayAs: b)
    }

    func isToday(_ day: Date) -> Bool {
        calendar.isDateInToday(day)
    }
}
