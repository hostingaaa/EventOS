import Foundation

@MainActor
final class WorkspaceViewModel: ObservableObject {
    let eventCode: String

    @Published var data: WorkspaceData?
    @Published var loading = true
    @Published var error: String?
    @Published var newCommentBody = ""
    @Published var newTaskTitle = ""
    @Published var busyTaskId: String?
    @Published var savingAwarded = false
    @Published var savingRevenue = false
    @Published var busyCostItemId: String?

    init(eventCode: String) {
        self.eventCode = eventCode
    }

    func load() async {
        loading = true
        error = nil
        do {
            data = try await EventOSService.fetchWorkspace(eventCode: eventCode)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    var eventLevelComments: [Comment] {
        (data?.comments ?? []).filter { ($0.taskId ?? "").isEmpty }
    }

    var readiness: (total: Int, done: Int, blocked: Int, overdue: Int) {
        let tasks = data?.tasks ?? []
        let total = tasks.count
        let done = tasks.filter { $0.status == .done }.count
        let blocked = tasks.filter { $0.status == .blocked }.count
        let overdue = tasks.filter { task in
            guard task.status != .done, let due = parseFlexibleDate(task.dueDate) else { return false }
            return due < Date()
        }.count
        return (total, done, blocked, overdue)
    }

    func toggleComplete(_ task: EventTask, actorEmail: String) async {
        busyTaskId = task.taskId
        defer { busyTaskId = nil }
        let newStatus: TaskStatus = task.status == .done ? .in_progress : .done
        await updateStatus(task, to: newStatus, actorEmail: actorEmail)
    }

    func updateStatus(_ task: EventTask, to status: TaskStatus, actorEmail: String) async {
        busyTaskId = task.taskId
        defer { busyTaskId = nil }
        do {
            let updated = try await EventOSService.updateTask(taskId: task.taskId, updates: ["status": status.rawValue], actorEmail: actorEmail)
            applyTaskUpdate(updated)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func applyTaskUpdate(_ task: EventTask) {
        guard var current = data else { return }
        if let idx = current.tasks.firstIndex(where: { $0.taskId == task.taskId }) {
            current.tasks[idx] = task
            data = current
        }
    }

    func addComment(taskId: String?, authorEmail: String, authorName: String) async {
        let body = newCommentBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        do {
            let comment = try await EventOSService.addComment(eventCode: eventCode, taskId: taskId, authorEmail: authorEmail, authorName: authorName, body: body)
            guard var current = data else { return }
            current.comments.append(comment)
            data = current
            newCommentBody = ""
        } catch {
            self.error = error.localizedDescription
        }
    }

    var isAwarded: Bool {
        (data?.event.awarded ?? "").trimmingCharacters(in: .whitespaces).lowercased() == "yes"
    }

    func toggleAwarded(actorEmail: String) async {
        guard let event = data?.event else { return }
        savingAwarded = true
        defer { savingAwarded = false }
        do {
            let updated = try await EventOSService.updateEvent(
                rowId: event.rowId, code: event.code,
                updates: ["awarded": isAwarded ? "" : "Yes"], actorEmail: actorEmail
            )
            guard var current = data else { return }
            current.event = updated
            data = current
        } catch {
            self.error = error.localizedDescription
        }
    }

    var financials: (totalsByCurrency: [String: Double], revenue: Double?, profit: Double?) {
        var totalsByCurrency: [String: Double] = [:]
        for item in data?.costItems ?? [] {
            totalsByCurrency[item.currency, default: 0] += item.total
        }
        let revenue = (data?.event.revenue).flatMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        let totalCost = totalsByCurrency.values.reduce(0, +)
        let profit = revenue.map { $0 - totalCost }
        return (totalsByCurrency, revenue, profit)
    }

    func addCostItem(description: String, category: String, quantity: Double, unitRate: Double, currency: String, createdBy: String) async {
        guard let event = data?.event else { return }
        do {
            let item = try await EventOSService.createCostItem(
                eventCode: event.code, eventRowId: event.rowId,
                category: category.isEmpty ? "General" : category, description: description,
                quantity: quantity, unitRate: unitRate, currency: currency, createdBy: createdBy
            )
            guard var current = data else { return }
            current.costItems.append(item)
            data = current
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteCostItem(_ item: CostItem, actorEmail: String) async {
        busyCostItemId = item.costItemId
        defer { busyCostItemId = nil }
        do {
            try await EventOSService.deleteCostItem(costItemId: item.costItemId, actorEmail: actorEmail)
            guard var current = data else { return }
            current.costItems.removeAll { $0.costItemId == item.costItemId }
            data = current
        } catch {
            self.error = error.localizedDescription
        }
    }

    func saveRevenue(_ value: String, actorEmail: String) async {
        guard let event = data?.event else { return }
        savingRevenue = true
        defer { savingRevenue = false }
        do {
            let updated = try await EventOSService.updateEvent(rowId: event.rowId, code: event.code, updates: ["revenue": value], actorEmail: actorEmail)
            guard var current = data else { return }
            current.event = updated
            data = current
        } catch {
            self.error = error.localizedDescription
        }
    }

    @Published var applyingTemplates = false

    func applyTemplates(templateIds: [String], actorEmail: String) async -> Bool {
        guard let event = data?.event, !templateIds.isEmpty else { return false }
        applyingTemplates = true
        defer { applyingTemplates = false }
        do {
            let tasks = try await EventOSService.applyTemplates(eventCode: event.code, eventRowId: event.rowId, templateIds: templateIds, actorEmail: actorEmail)
            guard var current = data else { return false }
            current.tasks.append(contentsOf: tasks)
            data = current
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func createTask(createdBy: String) async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let event = data?.event else { return }
        do {
            let task = try await EventOSService.createTask(eventCode: event.code, eventRowId: event.rowId, title: title, category: "General", createdBy: createdBy)
            guard var current = data else { return }
            current.tasks.append(task)
            data = current
            newTaskTitle = ""
        } catch {
            self.error = error.localizedDescription
        }
    }
}
