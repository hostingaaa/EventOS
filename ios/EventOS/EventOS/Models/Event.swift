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
