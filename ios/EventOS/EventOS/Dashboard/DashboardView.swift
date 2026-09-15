import SwiftUI

/// Secondary tools reachable from the Home screen's "+" speed-dial button.
enum QuickTool: String, Identifiable {
    case tasks, templates, designs, generators
    var id: String { rawValue }
}

struct DashboardView: View {
    @StateObject private var vm = DashboardViewModel()
    @EnvironmentObject private var session: SessionStore
    @State private var showSignOut = false
    @State private var showCalendar = false
    @State private var activeTool: QuickTool?
    @State private var toolsExpanded = false

    private var speedDialItems: [SpeedDialItem] {
        [
            SpeedDialItem(id: "generators", icon: "bolt.fill", label: "Generators") { activeTool = .generators },
            SpeedDialItem(id: "designs", icon: "paintbrush.fill", label: "Designs") { activeTool = .designs },
            SpeedDialItem(id: "templates", icon: "doc.on.doc.fill", label: "Templates") { activeTool = .templates },
            SpeedDialItem(id: "tasks", icon: "doc.text.fill", label: "Tasks") { activeTool = .tasks },
        ]
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                header

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        if vm.loading {
                            ProgressView("Loading events…").tint(Theme.green)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 40)
                        } else if let error = vm.error {
                            Text(error).foregroundStyle(Theme.statusRisk)
                        } else {
                            if let featured = vm.featuredEvent {
                                featuredCard(featured)
                            }

                            eventsSection

                            if !vm.completedGroups.isEmpty {
                                completedSection
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 32)
                }
                .background(Theme.bg)
                .refreshable { await vm.load() }
            }

            SpeedDialScrim(isExpanded: $toolsExpanded)

            VStack(spacing: 14) {
                SpeedDialMenu(items: speedDialItems, isExpanded: $toolsExpanded)

                FloatingActionButton(systemImage: "calendar") {
                    showCalendar = true
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 16)
        }
        .background(Theme.bg)
        .navigationBarHidden(true)
        .task { await vm.load() }
        .confirmationDialog("Account", isPresented: $showSignOut) {
            Button("Sign out", role: .destructive) { session.signOut() }
        }
        .sheet(isPresented: $showCalendar) {
            CalendarView()
        }
        .navigationDestination(item: $activeTool) { tool in
            switch tool {
            case .tasks:
                TaskTemplatesView()
            case .templates:
                OrgTemplatesView()
            case .designs:
                ComingSoonView(title: "Designs", icon: "paintbrush.fill", message: "Badge, table tent, certificate, and banner design tools are coming to the iOS app soon.")
            case .generators:
                GeneratorsHubView()
            }
        }
    }

    // MARK: Header (green gradient zone)

    private var header: some View {
        VStack(spacing: 20) {
            HStack {
                Label("Home", systemImage: "house.fill")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Spacer()
                Button { Task { await vm.load() } } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(.white.opacity(0.15))
                        .clipShape(Circle())
                }
                Button { showSignOut = true } label: {
                    Image(systemName: "person.fill")
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(.white.opacity(0.15))
                        .clipShape(Circle())
                }
            }

            if vm.summary.total > 0 {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("Portfolio completion").font(.subheadline).foregroundStyle(.white.opacity(0.85))
                        Spacer()
                        Text("\(vm.summary.total) active").font(.caption).foregroundStyle(.white.opacity(0.7))
                    }
                    Text("\(vm.summary.avgCompletion)%").font(.system(size: 40, weight: .bold)).foregroundStyle(.white)

                    HStack(spacing: 10) {
                        headerStatPill("\(vm.summary.onTrack)", "On track")
                        headerStatPill("\(vm.summary.attention)", "Attention")
                        headerStatPill("\(vm.summary.atRisk + vm.summary.critical)", "At risk")
                    }
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 24)
        .background(Theme.headerGradient)
    }

    private func headerStatPill(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.headline).foregroundStyle(.white)
            Text(label).font(.caption2).foregroundStyle(.white.opacity(0.75))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(.white.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }

    // MARK: Featured event hero card

    private func featuredCard(_ event: Event) -> some View {
        let health = vm.healthByCode[event.code]
        let tierColor = Theme.tierColor(health?.tier)

        return NavigationLink {
            EventWorkspaceView(eventCode: event.code)
        } label: {
            ZStack(alignment: .bottomLeading) {
                GradientTile(colors: [tierColor.opacity(0.55), Theme.greenDeep], glyph: "star.fill", height: 190)

                VStack {
                    HStack {
                        Label("Featured event", systemImage: "sparkles")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.green)
                        Spacer()
                        OverlayBadge(text: Theme.tierLabel(health?.tier), systemImage: "leaf.fill")
                    }
                    Spacer()
                }
                .padding(14)

                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(event.code) · \(event.location.isEmpty ? "—" : event.location)")
                            .font(.headline).foregroundStyle(.white)
                        if let health {
                            HStack(spacing: 5) {
                                Image(systemName: "arrow.up.circle.fill").foregroundStyle(Theme.green)
                                Text("\(health.completion)% complete").foregroundStyle(.white)
                                Text("· \(health.doneTasks)/\(health.totalTasks) tasks").foregroundStyle(.white.opacity(0.75))
                            }
                            .font(.footnote.weight(.semibold))
                        }
                    }
                    Spacer()
                }
                .padding(14)
                .background(
                    LinearGradient(colors: [.black.opacity(0.75), .clear], startPoint: .bottom, endPoint: .top)
                        .frame(height: 100),
                    alignment: .bottom
                )
            }
            .frame(height: 190)
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous).stroke(Theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Events section (filters + grid + full list)

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeaderRow(icon: "calendar", title: "Events")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DashboardFilter.allCases) { filter in
                        PillChip(label: filter.label, isSelected: vm.filter == filter) {
                            vm.filter = filter
                        }
                    }
                }
            }

            if vm.events.isEmpty {
                Text("No events yet.").foregroundStyle(Theme.textSecondary)
            } else if !vm.gridEvents.isEmpty {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(vm.gridEvents) { event in
                        GridEventCard(event: event, health: vm.healthByCode[event.code])
                    }
                }
            }

            if !vm.loading && vm.activeCount == 0 && !vm.events.isEmpty {
                Text("No active events match the current filter.").foregroundStyle(Theme.textSecondary)
            }

            ForEach(vm.activeGroups) { group in
                monthGroupSection(group)
            }
        }
    }

    private func monthGroupSection(_ group: MonthGroup) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(group.month).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("\(group.events.count)").font(.caption).foregroundStyle(Theme.textSecondary)
            }
            VStack(spacing: 10) {
                ForEach(group.events) { event in
                    NavigationLink {
                        EventWorkspaceView(eventCode: event.code)
                    } label: {
                        EventListCard(
                            event: event,
                            health: vm.healthByCode[event.code],
                            daysUntilStart: vm.daysUntilStart(event),
                            isHappening: vm.isHappening(event)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var completedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation { vm.showCompleted.toggle() }
            } label: {
                HStack {
                    Text("Completed events").font(.subheadline.bold())
                    Spacer()
                    Text("\(vm.completedGroups.reduce(0) { $0 + $1.events.count })").foregroundStyle(Theme.textSecondary)
                    Image(systemName: vm.showCompleted ? "chevron.up" : "chevron.down")
                        .foregroundStyle(Theme.textSecondary)
                }
                .foregroundStyle(Theme.textPrimary)
                .padding(14)
                .background(Theme.cardAlt)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            }
            .buttonStyle(.plain)

            if vm.showCompleted {
                ForEach(vm.completedGroups) { group in
                    monthGroupSection(group)
                }
            }
        }
    }
}

