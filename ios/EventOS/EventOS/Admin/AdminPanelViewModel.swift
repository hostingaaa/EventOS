import Foundation

@MainActor
final class AdminPanelViewModel: ObservableObject {
    @Published var members: [OrgMember] = []
    @Published var matrix: CapMatrix = Capabilities.normalize(nil)
    @Published var loading = true
    @Published var error: String?
    @Published var selectedPermissionsRole = "project_lead"
    @Published var savingCaps = false
    @Published var capSaved = false
    @Published var busyMemberId: String?

    func load(actorEmail: String) async {
        loading = true
        error = nil
        do {
            async let membersTask = EventOSService.fetchOrgMembers()
            async let matrixTask = EventOSService.fetchCapMatrix(actorEmail: actorEmail)
            let (fetchedMembers, fetchedMatrix) = try await (membersTask, matrixTask)
            members = fetchedMembers
            matrix = Capabilities.normalize(fetchedMatrix)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    var activeCount: Int {
        members.filter { $0.status != "inactive" }.count
    }

    func addMember(name: String, email: String, role: String, invitedBy: String) async -> String? {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmedName.isEmpty else { return "Name is required." }
        guard !trimmedEmail.isEmpty, trimmedEmail.contains("@") else { return "Valid email is required." }
        if members.contains(where: { $0.email.lowercased() == trimmedEmail }) {
            return "A member with this email already exists."
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let member = OrgMember(
            id: "member-\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString.prefix(5))",
            name: trimmedName, email: trimmedEmail, role: role, status: "invited",
            createdAt: formatter.string(from: Date()), invitedBy: invitedBy
        )
        do {
            let created = try await EventOSService.upsertMember(member, actorEmail: invitedBy)
            members.append(created)
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func changeRole(_ member: OrgMember, role: String, actorEmail: String) async {
        var updated = member
        updated.role = role
        await save(updated, actorEmail: actorEmail)
    }

    func toggleStatus(_ member: OrgMember, actorEmail: String) async {
        var updated = member
        updated.status = member.status == "inactive" ? "active" : "inactive"
        await save(updated, actorEmail: actorEmail)
    }

    private func save(_ member: OrgMember, actorEmail: String) async {
        busyMemberId = member.id
        defer { busyMemberId = nil }
        do {
            let saved = try await EventOSService.upsertMember(member, actorEmail: actorEmail)
            if let idx = members.firstIndex(where: { $0.id == saved.id }) {
                members[idx] = saved
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func toggleCap(role: String, cap: String) {
        guard role != "admin" else { return }
        var roleCaps = matrix[role] ?? [:]
        roleCaps[cap] = !(roleCaps[cap] ?? false)
        matrix[role] = roleCaps
    }

    func saveCaps(actorEmail: String) async {
        savingCaps = true
        defer { savingCaps = false }
        do {
            try await EventOSService.saveCapMatrix(matrix, actorEmail: actorEmail)
            capSaved = true
            Task {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                capSaved = false
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
