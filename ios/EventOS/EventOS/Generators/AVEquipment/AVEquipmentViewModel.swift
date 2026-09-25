import Foundation

enum AVItemKind {
    case simpleAmount
    case lcdProjector
    case projectorScreen
    case wirelessMics
    case interpretation
}

struct AVItemDefinition: Identifiable {
    let id: String
    let name: String
    let kind: AVItemKind
    let unitLabel: String
}

let avItemDefinitions: [AVItemDefinition] = [
    .init(id: "sound", name: "Sound system", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "lcd", name: "LCD projector", kind: .lcdProjector, unitLabel: "unit(s)"),
    .init(id: "screen", name: "Projector screen", kind: .projectorScreen, unitLabel: "unit(s)"),
    .init(id: "laptop", name: "Laptop", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "feedback", name: "Feedback monitor", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "printer", name: "Printer", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "micFixed", name: "Fixed tabletop mic", kind: .simpleAmount, unitLabel: "mic(s)"),
    .init(id: "micHead", name: "Fixed tabletop mic (Head Table)", kind: .simpleAmount, unitLabel: "mic(s)"),
    .init(id: "podium", name: "Podium w/ mic", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "wirelessMic", name: "Wireless / lapel mics", kind: .wirelessMics, unitLabel: ""),
    .init(id: "internet", name: "Dedicated internet", kind: .simpleAmount, unitLabel: "connection(s)"),
    .init(id: "camera", name: "HD camera", kind: .simpleAmount, unitLabel: "unit(s)"),
    .init(id: "interpretation", name: "Simultaneous Interpretation System", kind: .interpretation, unitLabel: ""),
]

struct AVItemState: Identifiable {
    let definition: AVItemDefinition
    var id: String { definition.id }
    var enabled = false
    var amount = 1
    var luminosity = "4000 lumens"
    var screenSize = "8x8 ft"
    var lapel = 0
    var handheld = 0
    var receivers = 0
    var booths = 1

    var descriptionText: String {
        switch definition.kind {
        case .simpleAmount:
            return "\(definition.name) — \(amount) \(definition.unitLabel)"
        case .lcdProjector:
            return "LCD projector (\(luminosity)) — \(amount) unit(s)"
        case .projectorScreen:
            return "Projector screen (\(screenSize)) — \(amount) unit(s)"
        case .wirelessMics:
            return "Wireless microphones — \(lapel) lapel, \(handheld) handheld"
        case .interpretation:
            return "Simultaneous Interpretation System — \(booths) fully covered interpretation booth(s) for \(booths * 2) interpreters, with receivers for up to \(receivers) attendees"
        }
    }
}

enum AVSetupStyle: String, CaseIterable, Identifiable {
    case classroom = "Classroom", cabaret = "Cabaret", theatre = "Theatre", uShape = "U-Shape", boardroom = "Boardroom"
    var id: String { rawValue }
}

/// Named starter items for the "Supplies & Materials" list (briefing folders,
/// table tent cards, etc). Always listed as 1 day regardless of the AV
/// equipment "days" setting, since supplies aren't rented per-day.
let avSupplyCatalog = ["Briefing Folders", "Table Tent Cards", "Pen and Notepads", "Name Badges"]

struct AVSupplyItem: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var amount: Int
}

@MainActor
final class AVEquipmentViewModel: ObservableObject {
    @Published var eventCode = ""
    @Published var eventCity = ""
    @Published var eventDate = ""
    @Published var setupStyle: AVSetupStyle = .classroom
    @Published var pax = 50
    @Published var days = 1
    @Published var items: [AVItemState] = avItemDefinitions.map { AVItemState(definition: $0) }
    @Published var supplies: [AVSupplyItem] = []

    @Published var saving = false
    @Published var error: String?
    @Published var savedDriveUrl: String?
    @Published var savedFileId: String?

    var enabledItems: [AVItemState] { items.filter { $0.enabled } }
    var hasContent: Bool { !enabledItems.isEmpty || !supplies.isEmpty }

