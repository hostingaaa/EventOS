import Foundation

/// Shared helper for rendering backend ISO date strings with a written month
/// (e.g. "15 Jun 2026") instead of a raw numeric slice, for on-screen text.
enum DateDisplay {
    private static let isoDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let writtenDay: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM yyyy"
        return f
    }()

    private static let monthLongFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "LLLL"
        return f
    }()

    /// Accepts an ISO date ("2026-06-15") or ISO timestamp
    /// ("2026-06-15T10:30:00Z") and returns "15 Jun 2026". Falls back to the
    /// original date portion if it can't be parsed.
    static func writtenDate(fromIso iso: String) -> String {
        let dayPart = String(iso.prefix(10))
        guard let date = isoDay.date(from: dayPart) else { return dayPart }
        return writtenDay.string(from: date)
    }

    /// Event start/end range as a written-month label, e.g. "June 15-17, 2026"
    /// — mirrors the web dashboard's formatDashboardDates(). `startIso`/`endIso`
    /// are the event's own date fields; `fallback` is the backend's free-text
    /// "dates" label, used only when the ISO fields can't be parsed (it may
    /// have been stored with a numeric month at event-creation time).
    static func eventDateRange(startIso: String, endIso: String, fallback: String) -> String {
        let trimmedFallback = fallback.trimmingCharacters(in: .whitespaces)
        let fallbackText = trimmedFallback.isEmpty ? "—" : trimmedFallback

        guard let start = isoDay.date(from: String(startIso.prefix(10))) else { return fallbackText }
        let end = isoDay.date(from: String(endIso.prefix(10))) ?? start

        let cal = Calendar(identifier: .gregorian)
        let monthLong = { (d: Date) in monthLongFormatter.string(from: d) }

        if cal.isDate(start, inSameDayAs: end) {
            return "\(monthLong(start)) \(cal.component(.day, from: start)), \(cal.component(.year, from: start))"
        }

        let sameMonth = cal.component(.month, from: start) == cal.component(.month, from: end)
            && cal.component(.year, from: start) == cal.component(.year, from: end)
        if sameMonth {
            return "\(monthLong(start)) \(cal.component(.day, from: start))-\(cal.component(.day, from: end)), \(cal.component(.year, from: start))"
        }

        if cal.component(.year, from: start) == cal.component(.year, from: end) {
            return "\(monthLong(start)) \(cal.component(.day, from: start)) – \(monthLong(end)) \(cal.component(.day, from: end)), \(cal.component(.year, from: start))"
        }

        return "\(monthLong(start)) \(cal.component(.day, from: start)), \(cal.component(.year, from: start)) – \(monthLong(end)) \(cal.component(.day, from: end)), \(cal.component(.year, from: end))"
    }
}
