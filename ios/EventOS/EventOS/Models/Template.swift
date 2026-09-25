import Foundation

/// `sortOrder` comes back from the backend as either a JSON string or a number.
enum FlexibleNumber: Codable, Equatable {
    case int(Int)
    case string(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            self = .int(intValue)
        } else {
            self = .string((try? container.decode(String.self)) ?? "")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .int(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        }
    }
}

struct TaskTemplate: Codable, Identifiable, Equatable {
    var templateId: String
    var title: String
    var category: String
    var instructions: String
    var defaultAssigneeEmail: String
    var defaultAssigneeName: String
    var sortOrder: FlexibleNumber?
    var active: String
    var createdAt: String
    var updatedAt: String
    var createdBy: String
    var dueOffsetDays: Int?

    var id: String { templateId }
}

struct TemplateFile: Codable, Identifiable, Equatable {
    var fileId: String
    var templateId: String
    var fileName: String
    var mimeType: String
    var driveFileId: String
    var driveUrl: String
    var sizeBytes: Int?
    var uploadedAt: String

    var id: String { fileId }
}

struct TaskTemplateWithFiles: Codable, Identifiable {
    var template: TaskTemplate
    var files: [TemplateFile]

    var id: String { template.templateId }
}

/// One org-wide template slot (print materials, social media assets, forms) —
/// backed by Drive, visible to everyone, not just the admin who uploaded it.
struct OrgTemplateFile: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var category: String
    var fileType: String
    var driveFileId: String?
    var driveUrl: String?
    var sizeBytes: Int?
    var addedBy: String
    var addedAt: String

    var hasFile: Bool { !(driveUrl ?? "").isEmpty }

    /// Drive's embeddable preview URL — its plain share link refuses to be framed.
    var previewURL: URL? {
        guard let id = driveFileId, !id.isEmpty else { return nil }
        return URL(string: "https://drive.google.com/file/d/\(id)/preview")
    }

    /// A URL that actually streams the file instead of opening Drive's viewer.
    var downloadURL: URL? {
        guard let id = driveFileId, !id.isEmpty else { return nil }
        return URL(string: "https://drive.google.com/uc?export=download&id=\(id)")
    }

    /// The normal Drive "view" link — safe to hand to anyone, since these
    /// files are already shared org-wide with no login required.
    var shareURL: URL? {
        if let driveUrl, !driveUrl.isEmpty { return URL(string: driveUrl) }
        guard let id = driveFileId, !id.isEmpty else { return nil }
        return URL(string: "https://drive.google.com/file/d/\(id)/view?usp=sharing")
    }
}