    func addSupply(name: String, amount: Int) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        supplies.append(AVSupplyItem(name: trimmed, amount: max(amount, 1)))
    }

    func removeSupply(_ id: AVSupplyItem.ID) {
        supplies.removeAll { $0.id == id }
    }

    func binding(for id: String) -> Int {
        items.firstIndex { $0.id == id } ?? 0
    }

    private func buildSpreadsheet() -> String {
        let titleStyle = SpreadsheetStyle(id: "title", bold: true, fontSize: 14, fontColor: "#FFFFFF", fillColor: "#17365D", wrap: true, hAlign: "Center")
        let sectionStyle = SpreadsheetStyle(id: "section", bold: true, fontColor: "#FFFFFF", fillColor: "#17365D", hAlign: "Center")
        let headerStyle = SpreadsheetStyle(id: "hdr", bold: true, fillColor: "#D8D8D8", border: true, hAlign: "Center")
        let descStyle = SpreadsheetStyle(id: "desc", wrap: true, border: true, hAlign: "Left")
        let cellStyle = SpreadsheetStyle(id: "cell", border: true, hAlign: "Center")

        var rows: [SpreadsheetRow] = [
            SpreadsheetRow(cells: [.text("\(eventCode) - \(eventCity) - Date: \(eventDate)\nSet up: \(setupStyle.rawValue) - \(pax) PAX", style: "title")]),
            SpreadsheetRow(cells: [
                .text("No.", style: "hdr"), .text("Name of the Service and Brief Description", style: "hdr"),
                .text("Day(s)", style: "hdr"), .text("Amount", style: "hdr"),
            ]),
        ]

        var num = 0

        if !enabledItems.isEmpty {
            rows.append(SpreadsheetRow(cells: [.text("Conference Equipment", style: "section")]))
            for item in enabledItems {
                num += 1
                let amount = item.definition.kind == .interpretation ? item.receivers
                    : item.definition.kind == .wirelessMics ? (item.lapel + item.handheld)
                    : item.amount
                rows.append(SpreadsheetRow(cells: [
                    .number(Double(num), style: "cell"),
                    .text(item.descriptionText, style: "desc"),
                    .number(Double(days), style: "cell"),
                    .number(Double(amount), style: "cell"),
                ]))
            }
        }

        // Supplies are always listed as 1 day, regardless of the equipment "days" setting.
        if !supplies.isEmpty {
            rows.append(SpreadsheetRow(cells: [.text("Conference Supplies and Materials", style: "section")]))
            for supply in supplies {
                num += 1
                rows.append(SpreadsheetRow(cells: [
                    .number(Double(num), style: "cell"),
                    .text(supply.name, style: "desc"),
                    .number(1, style: "cell"),
                    .number(Double(supply.amount), style: "cell"),
                ]))
            }
        }

        let sheetName = String((eventDate.isEmpty ? "AV Equipment" : eventDate).prefix(31))
        let sheet = SpreadsheetSheet(name: sheetName, rows: rows, columnWidths: [40, 320, 60, 70])
        return SpreadsheetMLBuilder.build(sheets: [sheet], styles: [titleStyle, sectionStyle, headerStyle, descStyle, cellStyle])
    }

    func save(actorEmail: String) async {
        let code = eventCode.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else {
            error = "Enter an event code first."
            return
        }
        guard hasContent else {
            error = "Enable at least one equipment item or add a supply first."
            return
        }
        saving = true
        error = nil
        defer { saving = false }

        let xml = buildSpreadsheet()
        guard let data = xml.data(using: .utf8) else { return }
        let fileName = "\(code)_\(eventCity.replacingOccurrences(of: " ", with: "_"))_Equipment.xls"

        do {
            let result = try await EventOSService.saveAVEquipmentToDrive(
                eventCode: code, fileName: fileName, dataBase64: data.base64EncodedString(),
                uploadedBy: actorEmail, actorEmail: actorEmail, eventLocation: eventCity, driveFileId: savedFileId
            )
            savedDriveUrl = result.driveUrl
            savedFileId = result.driveFileId
        } catch {
            self.error = error.localizedDescription
        }
    }
}
