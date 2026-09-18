import Foundation

struct Event: Codable, Identifiable, Equatable {
    var rowNumber: Int?
    var rowId: String
    var code: String
    var location: String
    var dates: String
    var lem: String
    var av: String
    var interpreters: String
    var venue: String
    var psaCldp: String
    var sow: String
    var notes: String
    var monthGroup: String
    var startDate: String
    var endDate: String
    var ownerEmail: String
    var lastReminder: String?
    var perDiemRate: String?
    var maxVisaAllowance: String?
    var maxGroundTransport: String?
    var driveFolderUrl: String?
    var awarded: String?
    var revenue: String?

    var id: String { rowId }
}

struct EventsResponse: Codable {
    var months: [String]
    var events: [Event]
}

struct EventHealth: Codable, Equatable {
    var completion: Int
    var risk: Int
    var tier: String // "on-track" | "attention" | "at-risk" | "critical"
    var totalTasks: Int
    var doneTasks: Int
    var openTasks: Int
    var overdueTasks: Int
    var signals: [String]
}

/// A task's status/dueDate, as returned in bulk by the `dashboardHealth` backend action
/// (not a full `EventTask` — that's all `computeEventHealth` needs).
struct DashboardHealthTask: Codable {
    var status: TaskStatus
    var dueDate: String
}

private func isHealthFieldMissing(_ value: String) -> Bool {
    let s = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return s.isEmpty || s == "??" || s == "n/a" || s == "-"
}

private func daysUntil(_ dateStr: String) -> Int? {
    guard let date = parseFlexibleDate(dateStr) else { return nil }
    let calendar = Calendar.current
    let today = calendar.startOfDay(for: Date())
    let target = calendar.startOfDay(for: date)
    return calendar.dateComponents([.day], from: today, to: target).day
}

/// Swift port of `computeEventHealth` in web/src/utils/health.ts — keep the scoring in sync.
func computeEventHealth(event: Event, tasks: [DashboardHealthTask], fileCount: Int) -> EventHealth {
    let totalTasks = tasks.count
    let doneTasks = tasks.filter { $0.status == .done }.count
    let openTasks = tasks.filter { $0.status != .done }.count
    let overdueTasks = tasks.filter { task in
        guard task.status != .done, let due = daysUntil(task.dueDate) else { return false }
        return due < 0
    }.count
    let blockedTasks = tasks.filter { $0.status == .blocked }.count

    let completion = totalTasks > 0 ? Int((Double(doneTasks) / Double(totalTasks) * 100).rounded()) : 0

    var signals: [String] = []
    var risk = 0

    if isHealthFieldMissing(event.sow) {
        signals.append("Missing SOW")
        risk += 18
    }
    if isHealthFieldMissing(event.venue) {
        signals.append("Missing venue")
        risk += 16
    }
    let trimmedLem = event.lem.trimmingCharacters(in: .whitespacesAndNewlines)
    let lemOpen = !trimmedLem.isEmpty && trimmedLem.lowercased() != "closed"
    if lemOpen {
        signals.append("LEM still open")
        risk += 8
    }
    if overdueTasks > 0 {
        signals.append("\(overdueTasks) overdue task\(overdueTasks > 1 ? "s" : "")")
        risk += min(30, overdueTasks * 10)
    }
    if blockedTasks > 0 {
        signals.append("\(blockedTasks) blocked task\(blockedTasks > 1 ? "s" : "")")
        risk += min(15, blockedTasks * 5)
    }
    if totalTasks == 0 {
        signals.append("No tasks yet")
        risk += 10
    }
    if totalTasks > 0 && fileCount == 0 {
        signals.append("No files attached")
        risk += 6
    }

    if let daysLeft = daysUntil(event.startDate) {
        if daysLeft < 0 && completion < 100 {
            signals.append("Event has started/passed with open tasks")
            risk += 25
        } else if daysLeft <= 7 && completion < 70 {
            signals.append("Less than a week away")
            risk += 18
        } else if daysLeft <= 21 && completion < 50 {
            signals.append("Less than 3 weeks away")
            risk += 10
        }
    }

    risk = max(0, min(100, risk))

    let tier: String
    if risk >= 60 { tier = "critical" }
    else if risk >= 35 { tier = "at-risk" }
    else if risk >= 15 { tier = "attention" }
    else { tier = "on-track" }

    return EventHealth(
        completion: completion, risk: risk, tier: tier,
        totalTasks: totalTasks, doneTasks: doneTasks, openTasks: openTasks,
        overdueTasks: overdueTasks, signals: signals
    )
}
