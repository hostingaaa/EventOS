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
