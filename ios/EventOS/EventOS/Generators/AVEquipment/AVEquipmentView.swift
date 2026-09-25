import SwiftUI

private let customSupplyOption = "Other…"

struct AVEquipmentView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AVEquipmentViewModel()
    @State private var newSupplyName = avSupplyCatalog[0]
    @State private var newSupplyCustomName = ""
    @State private var newSupplyAmount = 1

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                setupCard

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderRow(icon: "tv", title: "Equipment")
                    VStack(spacing: 10) {
                        ForEach($vm.items) { $item in
                            itemCard($item)
                        }
                    }
                }

                suppliesCard

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
                .disabled(vm.saving || !vm.hasContent)
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("AV Equipment")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var setupCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "info.circle.fill", title: "Event details")
            labeledField("Event code", text: $vm.eventCode)
            labeledField("City", text: $vm.eventCity)
            labeledField("Date", text: $vm.eventDate)

            Picker("Setup style", selection: $vm.setupStyle) {
                ForEach(AVSetupStyle.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.menu)
            .tint(Theme.green)

            Stepper("PAX: \(vm.pax)", value: $vm.pax, in: 1...2000, step: 5)
            Stepper("Days: \(vm.days)", value: $vm.days, in: 1...8)
        }
        .cardStyle()
        .foregroundStyle(Theme.textPrimary)
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

    private var suppliesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "shippingbox.fill", title: "Supplies & Materials")
            Text("Pick an item, set the amount, and add it. Supplies are always listed as 1 day.")
                .font(.caption).foregroundStyle(Theme.textSecondary)

            HStack(spacing: 10) {
                Picker("Item", selection: $newSupplyName) {
                    ForEach(avSupplyCatalog, id: \.self) { Text($0).tag($0) }
                    Text(customSupplyOption).tag(customSupplyOption)
                }
                .pickerStyle(.menu)
                .tint(Theme.green)

                Stepper("Amt: \(newSupplyAmount)", value: $newSupplyAmount, in: 1...2000, step: 5)
            }

            if newSupplyName == customSupplyOption {
                TextField("Item name", text: $newSupplyCustomName)
                    .textFieldStyle(.plain).padding(10)
                    .background(Theme.cardAlt)
                    .foregroundStyle(Theme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            }

            Button {
                let name = newSupplyName == customSupplyOption ? newSupplyCustomName : newSupplyName
                vm.addSupply(name: name, amount: newSupplyAmount)
                newSupplyCustomName = ""
                newSupplyAmount = 1
            } label: {
                Label("Add", systemImage: "plus.circle.fill").font(.subheadline.bold())
            }
            .disabled(newSupplyName == customSupplyOption && newSupplyCustomName.trimmingCharacters(in: .whitespaces).isEmpty)
            .foregroundStyle(Theme.green)

            if !vm.supplies.isEmpty {
                VStack(spacing: 8) {
                    ForEach(Array(vm.supplies.enumerated()), id: \.element.id) { index, supply in
                        HStack(spacing: 10) {
                            Text("\(index + 1)").font(.caption.bold()).foregroundStyle(Theme.textSecondary)
                                .frame(width: 18, alignment: .trailing)
                            Text(supply.name).font(.subheadline).foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Text("×\(supply.amount)").font(.caption.bold()).foregroundStyle(Theme.textSecondary)
                            Button {
                                vm.removeSupply(supply.id)
                            } label: {
                                Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textTertiary)
                            }
                        }
                        .padding(10)
                        .background(Theme.cardAlt)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                    }
                }
            }
        }
        .cardStyle()
        .foregroundStyle(Theme.textPrimary)
    }

    @ViewBuilder
    private func itemCard(_ item: Binding<AVItemState>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle(isOn: item.enabled) {
                Text(item.wrappedValue.definition.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
            }
            .tint(Theme.green)

            if item.wrappedValue.enabled {
                switch item.wrappedValue.definition.kind {
                case .simpleAmount:
                    Stepper("Amount: \(item.wrappedValue.amount)", value: item.amount, in: 1...50)
                case .lcdProjector:
                    TextField("Luminosity", text: item.luminosity)
                        .textFieldStyle(.plain).padding(8).background(Theme.cardAlt)
                        .foregroundStyle(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    Stepper("Amount: \(item.wrappedValue.amount)", value: item.amount, in: 1...20)
                case .projectorScreen:
                    TextField("Screen size", text: item.screenSize)
                        .textFieldStyle(.plain).padding(8).background(Theme.cardAlt)
                        .foregroundStyle(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    Stepper("Amount: \(item.wrappedValue.amount)", value: item.amount, in: 1...20)
                case .wirelessMics:
                    Stepper("Lapel: \(item.wrappedValue.lapel)", value: item.lapel, in: 0...20)
                    Stepper("Handheld: \(item.wrappedValue.handheld)", value: item.handheld, in: 0...20)
                case .interpretation:
                    Stepper("Booths: \(item.wrappedValue.booths)", value: item.booths, in: 1...10)
                    Stepper("Receivers: \(item.wrappedValue.receivers)", value: item.receivers, in: 0...2000, step: 10)
                }
                Text(item.wrappedValue.descriptionText)
                    .font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
        .cardStyle(padding: 12, corner: Theme.cornerSmall)
    }
}
