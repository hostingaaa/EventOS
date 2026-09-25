import SwiftUI

struct TeamView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = TeamViewModel()
    @State private var unassignedExpanded = false
    @State private var expandedCompleted: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let team = vm.team {
                    statsCard(team)

                    if !vm.unassignedTasks.isEmpty {
                        unassignedSection
                    }

                    if vm.accounts.isEmpty {
                        Text("No org accounts yet.").foregroundStyle(Theme.textSecondary)
                    } else {
                        SectionHeaderRow(icon: "person.2.fill", title: "Accounts")
                        ForEach(vm.accounts) { account in
                            accountCard(account)
                        }
                    }
                } else if vm.loading {
                    ProgressView("Loading team…").tint(Theme.green)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk)
                }

                Button {
                    session.signOut()
                } label: {
                    Text("Sign out").frame(maxWidth: .infinity)
                }
                .buttonStyle(StakeSecondaryButtonStyle(tint: Theme.statusRisk))
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Team")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private func statsCard(_ team: TeamOverview) -> some View {
        HStack(spacing: 0) {
            StatBlock(value: "\(team.totalTasks)", label: "Total tasks")
            StatBlock(value: "\(team.openTasks)", label: "Open tasks")
            StatBlock(value: "\(vm.accounts.count)", label: "Contributors", color: Theme.green)
        }
        .cardStyle()
    }

    private var unassignedSection: some View {
        DisclosureRow(title: "Unassigned", count: vm.unassignedTasks.count, isExpanded: $unassignedExpanded) {
            VStack(spacing: 8) {
                ForEach(vm.unassignedTasks) { task in
                    taskRow(task)
                }
            }
        }
    }

    private func accountCard(_ account: AccountSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Theme.headerGradient).frame(width: 36, height: 36)
                    Text(account.name.prefix(1).uppercased())
                        .font(.caption.bold()).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(account.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    if !account.email.isEmpty {
                        Text(account.email).font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(account.currentTasks.count) current").font(.caption2.bold()).foregroundStyle(Theme.green)
                    Text("\(account.completedTasks.count) done").font(.caption2).foregroundStyle(Theme.textSecondary)
                }
            }

            if account.currentTasks.isEmpty && account.completedTasks.isEmpty {
                Text("No tasks assigned.").font(.caption).foregroundStyle(Theme.textSecondary)
            }

            if !account.currentTasks.isEmpty {
                VStack(spacing: 8) {
                    ForEach(account.currentTasks) { task in
                        taskRow(task)
                    }
                }
            }

            if !account.completedTasks.isEmpty {
                DisclosureRow(
                    title: "Completed",
                    count: account.completedTasks.count,
                    isExpanded: Binding(
                        get: { expandedCompleted.contains(account.id) },
                        set: { expanded in
                            if expanded { expandedCompleted.insert(account.id) } else { expandedCompleted.remove(account.id) }
                        }
                    )
                ) {
                    VStack(spacing: 8) {
                        ForEach(account.completedTasks) { task in
                            taskRow(task)
                        }
                    }
                }
            }
        }
        .cardStyle()
    }

    private func taskRow(_ task: EventTask) -> some View {
        NavigationLink {
            EventWorkspaceView(eventCode: task.eventCode)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(task.eventCode).font(.caption.bold()).foregroundStyle(Theme.textSecondary)
                    Text(task.title)
                        .font(.subheadline)
                        .foregroundStyle(task.status == .done ? Theme.textSecondary : Theme.textPrimary)
                        .strikethrough(task.status == .done)
                }
                Spacer()
                statusPill(task.status)
            }
            .padding(10)
            .background(Theme.cardAlt)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func statusPill(_ status: TaskStatus) -> some View {
        let color: Color
        switch status {
        case .todo: color = Theme.textTertiary
        case .in_progress: color = Theme.statusInfo
        case .blocked: color = Theme.statusRisk
        case .done: color = Theme.statusGood
        }
        return Text(status.label.replacingOccurrences(of: "_", with: " "))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

/// Outlined secondary button (mirrors Stake's "Sign out"-equivalent destructive/secondary actions).
struct StakeSecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.textPrimary

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(tint)
            .padding(.vertical, 14)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(tint.opacity(0.4), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}
