import Foundation

enum DashboardFilter: String, CaseIterable, Identifiable {
    case all, attention, critical, missingSow, missingVenue

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All active"
        case .attention: return "Needs attention"
        case .critical: return "At risk"
        case .missingSow: return "Missing SOW"
        case .missingVenue: return "Missing venue"
        }
    }
}

struct MonthGroup: Identifiable {
    var month: String
    var events: [Event]
    var id: String { month }
}

private let imminentDays = 7

private let isoDayFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withFullDate]
    return f
}()

func parseFlexibleDate(_ raw: String?) -> Date? {
    guard let raw, !raw.isEmpty else { return nil }
    if let d = isoDayFormatter.date(from: String(raw.prefix(10))) { return d }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    for fmt in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd", "MM/dd/yyyy"] {
        formatter.dateFormat = fmt
        if let d = formatter.date(from: raw) { return d }
    }
    return nil
}

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var healthByCode: [String: EventHealth] = [:]
    @Published var filter: DashboardFilter = .all
    @Published var loading = true
    @Published var error: String?
    @Published var showCompleted = false
    @Published var showSetAside = false

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

    func daysUntilStart(_ event: Event) -> Int? {
        guard let start = parseFlexibleDate(event.startDate) else { return nil }
        let cal = Calendar.current
        let startDay = cal.startOfDay(for: start)
        let today = cal.startOfDay(for: Date())
        return cal.dateComponents([.day], from: today, to: startDay).day
    }

    func isHappening(_ event: Event) -> Bool {
        guard let start = parseFlexibleDate(event.startDate) else { return false }
        let today = Date()
        if start > today { return false }
        if let end = parseFlexibleDate(event.endDate), end < today { return false }
        return true
    }

    private func matchesFilter(_ event: Event) -> Bool {
        switch filter {
        case .all: return true
        case .attention:
            return missingSow(event) || missingVenue(event) || lemOpen(event)
        case .missingSow: return missingSow(event)
        case .missingVenue: return missingVenue(event)
        case .critical:
            let tier = healthByCode[event.code]?.tier
            return tier == "critical" || tier == "at-risk"
        }
    }

    private func missingSow(_ event: Event) -> Bool {
        let sow = event.sow.trimmingCharacters(in: .whitespaces).lowercased()
        return sow.isEmpty || sow == "??"
    }
    private func missingVenue(_ event: Event) -> Bool {
        event.venue.trimmingCharacters(in: .whitespaces).isEmpty
    }
    private func lemOpen(_ event: Event) -> Bool {
        event.lem.trimmingCharacters(in: .whitespaces).lowercased() != "closed"
    }

    private func monthLabel(for event: Event) -> String {
        guard let date = parseFlexibleDate(event.startDate) else {
            return event.monthGroup.isEmpty ? "Unscheduled" : event.monthGroup
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: date)
    }

    private func groupByMonth(_ list: [Event], ascending: Bool) -> [MonthGroup] {
        var buckets: [String: (events: [Event], anchor: Date)] = [:]
        for event in list {
            let label = monthLabel(for: event)
            let anchor = parseFlexibleDate(event.startDate) ?? Date(timeIntervalSince1970: 0)
            buckets[label, default: ([], anchor)].events.append(event)
        }
        for key in buckets.keys {
            buckets[key]!.events.sort { a, b in
                let da = parseFlexibleDate(a.startDate)
                let db = parseFlexibleDate(b.startDate)
                if da == nil && db == nil { return false }
                if da == nil { return false }
                if db == nil { return true }
                return da! < db!
            }
            if let first = buckets[key]!.events.first, let firstDate = parseFlexibleDate(first.startDate) {
                buckets[key]!.anchor = firstDate
            }
        }
        return buckets
            .sorted { ascending ? $0.value.anchor < $1.value.anchor : $0.value.anchor > $1.value.anchor }
            .map { MonthGroup(month: $0.key, events: $0.value.events) }
    }

    var activeGroups: [MonthGroup] {
        let active = events.filter(isEventActive).filter(matchesFilter)
        return groupByMonth(active, ascending: true)
    }

    /// Real Completed status only — Postponed/Cancelled/Archived get their own section.
    var completedGroups: [MonthGroup] {
        groupByMonth(events.filter { getEventStatus($0) == .completed }, ascending: false)
    }

    var setAsideGroups: [MonthGroup] {
        groupByMonth(events.filter(isEventSetAside), ascending: false)
    }

    var activeCount: Int {
        events.filter(isEventActive).filter(matchesFilter).count
    }

    /// The single most urgent active event — worst health tier first, then soonest to start.
    /// Powers the "Featured event" hero card.
    var featuredEvent: Event? {
        let active = events.filter(isEventActive)
        guard !active.isEmpty else { return nil }
        func rank(_ e: Event) -> Int {
            switch healthByCode[e.code]?.tier {
            case "critical": return 0
            case "at-risk": return 1
            case "attention": return 2
            default: return 3
            }
        }
        return active.min { a, b in
            let ra = rank(a), rb = rank(b)
            if ra != rb { return ra < rb }
            let da = daysUntilStart(a) ?? Int.max
            let db = daysUntilStart(b) ?? Int.max
            return da < db
        }
    }

    /// A handful of active events (excluding the featured one) for the quick-glance grid.
    var gridEvents: [Event] {
        let active = events.filter(isEventActive).filter(matchesFilter)
        return active.filter { $0.rowId != featuredEvent?.rowId }.prefix(4).map { $0 }
    }

    /// Mirrors web's dashboard stat cards (Active events / Awarded / Completed) — unlike
    /// `activeCount`, these are not affected by the filter tabs.
    var lifecycleStats: (active: Int, awarded: Int, completed: Int) {
        let active = events.filter(isEventActive)
        let awarded = active.filter { getEventStatus($0) == .awarded }
        let completed = events.filter { getEventStatus($0) == .completed }
        return (active.count, awarded.count, completed.count)
    }
}
