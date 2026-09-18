import Foundation

/// Typed wrappers over APIClient, mirroring the functions in web/src/api/client.ts.
enum EventOSService {

    // MARK: Auth

    static func authCheckEmail(_ email: String) async throws -> Bool {
        struct Response: Codable { var exists: Bool }
        let res: Response = try await APIClient.get("authCheckEmail", ["email": email.lowercased()])
        return res.exists
    }

    static func authLogin(email: String, passwordHash: String) async throws -> AuthAccount? {
        struct Response: Codable { var account: AuthAccount? }
        let res: Response = try await APIClient.post("authLogin", ["email": email, "passwordHash": passwordHash])
        return res.account
    }

    static func authRegister(name: String, email: String, passwordHash: String) async throws -> AuthAccount {
        try await APIClient.post("authRegister", ["name": name, "email": email, "passwordHash": passwordHash])
    }

    static func whoami(actorEmail: String) async throws -> WhoAmI {
        try await APIClient.post("whoami", ["actorEmail": actorEmail])
    }

    // MARK: Events / Dashboard

    static func fetchEvents() async throws -> EventsResponse {
        try await APIClient.get("list")
    }

    /// The backend only hands back bulk per-event task/file data; health itself is computed
    /// client-side with `computeEventHealth`, mirroring web/src/api/client.ts.
    static func fetchDashboardHealth(events: [Event]) async -> [String: EventHealth] {
        struct Response: Codable {
            var tasksByEvent: [String: [DashboardHealthTask]]
            var fileCountByEvent: [String: Int]
        }
        guard let res: Response = try? await APIClient.get("dashboardHealth") else { return [:] }
        var map: [String: EventHealth] = [:]
        for event in events {
            let tasks = res.tasksByEvent[event.code] ?? []
            let fileCount = res.fileCountByEvent[event.code] ?? 0
            map[event.code] = computeEventHealth(event: event, tasks: tasks, fileCount: fileCount)
        }
        return map
    }

    // MARK: Workspace / Tasks / Comments

    static func fetchWorkspace(eventCode: String, eventRowId: String = "") async throws -> WorkspaceData {
        try await APIClient.get("workspace", ["eventCode": eventCode, "eventRowId": eventRowId])
    }

    static func updateTask(taskId: String, updates: [String: Any], actorEmail: String) async throws -> EventTask {
        try await APIClient.post("taskUpdate", ["taskId": taskId, "updates": updates, "actorEmail": actorEmail])
    }

    static func updateEvent(rowId: String, code: String, updates: [String: Any], actorEmail: String) async throws -> Event {
        try await APIClient.post("update", ["rowId": rowId, "code": code, "updates": updates, "actorEmail": actorEmail])
    }

    static func createCostItem(
        eventCode: String, eventRowId: String, category: String, description: String,
        quantity: Double, unitRate: Double, currency: String, vendorName: String? = nil,
        notes: String? = nil, createdBy: String
    ) async throws -> CostItem {
        var payload: [String: Any] = [
            "eventCode": eventCode, "eventRowId": eventRowId, "category": category,
            "description": description, "quantity": quantity, "unitRate": unitRate,
            "currency": currency, "createdBy": createdBy,
        ]
        if let vendorName { payload["vendorName"] = vendorName }
        if let notes { payload["notes"] = notes }
        return try await APIClient.post("costItemCreate", payload)
    }

    static func updateCostItem(costItemId: String, updates: [String: Any], actorEmail: String) async throws -> CostItem {
        try await APIClient.post("costItemUpdate", ["costItemId": costItemId, "updates": updates, "actorEmail": actorEmail])
    }

    static func deleteCostItem(costItemId: String, actorEmail: String) async throws {
        struct OkResponse: Codable { var ok: Bool }
        let _: OkResponse = try await APIClient.post("costItemDelete", ["costItemId": costItemId, "actorEmail": actorEmail])
    }

    /// Every cost item across every event, for the admin Reports dashboard.
    static func fetchAllCostItems() async throws -> [CostItem] {
        struct Response: Codable { var costItems: [CostItem] }
        let res: Response = try await APIClient.get("costItemsList")
        return res.costItems
    }

    static func createTask(eventCode: String, eventRowId: String, title: String, category: String, createdBy: String) async throws -> EventTask {
        try await APIClient.post("taskCreate", [
            "eventCode": eventCode, "eventRowId": eventRowId, "title": title,
            "category": category, "createdBy": createdBy,
        ])
    }

    static func addComment(eventCode: String, taskId: String?, authorEmail: String, authorName: String, body: String) async throws -> Comment {
        var payload: [String: Any] = ["eventCode": eventCode, "authorEmail": authorEmail, "authorName": authorName, "body": body]
        if let taskId { payload["taskId"] = taskId }
        return try await APIClient.post("commentAdd", payload)
    }

    // MARK: Team

