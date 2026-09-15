import SwiftUI

struct TransferListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = TransferListViewModel()
    @State private var editingTraveler: TravelerEntry?
    @State private var showAddSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                setupCard

                if !vm.arrivalsSorted.isEmpty {
                    section(title: "Arrivals", travelers: vm.arrivalsSorted, arrival: true)
                }
                if !vm.departuresSorted.isEmpty {
                    section(title: "Departures", travelers: vm.departuresSorted, arrival: false)
                }
                if vm.travelers.isEmpty {
                    Text("No travelers added yet.").foregroundStyle(Theme.textSecondary)
                }

                Button {
                    editingTraveler = TravelerEntry()
                } label: {
                    Label("Add traveler", systemImage: "person.badge.plus").frame(maxWidth: .infinity)
                }
                .buttonStyle(StakeSecondaryButtonStyle(tint: Theme.green))

                if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk).font(.footnote)
                }
                if let url = vm.savedDriveUrl, let link = URL(string: url) {
                    Link(destination: link) {
                        Label("Saved to Drive — open file", systemImage: "checkmark.circle.fill")
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.green)
                }

                Button {
                    Task { await vm.save(actorEmail: session.user?.email ?? "") }
                } label: {
                    if vm.saving {
                        ProgressView().tint(.black).frame(maxWidth: .infinity)
                    } else {
                        Text("Save to Drive").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(StakePrimaryButtonStyle())
                .disabled(vm.saving)
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Transfer List")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editingTraveler) { traveler in
            TravelerEditSheet(traveler: traveler) { saved in
                vm.upsert(saved)
                editingTraveler = nil
            } onCancel: {
                editingTraveler = nil
            }
        }
    }

    private var setupCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "airplane", title: "Event details")
            labeledField("Event code", text: $vm.eventCode)
            labeledField("City", text: $vm.eventCity)
            labeledField("Dates", text: $vm.eventDates)
            labeledField("Hotel", text: $vm.hotel)
            labeledField("Arrival airport", text: $vm.arrivalAirport)
            labeledField("Departure airport", text: $vm.departureAirport)
        }
        .cardStyle()
    }

    private func labeledField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            TextField(label, text: text)
                .textFieldStyle(.plain)
                .padding(10)
                .background(Theme.cardAlt)
                .foregroundStyle(Theme.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        }
    }

    private func section(title: String, travelers: [TravelerEntry], arrival: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeaderRow(icon: arrival ? "arrow.down.circle.fill" : "arrow.up.circle.fill", title: title)
            VStack(spacing: 8) {
                ForEach(travelers) { traveler in
                    Button {
                        editingTraveler = traveler
                    } label: {
                        travelerRow(traveler, arrival: arrival)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func travelerRow(_ traveler: TravelerEntry, arrival: Bool) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(traveler.fullName.isEmpty ? "Unnamed traveler" : traveler.fullName)
                    .font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                let flight = arrival ? traveler.arrivalFlight : traveler.departureFlight
                let time = arrival ? TransferListViewModel.timeString(traveler.arrivalTime) : TransferListViewModel.timeString(traveler.departureTime)
                let date = arrival ? TransferListViewModel.displayDayString(traveler.arrivalDate) : TransferListViewModel.displayDayString(traveler.departureDate)
                Text("\(flight.isEmpty ? "—" : flight) · \(date) \(time)").font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Text(vm.vehicle(for: traveler, arrival: arrival))
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Theme.green.opacity(0.18))
                .foregroundStyle(Theme.green)
                .clipShape(Capsule())
        }
        .cardStyle(padding: 12, corner: Theme.cornerSmall)
    }
}

private struct TravelerEditSheet: View {
    @State var traveler: TravelerEntry
    let onSave: (TravelerEntry) -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Personal") {
                    TextField("First name", text: $traveler.firstName)
                    TextField("Last name", text: $traveler.lastName)
                    TextField("Phone", text: $traveler.phone).keyboardType(.phonePad)
                    Picker("Type", selection: $traveler.type) {
                        ForEach(TravelerType.allCases) { Text($0.label).tag($0) }
                    }
                }
                Section("Arrival") {
                    DatePicker("Date", selection: Binding(get: { traveler.arrivalDate ?? Date() }, set: { traveler.arrivalDate = $0 }), displayedComponents: .date)
                    TextField("Flight number", text: $traveler.arrivalFlight)
                    DatePicker("Time", selection: Binding(get: { traveler.arrivalTime ?? Date() }, set: { traveler.arrivalTime = $0 }), displayedComponents: .hourAndMinute)
                }
                Section("Departure") {
                    DatePicker("Date", selection: Binding(get: { traveler.departureDate ?? Date() }, set: { traveler.departureDate = $0 }), displayedComponents: .date)
                    TextField("Flight number", text: $traveler.departureFlight)
                    DatePicker("Time", selection: Binding(get: { traveler.departureTime ?? Date() }, set: { traveler.departureTime = $0 }), displayedComponents: .hourAndMinute)
                    Stepper("Pickup \(traveler.departurePickupOffsetMinutes) min before", value: $traveler.departurePickupOffsetMinutes, in: 150...270, step: 15)
                }
            }
            .navigationTitle(traveler.fullName.isEmpty ? "New Traveler" : traveler.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { onSave(traveler) }
                }
            }
        }
    }
}
