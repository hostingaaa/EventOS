import SwiftUI

struct AdminPanelView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AdminPanelViewModel()
    @State private var tab: PanelTab = .members
    @State private var showAddMember = false

    enum PanelTab: String, CaseIterable { case members = "Members", permissions = "Role Permissions" }

    var body: some View {
        Group {
            if vm.loading {
                ProgressView("Loading admin panel…").tint(Theme.green)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                content
            }
        }
        .background(Theme.bg)
        .navigationTitle("Admin Panel")
        .task { await vm.load(actorEmail: session.user?.email ?? "") }
        .refreshable { await vm.load(actorEmail: session.user?.email ?? "") }
        .sheet(isPresented: $showAddMember) {
            AddMemberSheet(invitedBy: session.user?.email ?? "") { name, email, role in
                let err = await vm.addMember(name: name, email: email, role: role, invitedBy: session.user?.email ?? "")
                if err == nil { showAddMember = false }
                return err
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 8) {
                    ForEach(PanelTab.allCases, id: \.self) { t in
                        PillChip(label: t.rawValue, isSelected: tab == t) { tab = t }
                    }
                }

                if let error = vm.error {
                    Text(error).font(.caption).foregroundStyle(Theme.statusRisk)
                }

                if tab == .members {
                    membersSection
                } else {
                    permissionsSection
                }
            }
            .padding(16)
        }
    }

    // MARK: Members

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("\(vm.activeCount) active member\(vm.activeCount == 1 ? "" : "s")")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
                Spacer()
                Button {
                    showAddMember = true
                } label: {
                    Label("Add member", systemImage: "plus")
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Theme.green)
                        .foregroundStyle(.black)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            ForEach(vm.members) { member in
                memberCard(member)
            }
        }
    }

    private func memberCard(_ member: OrgMember) -> some View {
        let isSelf = member.email.lowercased() == (session.user?.email ?? "").lowercased()
        let busy = vm.busyMemberId == member.id

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Theme.headerGradient).frame(width: 36, height: 36)
                    Text(initials(member.name)).font(.caption.bold()).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(member.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                        if isSelf {
                            Text("(you)").font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    Text(member.email).font(.caption2).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                statusBadge(member.status)
            }

            HStack {
                Menu {
                    ForEach(Capabilities.roles, id: \.self) { role in
                        Button(Capabilities.roleLabels[role] ?? role) {
                            Task { await vm.changeRole(member, role: role, actorEmail: session.user?.email ?? "") }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(Capabilities.roleLabels[member.role] ?? member.role).font(.caption.weight(.semibold))
                        Image(systemName: "chevron.down").font(.caption2)
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Theme.cardAlt)
                    .clipShape(Capsule())
                }
                .disabled(isSelf || busy)

                Spacer()

                if !isSelf {
                    Button {
                        Task { await vm.toggleStatus(member, actorEmail: session.user?.email ?? "") }
                    } label: {
                        Text(member.status == "inactive" ? "Activate" : "Deactivate")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(member.status == "inactive" ? Theme.green : Theme.statusRisk)
                    }
                    .disabled(busy)
                }
            }
        }
        .opacity(busy ? 0.6 : 1)
        .cardStyle(padding: 14, corner: Theme.cornerSmall)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = status == "active" ? Theme.statusGood : status == "invited" ? Theme.statusInfo : Theme.textTertiary
        let label = status == "invited" ? "Invited" : status == "inactive" ? "Inactive" : "Active"
        return Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let chars = parts.compactMap { $0.first }.prefix(2)
        return String(chars).uppercased()
    }

    // MARK: Permissions

    private var permissionsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Toggle which features each role can access.")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)

            HStack(spacing: 8) {
                ForEach(Capabilities.editableRoles, id: \.self) { role in
                    PillChip(label: Capabilities.roleLabels[role] ?? role, isSelected: vm.selectedPermissionsRole == role) {
                        vm.selectedPermissionsRole = role
                    }
                }
            }

            Text("Admin always has full access \u{1F512}").font(.caption).foregroundStyle(Theme.textTertiary)

            ForEach(Capabilities.groups, id: \.self) { group in
                let caps = Capabilities.caps(in: group)
                if !caps.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group).font(.caption.weight(.bold)).foregroundStyle(Theme.textTertiary)
                        ForEach(caps, id: \.key) { cap in
                            capRow(cap)
                        }
                    }
                    .cardStyle(padding: 12, corner: Theme.cornerSmall)
                }
            }

            Button {
                Task { await vm.saveCaps(actorEmail: session.user?.email ?? "") }
            } label: {
                Text(vm.capSaved ? "\u{2713} Saved" : "Save permissions")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(StakeSecondaryButtonStyle(tint: vm.capSaved ? Theme.green : Theme.textPrimary))
            .disabled(vm.savingCaps)
        }
    }

    private func capRow(_ cap: CapabilityMeta) -> some View {
        let role = vm.selectedPermissionsRole
        let checked = vm.matrix[role]?[cap.key] ?? false
        return HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 1) {
                Text(cap.label).font(.footnote.weight(.semibold)).foregroundStyle(Theme.textPrimary)
                Text(cap.description).font(.caption2).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Toggle("", isOn: Binding(
                get: { checked },
                set: { _ in vm.toggleCap(role: role, cap: cap.key) }
            ))
            .labelsHidden()
            .tint(Theme.green)
        }
    }
}

private struct AddMemberSheet: View {
    let invitedBy: String
    let onSave: (String, String, String) async -> String?

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var role = "project_lead"
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Full name") {
                    TextField("Jane Doe", text: $name)
                }
                Section("Email") {
                    TextField("jane@org.com", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                }
                Section("Role") {
                    Picker("Role", selection: $role) {
                        ForEach(Capabilities.roles, id: \.self) { r in
                            Text(Capabilities.roleLabels[r] ?? r).tag(r)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                if let error {
                    Text(error).foregroundStyle(Theme.statusRisk)
                }
            }
            .navigationTitle("Add member")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Adding…" : "Add") {
                        Task {
                            saving = true
                            error = await onSave(name, email, role)
                            saving = false
                        }
                    }
                    .disabled(saving)
                }
            }
        }
    }
}
