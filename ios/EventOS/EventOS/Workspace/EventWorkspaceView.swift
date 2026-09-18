import SwiftUI

struct EventWorkspaceView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm: WorkspaceViewModel
    @State private var tab: Tab = .tasks
    @State private var revenueInput: String = ""
    @State private var costDescription = ""
    @State private var costCategory = ""
    @State private var costQuantity = "1"
    @State private var costUnitRate = ""
    @State private var costCurrency = "USD"

    enum Tab: String, CaseIterable, Identifiable {
        case tasks = "Tasks", overview = "Overview", financials = "Financials", activity = "Activity"
        var id: String { rawValue }
    }

    init(eventCode: String) {
        _vm = StateObject(wrappedValue: WorkspaceViewModel(eventCode: eventCode))
    }

    var body: some View {
        Group {
            if vm.loading {
                ProgressView("Loading workspace…").tint(Theme.green)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.error, vm.data == nil {
                Text(error).foregroundStyle(Theme.statusRisk)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let data = vm.data {
                content(data)
            }
        }
        .background(Theme.bg)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 8) {
                    Text(vm.eventCode).font(.headline).foregroundStyle(Theme.textPrimary)
                    if vm.isAwarded {
                        Text("AWARDED")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Theme.green.opacity(0.18))
                            .foregroundStyle(Theme.green)
                            .clipShape(Capsule())
                    }
                }
            }
            if session.user?.isAdmin == true, vm.data != nil {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await vm.toggleAwarded(actorEmail: session.user?.email ?? "") }
                    } label: {
                        if vm.savingAwarded {
                            ProgressView().tint(Theme.green)
                        } else {
                            Image(systemName: vm.isAwarded ? "checkmark.seal.fill" : "seal")
                                .foregroundStyle(Theme.green)
                        }
                    }
                    .disabled(vm.savingAwarded)
                }
            }
        }
        .task { await vm.load() }
    }

    @ViewBuilder
    private func content(_ data: WorkspaceData) -> some View {
        VStack(spacing: 0) {
            underlineTabBar

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    readinessCard

                    switch tab {
                    case .tasks: taskList(data)
                    case .overview: overview(data)
                    case .financials: financialsTab(data)
                    case .activity: activityLog(data)
                    }
                }
                .padding(16)
            }
            .refreshable { await vm.load() }

            bottomBar(data)
        }
        .background(Theme.bg)
    }

    // MARK: Underline tab bar (mirrors Stake's property-detail tab strip)

    private var underlineTabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases) { t in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { tab = t }
                } label: {
                    VStack(spacing: 8) {
                        Text(t.rawValue)
                            .font(.subheadline.weight(tab == t ? .bold : .regular))
                            .foregroundStyle(tab == t ? Theme.textPrimary : Theme.textSecondary)
                        Rectangle()
                            .fill(tab == t ? Theme.green : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 12)
        .background(Theme.bg)
        .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .bottom)
    }

    // MARK: Readiness card

    private var readinessCard: some View {
        let r = vm.readiness
        return Group {
            if r.total > 0 {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Operational readiness").font(.caption).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text("\(Int(Double(r.done) / Double(r.total) * 100))%").font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    }
                    ProgressView(value: Double(r.done), total: Double(r.total))
                        .tint(Theme.green)
                    HStack(spacing: 14) {
                        readinessStat("\(r.done) complete", Theme.statusGood)
                        readinessStat("\(r.total - r.done) remaining", Theme.textSecondary)
                        if r.blocked > 0 { readinessStat("\(r.blocked) blocked", Theme.statusRisk) }
                        if r.overdue > 0 { readinessStat("\(r.overdue) overdue", Theme.statusAttention) }
                    }
                }
                .cardStyle()
            }
        }
    }

    private func readinessStat(_ text: String, _ color: Color) -> some View {
        Text(text).font(.caption2.weight(.semibold)).foregroundStyle(color)
    }

    // MARK: Tasks tab

    private func taskList(_ data: WorkspaceData) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                TextField("New task title", text: $vm.newTaskTitle)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Theme.cardAlt)
                    .foregroundStyle(Theme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                Button("Add") {
                    Task { await vm.createTask(createdBy: session.user?.email ?? "") }
                }
                .buttonStyle(StakePrimaryButtonStyle())
                .fixedSize()
                .disabled(vm.newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if data.tasks.isEmpty {
                Text("No operational tasks yet.").foregroundStyle(Theme.textSecondary)
            }

            VStack(spacing: 10) {
                ForEach(data.tasks) { task in
                    TaskCard(task: task, busy: vm.busyTaskId == task.taskId) {
                        Task { await vm.toggleComplete(task, actorEmail: session.user?.email ?? "") }
                    } onStatusChange: { newStatus in
                        Task { await vm.updateStatus(task, to: newStatus, actorEmail: session.user?.email ?? "") }
                    }
                }
            }
        }
    }

    // MARK: Overview tab

    private func overview(_ data: WorkspaceData) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 0) {
                SectionHeaderRow(icon: "info.circle.fill", title: "Event details")
                    .padding(.bottom, 12)
                detailRow("Location", data.event.location)
                detailRow("Dates", DateDisplay.eventDateRange(startIso: data.event.startDate, endIso: data.event.endDate, fallback: data.event.dates))
                detailRow("Venue", data.event.venue)
                detailRow("LEM", data.event.lem)
                detailRow("AV", data.event.av)
                detailRow("Interpreters", data.event.interpreters)
                detailRow("SOW", data.event.sow, last: data.event.notes.isEmpty && data.event.driveFolderUrl == nil)
                detailRow("Owner", data.event.ownerEmail, last: data.event.notes.isEmpty && data.event.driveFolderUrl == nil)

                if !data.event.notes.isEmpty {
                    Text(data.event.notes).font(.footnote).foregroundStyle(Theme.textSecondary).padding(.top, 10)
                }
                if let url = data.event.driveFolderUrl, let link = URL(string: url) {
                    Link(destination: link) {
                        Label("Open Drive folder", systemImage: "arrow.up.forward.square")
                    }
                    .font(.subheadline.bold())
                    .foregroundStyle(Theme.green)
                    .padding(.top, 12)
                }
            }
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "bubble.left.and.bubble.right.fill", title: "Discussion")
                ForEach(vm.eventLevelComments) { comment in
                    CommentCard(comment: comment)
                }
                commentComposer(taskId: nil)
            }
        }
    }

    private func detailRow(_ label: String, _ value: String, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text(value.isEmpty ? "—" : value).font(.subheadline.weight(.medium)).foregroundStyle(Theme.textPrimary)
            }
            .padding(.vertical, 10)
            if !last {
                Rectangle().fill(Theme.border).frame(height: 1)
            }
        }
    }

    // MARK: Financials tab

    private func financialsTab(_ data: WorkspaceData) -> some View {
        let f = vm.financials
        return VStack(alignment: .leading, spacing: 20) {
            if session.user?.isAdmin == true {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderRow(icon: "dollarsign.circle.fill", title: "Revenue")
                    HStack(spacing: 10) {
                        TextField("Contract value", text: $revenueInput)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Theme.cardAlt)
                            .foregroundStyle(Theme.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                        Button(vm.savingRevenue ? "Saving…" : "Save") {
                            Task { await vm.saveRevenue(revenueInput, actorEmail: session.user?.email ?? "") }
                        }
                        .buttonStyle(StakePrimaryButtonStyle())
                        .fixedSize()
                        .disabled(vm.savingRevenue)
                    }
                    if let profit = f.profit {
                        Text("Profit: \(formatMoney(profit))")
                            .font(.subheadline.bold())
                            .foregroundStyle(profit < 0 ? Theme.statusRisk : Theme.statusGood)
                    }
                }
                .cardStyle()
                .onAppear { revenueInput = data.event.revenue ?? "" }
            }

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "list.bullet.rectangle", title: "Cost items")

                if data.costItems.isEmpty {
                    Text("No cost items recorded yet.").foregroundStyle(Theme.textSecondary)
                }

                VStack(spacing: 10) {
                    ForEach(data.costItems) { item in
                        CostItemCard(item: item, busy: vm.busyCostItemId == item.costItemId) {
                            Task { await vm.deleteCostItem(item, actorEmail: session.user?.email ?? "") }
                        }
                    }
                }

                if !f.totalsByCurrency.isEmpty {
                    HStack(spacing: 10) {
                        ForEach(f.totalsByCurrency.sorted(by: { $0.key < $1.key }), id: \.key) { currency, total in
                            Text("Total: \(formatMoney(total, currency: currency))")
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Theme.green.opacity(0.15))
                                .foregroundStyle(Theme.green)
                                .clipShape(Capsule())
                        }
                    }
                }

                Divider().background(Theme.border).padding(.vertical, 4)

                VStack(spacing: 8) {
                    HStack(spacing: 8) {
                        formField("Description", text: $costDescription)
                        formField("Category", text: $costCategory)
                    }
                    HStack(spacing: 8) {
                        formField("Qty", text: $costQuantity).keyboardType(.decimalPad)
                        formField("Unit rate", text: $costUnitRate).keyboardType(.decimalPad)
                        formField("Currency", text: $costCurrency)
                    }
                    Button("+ Add cost item") {
                        Task {
                            await vm.addCostItem(
                                description: costDescription, category: costCategory,
                                quantity: Double(costQuantity) ?? 1, unitRate: Double(costUnitRate) ?? 0,
                                currency: costCurrency.isEmpty ? "USD" : costCurrency,
                                createdBy: session.user?.email ?? ""
                            )
                            costDescription = ""; costCategory = ""; costQuantity = "1"; costUnitRate = ""
                        }
                    }
                    .buttonStyle(StakePrimaryButtonStyle())
                    .frame(maxWidth: .infinity)
                    .disabled(costDescription.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .cardStyle()
        }
    }

    private func formField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .padding(10)
            .background(Theme.cardAlt)
            .foregroundStyle(Theme.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }

    private func formatMoney(_ amount: Double, currency: String = "USD") -> String {
        let formatted = amount.formatted(.number.precision(.fractionLength(2)))
        return "\(formatted) \(currency)"
    }

    // MARK: Activity tab

    private func activityLog(_ data: WorkspaceData) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeaderRow(icon: "clock.fill", title: "Recent activity")
            if data.activity.isEmpty {
                Text("No activity yet.").foregroundStyle(Theme.textSecondary)
            }
            ForEach(data.activity) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.summary).foregroundStyle(Theme.textPrimary)
                    HStack {
                        Text(item.actor).font(.caption).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text(item.createdAt).font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                }
                .cardStyle(padding: 12, corner: Theme.cornerSmall)
            }
        }
    }

    private func commentComposer(taskId: String?) -> some View {
        HStack(spacing: 10) {
            TextField("Add a comment…", text: $vm.newCommentBody)
                .textFieldStyle(.plain)
                .padding(12)
                .background(Theme.cardAlt)
                .foregroundStyle(Theme.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            Button("Post") {
                Task {
                    await vm.addComment(taskId: taskId, authorEmail: session.user?.email ?? "", authorName: session.user?.name ?? "")
                }
            }
            .buttonStyle(StakePrimaryButtonStyle())
            .fixedSize()
            .disabled(vm.newCommentBody.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    // MARK: Bottom action bar (mirrors Stake's "View unit / Schedule a call" persistent bar)

    private func bottomBar(_ data: WorkspaceData) -> some View {
        HStack(spacing: 12) {
            if let url = data.event.driveFolderUrl, let link = URL(string: url) {
                Link(destination: link) {
                    Label("Drive folder", systemImage: "folder.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(StakeSecondaryButtonStyle())
            }
            Button {
                withAnimation { tab = .tasks }
            } label: {
                Label("Add task", systemImage: "plus").frame(maxWidth: .infinity)
            }
            .buttonStyle(StakePrimaryButtonStyle())
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(Theme.bg.overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .top))
    }
}

// MARK: - Task card (mirrors Stake's list-item card styling)

private struct TaskCard: View {
    let task: EventTask
    let busy: Bool
    let onToggle: () -> Void
    let onStatusChange: (TaskStatus) -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(task.status == .done ? Theme.statusGood : Theme.textTertiary)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .disabled(busy)

            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .strikethrough(task.status == .done)
                    .foregroundStyle(task.status == .done ? Theme.textSecondary : Theme.textPrimary)
                HStack(spacing: 6) {
                    if !task.category.isEmpty {
                        Text(task.category).font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                    if !task.assigneeName.isEmpty {
                        Text("• \(task.assigneeName)").font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                    if !task.dueDate.isEmpty {
                        Text("• due \(DateDisplay.writtenDate(fromIso: task.dueDate))").font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                }
            }

            Spacer()

            Menu {
                ForEach(TaskStatus.allCases, id: \.self) { status in
                    Button(status.label) { onStatusChange(status) }
                }
            } label: {
                StatusBadge(status: task.status)
            }
            .disabled(busy)
        }
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(Theme.border, lineWidth: 1))
        .opacity(busy ? 0.5 : 1)
    }
}

private struct StatusBadge: View {
    let status: TaskStatus

    private var color: Color {
        switch status {
        case .todo: return Theme.textTertiary
        case .in_progress: return Theme.statusInfo
        case .blocked: return Theme.statusRisk
        case .done: return Theme.statusGood
        }
    }

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct CostItemCard: View {
    let item: CostItem
    let busy: Bool
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.description).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 6) {
                    if !item.category.isEmpty {
                        Text(item.category).font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                    if let vendorName = item.vendorName, !vendorName.isEmpty {
                        Text("• \(vendorName)").font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                    Text("• \(item.quantity.formatted()) × \(item.unitRate.formatted())")
                        .font(.caption2).foregroundStyle(Theme.textSecondary)
                }
            }

            Spacer()

            Text("\(item.total.formatted(.number.precision(.fractionLength(2)))) \(item.currency)")
                .font(.subheadline.bold())
                .foregroundStyle(Theme.textPrimary)

            Button(action: onDelete) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Theme.statusRisk.opacity(0.7))
            }
            .buttonStyle(.plain)
            .disabled(busy)
        }
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(Theme.border, lineWidth: 1))
        .opacity(busy ? 0.5 : 1)
    }
}

private struct CommentCard: View {
    let comment: Comment

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(comment.authorName.isEmpty ? comment.authorEmail : comment.authorName)
                    .font(.caption.bold()).foregroundStyle(Theme.textPrimary)
                Spacer()
                Text(comment.createdAt).font(.caption2).foregroundStyle(Theme.textTertiary)
            }
            Text(comment.body).font(.subheadline).foregroundStyle(Theme.textSecondary)
        }
        .cardStyle(padding: 12, corner: Theme.cornerSmall)
    }
}
