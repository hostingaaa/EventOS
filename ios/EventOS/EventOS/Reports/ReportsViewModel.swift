import Foundation

struct MonthlyTrendPoint: Identifiable {
    let index: Int
    let month: String
    let revenue: Double
    let cost: Double
    let profit: Double
    var id: Int { index }
}

struct BreakdownEntry: Identifiable {
    let key: String
    let label: String
    let value: Double
    var id: String { key }
}

struct ReportEventRow: Identifiable {
    let code: String
    let location: String
    let owner: String
    let revenue: Double
    let cost: Double
    let profit: Double
    var id: String { code }
}

enum ReportSortColumn: String, CaseIterable, Identifiable {
    case code = "Event", location = "Location", owner = "Owner", revenue = "Revenue", cost = "Cost", profit = "Profit"
    var id: String { rawValue }
}

private let monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

@MainActor
final class ReportsViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var costItems: [CostItem] = []
    @Published var orgMembers: [OrgMember] = []
    @Published var loading = true
    @Published var error: String?
    @Published var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @Published var sortColumn: ReportSortColumn = .profit
    @Published var sortAscending = false

    func load() async {
        loading = true
        error = nil
        async let eventsResult = EventOSService.fetchEvents()
        async let costItemsResult = EventOSService.fetchAllCostItems()
        async let membersResult = EventOSService.fetchOrgMembers()
        do {
            let (eventsRes, costItemsRes, membersRes) = try await (eventsResult, costItemsResult, membersResult)
            events = eventsRes.events
            costItems = costItemsRes
            orgMembers = membersRes
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    var years: [Int] {
        var set = Set(events.compactMap { parseFlexibleDate($0.startDate).map { Calendar.current.component(.year, from: $0) } })
        set.insert(Calendar.current.component(.year, from: Date()))
        return set.sorted(by: >)
    }

    var yearEvents: [Event] {
        events.filter { event in
            guard let date = parseFlexibleDate(event.startDate) else { return false }
            return Calendar.current.component(.year, from: date) == selectedYear
        }
    }

    var costItemsByEvent: [String: [CostItem]] {
        Dictionary(grouping: costItems, by: { $0.eventCode })
    }

    private func financials(for event: Event) -> (revenue: Double, cost: Double, profit: Double) {
        let cost = (costItemsByEvent[event.code] ?? []).reduce(0) { $0 + $1.total }
        let revenue = event.revenue.flatMap { Double($0.trimmingCharacters(in: .whitespaces)) } ?? 0
        return (revenue, cost, revenue - cost)
    }

    private func ownerDisplayName(_ email: String) -> String {
        if email.isEmpty { return "Unassigned" }
        if let member = orgMembers.first(where: { $0.email.caseInsensitiveCompare(email) == .orderedSame }) {
            return member.name.isEmpty ? email : member.name
        }
        return email
    }

    private func country(from location: String) -> String {
        let trimmed = location.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "Unknown" }
        guard let commaIndex = trimmed.lastIndex(of: ",") else { return trimmed }
        return trimmed[trimmed.index(after: commaIndex)...].trimmingCharacters(in: .whitespaces)
    }

    var kpis: (revenue: Double, cost: Double, profit: Double, count: Int) {
        var revenue = 0.0, cost = 0.0
        for event in yearEvents {
            let f = financials(for: event)
            revenue += f.revenue
            cost += f.cost
        }
        return (revenue, cost, revenue - cost, yearEvents.count)
    }

    var monthlyTrend: [MonthlyTrendPoint] {
        var points = (0..<12).map { MonthlyTrendPoint(index: $0, month: monthLabels[$0], revenue: 0, cost: 0, profit: 0) }
        for event in events {
            guard let date = parseFlexibleDate(event.startDate),
                  Calendar.current.component(.year, from: date) == selectedYear else { continue }
            let month = Calendar.current.component(.month, from: date) - 1
            guard month >= 0 && month < 12 else { continue }
            let f = financials(for: event)
            let p = points[month]
            points[month] = MonthlyTrendPoint(index: month, month: p.month, revenue: p.revenue + f.revenue, cost: p.cost + f.cost, profit: p.profit + f.profit)
        }
        return points
    }

    var categoryBreakdown: [BreakdownEntry] {
        let yearCodes = Set(yearEvents.map(\.code))
        var totals: [String: Double] = [:]
        for item in costItems where yearCodes.contains(item.eventCode) {
            let key = item.category.isEmpty ? "General" : item.category
            totals[key, default: 0] += item.total
        }
        return totals.map { BreakdownEntry(key: $0.key, label: $0.key, value: $0.value) }.sorted { $0.value > $1.value }
    }

    var ownerBreakdown: [BreakdownEntry] {
        var totals: [String: Double] = [:]
        for event in yearEvents {
            let key = event.ownerEmail.isEmpty ? "unassigned" : event.ownerEmail
            totals[key, default: 0] += financials(for: event).profit
        }
        return totals.map { BreakdownEntry(key: $0.key, label: ownerDisplayName($0.key == "unassigned" ? "" : $0.key), value: $0.value) }
            .sorted { $0.value > $1.value }
    }

    var countryBreakdown: [BreakdownEntry] {
        var totals: [String: Double] = [:]
        for event in yearEvents {
            let key = country(from: event.location)
            totals[key, default: 0] += financials(for: event).profit
        }
        return totals.map { BreakdownEntry(key: $0.key, label: $0.key, value: $0.value) }.sorted { $0.value > $1.value }
    }

    var sortedRows: [ReportEventRow] {
        let rows = yearEvents.map { event -> ReportEventRow in
            let f = financials(for: event)
            return ReportEventRow(code: event.code, location: event.location, owner: ownerDisplayName(event.ownerEmail), revenue: f.revenue, cost: f.cost, profit: f.profit)
        }
        let ascending = sortAscending
        return rows.sorted { a, b in
            let order: ComparisonResult
            switch sortColumn {
            case .code: order = a.code.localizedCaseInsensitiveCompare(b.code)
            case .location: order = a.location.localizedCaseInsensitiveCompare(b.location)
            case .owner: order = a.owner.localizedCaseInsensitiveCompare(b.owner)
            case .revenue: order = a.revenue == b.revenue ? .orderedSame : (a.revenue < b.revenue ? .orderedAscending : .orderedDescending)
            case .cost: order = a.cost == b.cost ? .orderedSame : (a.cost < b.cost ? .orderedAscending : .orderedDescending)
            case .profit: order = a.profit == b.profit ? .orderedSame : (a.profit < b.profit ? .orderedAscending : .orderedDescending)
            }
            if order == .orderedSame { return false }
            return ascending ? order == .orderedAscending : order == .orderedDescending
        }
    }
}