// MARK: - Grid card (2-column quick glance, mirrors Stake's property grid tiles)

private struct GridEventCard: View {
    let event: Event
    let health: EventHealth?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topLeading) {
                GradientTile(colors: [Theme.tierColor(health?.tier).opacity(0.5), Theme.card], glyph: "building.2.fill", height: 110)
                VStack {
                    HStack {
                        if let health, health.totalTasks > 0 {
                            OverlayBadge(text: "\(health.totalTasks) tasks", systemImage: "checklist")
                        } else {
                            OverlayBadge(text: "New", systemImage: "sparkles", tint: Theme.green)
                        }
                        Spacer()
                    }
                    Spacer()
                    HStack {
                        OverlayBadge(text: Theme.tierLabel(health?.tier))
                        Spacer()
                    }
                }
                .padding(8)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(event.code).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                Text(event.location.isEmpty ? "—" : event.location)
                    .font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
        }
    }
}

// MARK: - Full list row card (month-grouped list, mirrors Stake's full property list rows)

private struct EventListCard: View {
    let event: Event
    let health: EventHealth?
    let daysUntilStart: Int?
    let isHappening: Bool

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3).fill(Theme.tierColor(health?.tier)).frame(width: 5, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(event.code).font(.headline).foregroundStyle(Theme.textPrimary)
                    if event.venue.trimmingCharacters(in: .whitespaces).isEmpty {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.statusAttention).font(.caption)
                    }
                    if isHappening {
                        Text("● Now").font(.caption2.bold()).foregroundStyle(Theme.green)
                    } else if let days = daysUntilStart, days >= 0, days <= 7 {
                        Text(days == 0 ? "Today" : "In \(days)d").font(.caption2.bold()).foregroundStyle(Theme.statusAttention)
                    }
                }
                Text(event.location.isEmpty ? "—" : event.location).font(.subheadline).foregroundStyle(Theme.textSecondary)
                Text(DateDisplay.eventDateRange(startIso: event.startDate, endIso: event.endDate, fallback: event.dates))
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }

            Spacer()

            if let health {
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(health.completion)%").font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    Text("\(health.doneTasks)/\(health.totalTasks)").font(.caption2).foregroundStyle(Theme.textSecondary)
                }
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
        }
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(Theme.border, lineWidth: 1)
        )
    }
}

#Preview {
    NavigationStack { DashboardView() }.environmentObject(SessionStore())
}
