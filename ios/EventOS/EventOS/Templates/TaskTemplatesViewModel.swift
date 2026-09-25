import Foundation

@MainActor
final class TaskTemplatesViewModel: ObservableObject {
    @Published var templates: [TaskTemplateWithFiles] = []
    @Published var loading = true
    @Published var error: String?
    @Published var busyTemplateId: String?

    func load() async {
        loading = true
        error = nil
        do {
            templates = try await EventOSService.fetchTemplatesWithFiles()
                .sorted { lhs, rhs in
                    sortValue(lhs.template.sortOrder) < sortValue(rhs.template.sortOrder)
                }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func sortValue(_ value: FlexibleNumber?) -> Int {
        switch value {
        case .int(let i): return i
        case .string(let s): return Int(s) ?? 99
        case .none: return 99
        }
    }

    func save(_ draft: TemplateDraft, actorEmail: String) async -> Bool {
        do {
            var payload: [String: Any] = [
                "title": draft.title,
                "category": draft.category,
                "instructions": draft.instructions,
                "defaultAssigneeName": draft.defaultAssigneeName,
                "defaultAssigneeEmail": draft.defaultAssigneeEmail,
                "active": "yes",
            ]
            if let offset = draft.dueOffsetDays { payload["dueOffsetDays"] = offset }

            if let templateId = draft.templateId {
                _ = try await EventOSService.updateTemplate(templateId: templateId, updates: payload, actorEmail: actorEmail)
            } else {
                payload["createdBy"] = actorEmail
                payload["actorEmail"] = actorEmail
                payload["sortOrder"] = 99
                _ = try await EventOSService.createTemplate(payload)
            }
            await load()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func deactivate(_ template: TaskTemplate, actorEmail: String) async {
        busyTemplateId = template.templateId
        defer { busyTemplateId = nil }
        do {
            _ = try await EventOSService.deactivateTemplate(templateId: template.templateId, actorEmail: actorEmail)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func uploadFile(templateId: String, fileName: String, mimeType: String, data: Data, actorEmail: String) async {
        busyTemplateId = templateId
        defer { busyTemplateId = nil }
        do {
            _ = try await EventOSService.uploadTemplateFile(
                templateId: templateId,
                fileName: fileName,
                mimeType: mimeType,
                dataBase64: data.base64EncodedString(),
                actorEmail: actorEmail
            )
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Editable form state for the create/edit sheet.
struct TemplateDraft: Identifiable {
    var id = UUID()
    var templateId: String?
    var title: String = ""
    var category: String = "General"
    var instructions: String = ""
    var defaultAssigneeName: String = ""
    var defaultAssigneeEmail: String = ""
    var dueOffsetDaysText: String = ""

    var dueOffsetDays: Int? {
        Int(dueOffsetDaysText.trimmingCharacters(in: .whitespaces))
    }

    static func new() -> TemplateDraft { TemplateDraft() }

    static func editing(_ template: TaskTemplate) -> TemplateDraft {
        var draft = TemplateDraft()
        draft.templateId = template.templateId
        draft.title = template.title
        draft.category = template.category
        draft.instructions = template.instructions
        draft.defaultAssigneeName = template.defaultAssigneeName
        draft.defaultAssigneeEmail = template.defaultAssigneeEmail
        if let offset = template.dueOffsetDays { draft.dueOffsetDaysText = String(offset) }
        return draft
    }
}
