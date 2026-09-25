import SwiftUI

@MainActor
final class PerDiemViewModel: ObservableObject {
    @Published var travelerName = ""
    @Published var eventCode = ""
    @Published var eventName = ""
    @Published var location = ""
    @Published var dates = ""
    @Published var currency = "EUR"
    @Published var perDiemRate: Double = 35
    @Published var days: Int = 1
    @Published var maxVisa: Double = 250
    @Published var maxGround: Double = 60

    var mieTotal: Double { perDiemRate * Double(days) }

    func makePDFFile() -> URL? {
        let data = PerDiemPDFBuilder.makePDF(self)
        let name = "\(eventCode.isEmpty ? "PerDiem" : eventCode)_PerDiem.pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}

struct PerDiemView: View {
    @StateObject private var vm = PerDiemViewModel()
    @State private var pdfURL: URL?

    private static let currencies = ["EUR", "USD", "GBP", "TRY", "MAD", "TND", "LKR", "KES", "JOD"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeaderRow(icon: "person.fill", title: "Traveler & event")
                    labeledField("Traveler name", text: $vm.travelerName)
                    labeledField("Event code", text: $vm.eventCode)
                    labeledField("Event name", text: $vm.eventName)
                    labeledField("Location", text: $vm.location)
                    labeledField("Dates", text: $vm.dates)
                }
                .cardStyle()

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeaderRow(icon: "banknote.fill", title: "Disbursement")

                    Picker("Currency", selection: $vm.currency) {
                        ForEach(Self.currencies, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .tint(Theme.green)
                    .foregroundStyle(Theme.textPrimary)

                    numberField("Daily rate (M&IE)", value: $vm.perDiemRate)
                    Stepper("Days: \(vm.days)", value: $vm.days, in: 1...60)
                    numberField("Max visa/passport reimbursement (USD)", value: $vm.maxVisa)
                    numberField("Max ground transport (USD)", value: $vm.maxGround)

                    Divider().background(Theme.border)

                    HStack {
                        Text("Total M&IE").font(.subheadline).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text("\(vm.currency) \(vm.mieTotal, specifier: "%.2f")")
                            .font(.title3.bold()).foregroundStyle(Theme.green)
                    }
                }
                .cardStyle()
                .foregroundStyle(Theme.textPrimary)

                Button {
                    pdfURL = vm.makePDFFile()
                } label: {
                    Label("Generate PDF", systemImage: "doc.richtext").frame(maxWidth: .infinity)
                }
                .buttonStyle(StakePrimaryButtonStyle())

                if let pdfURL {
                    ShareLink(item: pdfURL) {
                        Label("Share / Print", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(StakeSecondaryButtonStyle(tint: Theme.green))
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Per Diem Form")
        .navigationBarTitleDisplayMode(.inline)
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

    private func numberField(_ label: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            TextField(label, value: value, format: .number)
                .textFieldStyle(.plain)
                .keyboardType(.decimalPad)
                .padding(10)
                .background(Theme.cardAlt)
                .foregroundStyle(Theme.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
        }
    }
}
