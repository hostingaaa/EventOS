import Foundation

enum TaskStatus: String, Codable, CaseIterable {
    case todo, in_progress, blocked, done

    var label: String {
        switch self {
        case .todo: return "To do"
        case .in_progress: return "In progress"
        case .blocked: return "Blocked"
        case .done: return "Done"
        }
    }
}

struct EventTask: Codable, Identifiable, Equatable {
    var taskId: String
    var eventCode: String
    var eventRowId: String
    var title: String
    var category: String
    var status: TaskStatus
    var assigneeEmail: String
    var assigneeName: String
    var dueDate: String
    var createdAt: String
    var updatedAt: String
    var createdBy: String
    var instructions: String
    var internalNotes: String?
    var templateId: String?
    var vendorVisible: String?
    var completedBy: String?
    var completedAt: String?
    var rowNumber: Int?

    var id: String { taskId }
}

struct Comment: Codable, Identifiable, Equatable {
    var commentId: String
    var eventCode: String
    var taskId: String?
    var authorEmail: String
    var authorName: String
    var body: String
    var createdAt: String

    var id: String { commentId }
}

struct TaskFile: Codable, Identifiable, Equatable {
    var fileId: String
    var eventCode: String
    var taskId: String
    var fileName: String
    var mimeType: String
    var driveFileId: String
    var driveUrl: String
    var uploadedBy: String
    var uploadedAt: String
    var sizeBytes: Int?

    var id: String { fileId }
}

struct ActivityItem: Codable, Identifiable, Equatable {
    var activityId: String
    var type: String
    var eventCode: String
    var taskId: String?
    var summary: String
    var actor: String
    var createdAt: String

    var id: String { activityId }
}

struct VendorLink: Codable, Equatable {
    var linkId: String
    var token: String
    var eventCode: String
    var eventRowId: String
    var label: String
    var vendorCategory: String?
    var vendorName: String?
    var permission: String?
    var createdAt: String
    var createdBy: String
    var active: String
}

struct CostItem: Codable, Identifiable, Equatable {
    var costItemId: String
    var eventCode: String
    var eventRowId: String
    var category: String
    var description: String
    var quantity: Double
    var unitRate: Double
    var currency: String
    var total: Double
    var vendorName: String?
    var notes: String?
    var createdBy: String
    var createdAt: String
    var updatedAt: String?
    var rowNumber: Int?

    var id: String { costItemId }
}

struct WorkspaceData: Codable {
    var event: Event
    var tasks: [EventTask]
    var comments: [Comment]
    var files: [TaskFile]
    var activity: [ActivityItem]
    var vendorLink: VendorLink?
    var costItems: [CostItem]
}