    static func fetchTeamOverview() async throws -> TeamOverview {
        try await APIClient.get("team")
    }

    static func fetchOrgMembers() async throws -> [OrgMember] {
        struct Response: Codable { var members: [OrgMember] }
        let res: Response = try await APIClient.get("membersList")
        return res.members
    }

    // MARK: Task templates

    static func fetchTemplatesWithFiles() async throws -> [TaskTemplateWithFiles] {
        struct Response: Codable { var templates: [TaskTemplateWithFiles] }
        let res: Response = try await APIClient.get("templatesList", ["withFiles": "true"])
        return res.templates
    }

    static func createTemplate(_ payload: [String: Any]) async throws -> TaskTemplate {
        try await APIClient.post("templateCreate", payload)
    }

    static func updateTemplate(templateId: String, updates: [String: Any], actorEmail: String) async throws -> TaskTemplate {
        try await APIClient.post("templateUpdate", ["templateId": templateId, "updates": updates, "actorEmail": actorEmail])
    }

    /// Soft delete — the backend just flips `active` to `'no'`; there is no hard delete.
    @discardableResult
    static func deactivateTemplate(templateId: String, actorEmail: String) async throws -> TaskTemplate {
        try await APIClient.post("templateDelete", ["templateId": templateId, "actorEmail": actorEmail])
    }

    static func uploadTemplateFile(templateId: String, fileName: String, mimeType: String, dataBase64: String, actorEmail: String) async throws -> TemplateFile {
        try await APIClient.post("templateFileUpload", [
            "templateId": templateId, "fileName": fileName, "mimeType": mimeType,
            "dataBase64": dataBase64, "actorEmail": actorEmail,
        ])
    }

    static func applyTemplates(eventCode: String, eventRowId: String, templateIds: [String], actorEmail: String) async throws -> [EventTask] {
        struct Response: Codable { var tasks: [EventTask] }
        let res: Response = try await APIClient.post("applyTemplates", [
            "eventCode": eventCode, "eventRowId": eventRowId, "templateIds": templateIds, "actorEmail": actorEmail,
        ])
        return res.tasks
    }

    // MARK: Org templates (shared print/social/forms library)

    static func fetchOrgTemplates() async throws -> [OrgTemplateFile] {
        struct Response: Codable { var templates: [OrgTemplateFile] }
        let res: Response = try await APIClient.get("orgTemplatesList")
        return res.templates
    }

    /// Attaches/replaces the file on an existing slot (pass `id`), or creates a
    /// brand-new one (omit `id`, pass `name` + `category`). Admin-only.
    @discardableResult
    static func uploadOrgTemplateFile(
        id: String? = nil, name: String? = nil, category: String? = nil,
        fileName: String, mimeType: String, dataBase64: String, actorEmail: String
    ) async throws -> OrgTemplateFile {
        var payload: [String: Any] = [
            "fileName": fileName, "mimeType": mimeType, "dataBase64": dataBase64, "actorEmail": actorEmail,
        ]
        if let id { payload["id"] = id }
        if let name { payload["name"] = name }
        if let category { payload["category"] = category }
        return try await APIClient.post("orgTemplateUpload", payload)
    }

    static func deleteOrgTemplateFile(id: String, actorEmail: String) async throws {
        struct OkResponse: Codable { var ok: Bool }
        let _: OkResponse = try await APIClient.post("orgTemplateDelete", ["id": id, "actorEmail": actorEmail])
    }

    // MARK: Generators (spreadsheet save-to-Drive)

    struct DriveSaveResult: Codable {
        var driveFileId: String
        var driveUrl: String
        var fileName: String
    }

    static func saveTransferListToDrive(
        eventCode: String, fileName: String, dataBase64: String,
        uploadedBy: String, actorEmail: String, eventLocation: String, driveFileId: String? = nil
    ) async throws -> DriveSaveResult {
        var payload: [String: Any] = [
            "eventCode": eventCode, "fileName": fileName, "dataBase64": dataBase64,
            "uploadedBy": uploadedBy, "actorEmail": actorEmail, "eventLocation": eventLocation,
            "mimeType": "application/vnd.ms-excel",
        ]
        if let driveFileId { payload["driveFileId"] = driveFileId }
        return try await APIClient.post("transferListSave", payload)
    }

    static func saveAVEquipmentToDrive(
        eventCode: String, fileName: String, dataBase64: String,
        uploadedBy: String, actorEmail: String, eventLocation: String, driveFileId: String? = nil
    ) async throws -> DriveSaveResult {
        var payload: [String: Any] = [
            "eventCode": eventCode, "fileName": fileName, "dataBase64": dataBase64,
            "uploadedBy": uploadedBy, "actorEmail": actorEmail, "eventLocation": eventLocation,
            "mimeType": "application/vnd.ms-excel",
        ]
        if let driveFileId { payload["driveFileId"] = driveFileId }
        return try await APIClient.post("avEquipmentSave", payload)
    }
}
