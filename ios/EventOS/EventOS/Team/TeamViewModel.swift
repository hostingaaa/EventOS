import Foundation

/// One org account's task summary — merges the OrgMembers roster with the
/// task-grouping data from `team`, so accounts with zero tasks still show up.
struct AccountSummary: Identifiable {
    let id: String
    let name: String
    let email: String
    let currentTasks: [EventTask]
    let completedTasks: [EventTask]
}

@MainActor
final class TeamViewModel: ObservableObject {
    @Published var team: TeamOverview?
    @Published var orgMembers: [OrgMember] = []
    @Published var loading = true
    @Published var error: String?

    func load() async {
        loading = true
        error = nil
        async let teamResult = EventOSService.fetchTeamOverview()
        async let membersResult = EventOSService.fetchOrgMembers()
        do {
            let (team, members) = try await (teamResult, membersResult)
            self.team = team
            self.orgMembers = members
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    /// Tasks with no assignee at all (the backend's synthetic "Unassigned" bucket).
    var unassignedTasks: [EventTask] {
        team?.members.first(where: { $0.name == "Unassigned" && $0.email.isEmpty })?.tasks ?? []
    }

    /// Every org account (even ones with no tasks right now), plus any legacy
    /// name-only assignee buckets that don't match a roster account by email.
    var accounts: [AccountSummary] {
        guard let team else { return [] }
        var matchedEmails = Set<String>()
        var result: [AccountSummary] = []

        for member in orgMembers where member.status.lowercased() != "inactive" {
            let match = member.email.isEmpty
                ? nil
                : team.members.first { $0.email.caseInsensitiveCompare(member.email) == .orderedSame }
            if let match { matchedEmails.insert(match.email.lowercased()) }
            let tasks = match?.tasks ?? []
            result.append(AccountSummary(
                id: member.id,
                name: member.name.isEmpty ? member.email : member.name,
                email: member.email,
                currentTasks: tasks.filter { $0.status != .done },
                completedTasks: tasks.filter { $0.status == .done }
            ))
        }

        for bucket in team.members {
            if bucket.name == "Unassigned" && bucket.email.isEmpty { continue }
            let key = bucket.email.lowercased()
            if !key.isEmpty && matchedEmails.contains(key) { continue }
            result.append(AccountSummary(
                id: bucket.email.isEmpty ? bucket.name : bucket.email,
                name: bucket.name,
                email: bucket.email,
                currentTasks: bucket.tasks.filter { $0.status != .done },
                completedTasks: bucket.tasks.filter { $0.status == .done }
            ))
        }

        return result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}
