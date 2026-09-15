import SwiftUI

struct CalendarView: View {
    @StateObject private var vm = CalendarViewModel()
    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible()), count: 7)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if vm.loading {
                        ProgressView("Loading calendar…").tint(Theme.green)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else if let error = vm.error {
                        Text(error).foregroundStyle(Theme.statusRisk)
                    } else {
                        monthNavigator
                        calendarGrid
                        agendaSection
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.green)
                }
            }
        }
        .task { await vm.load() }
    }

    private var monthNavigator: some View {
        HStack {
            Button { withAnimation { vm.goToPreviousMonth() } } label: {
                Image(systemName: "chevron.left").foregroundStyle(Theme.textPrimary)
                    .padding(10).background(Theme.cardAlt).clipShape(Circle())
            }
            Spacer()
            Text(vm.monthTitle).font(.title3.bold()).foregroundStyle(Theme.textPrimary)
            Spacer()
            Button { withAnimation { vm.goToNextMonth() } } label: {
                Image(systemName: "chevron.right").foregroundStyle(Theme.textPrimary)
                    .padding(10).background(Theme.cardAlt).clipShape(Circle())
            }
        }
    }

    private var calendarGrid: some View {
        VStack(spacing: 10) {
            HStack {
                ForEach(vm.weekdaySymbols, id: \.self) { symbol in
                    Text(symbol.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(Array(vm.gridDays.enumerated()), id: \.offset) { _, day in
                    if let day {
                        dayCell(day)
                    } else {
                        Color.clear.frame(height: 40)
                    }
                }
            }
        }
        .cardStyle()
    }

    private func dayCell(_ day: Date) -> some View {
        let isSelected = vm.selectedDay.map { vm.isSameDay($0, day) } ?? false
        let isToday = vm.isToday(day)
        let tier = vm.dominantTier(on: day)

        return Button {
            withAnimation { vm.selectedDay = isSelected ? nil : day }
        } label: {
            VStack(spacing: 4) {
                Text("\(Calendar.current.component(.day, from: day))")
                    .font(.subheadline.weight(isToday ? .bold : .regular))
                    .foregroundStyle(isSelected ? Color.black : (isToday ? Theme.green : Theme.textPrimary))
                Circle()
                    .fill(tier != nil ? Theme.tierColor(tier) : .clear)
                    .frame(width: 5, height: 5)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(isSelected ? Theme.green : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isToday && !isSelected ? Theme.green : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var agendaSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(
                icon: "list.bullet.rectangle.fill",
                title: vm.selectedDay != nil ? "Selected day" : vm.monthTitle
            )

            if vm.agendaEvents.isEmpty {
                Text("No events on this day.").foregroundStyle(Theme.textSecondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(vm.agendaEvents) { event in
                        NavigationLink {
                            EventWorkspaceView(eventCode: event.code)
                        } label: {
                            agendaRow(event)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func agendaRow(_ event: Event) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3)
                .fill(Theme.tierColor(vm.healthByCode[event.code]?.tier))
                .frame(width: 5, height: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(event.code).font(.headline).foregroundStyle(Theme.textPrimary)
                Text(event.location.isEmpty ? "—" : event.location)
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
                Text(DateDisplay.eventDateRange(startIso: event.startDate, endIso: event.endDate, fallback: event.dates))
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
        }
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }
}

#Preview {
    CalendarView()
}
