import Foundation

enum TravelerType: String, CaseIterable, Identifiable {
    case expert = "EXPERT", participant = "PARTICIPANT"
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct TravelerEntry: Identifiable, Equatable {
    var id = UUID()
    var firstName = ""
    var lastName = ""
    var phone = ""
    var type: TravelerType = .participant
    var arrivalDate: Date?
    var arrivalFlight = ""
    var arrivalTime: Date?
    var departureDate: Date?
    var departureFlight = ""
    var departureTime: Date?
    var departurePickupOffsetMinutes: Int = 180

    var fullName: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }

    var departurePickupTime: Date? {
        guard let departureTime else { return nil }
        return Calendar.current.date(byAdding: .minute, value: -departurePickupOffsetMinutes, to: departureTime)
    }
}

@MainActor
final class TransferListViewModel: ObservableObject {
    @Published var eventCode = ""
    @Published var eventCity = ""
    @Published var eventDates = ""
    @Published var hotel = ""
    @Published var arrivalAirport = ""
    @Published var departureAirport = ""
    @Published var travelers: [TravelerEntry] = []

    @Published var saving = false
    @Published var error: String?
    @Published var savedDriveUrl: String?
    @Published var savedFileId: String?

    static func vehicle(forCount count: Int) -> String {
        switch count {
        case ...2: return "SEDAN"
        case 3...7: return "VAN"
        case 8...14: return "SPRINTER"
        case 15...24: return "MINIBUS"
        default: return "BUS"
        }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()
    // Written-month format for on-screen display only — dayString() stays
    // "yyyy-MM-dd" since it also backs sort/group keys and the Excel export.
    private static let displayDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM yyyy"
        return f
    }()
    static func dayString(_ d: Date?) -> String { d.map { dayFormatter.string(from: $0) } ?? "" }
    static func displayDayString(_ d: Date?) -> String { d.map { displayDayFormatter.string(from: $0) } ?? "" }
    static func timeString(_ d: Date?) -> String { d.map { timeFormatter.string(from: $0) } ?? "" }

    private func groupKey(date: Date?, flight: String, time: Date?) -> String {
        "\(Self.dayString(date))|\(flight)|\(Self.timeString(time))"
    }

    var arrivalGroups: [String: [TravelerEntry]] {
        Dictionary(grouping: travelers.filter { $0.arrivalDate != nil }) {
            groupKey(date: $0.arrivalDate, flight: $0.arrivalFlight, time: $0.arrivalTime)
        }
    }

    var departureGroups: [String: [TravelerEntry]] {
        Dictionary(grouping: travelers.filter { $0.departureDate != nil }) {
            groupKey(date: $0.departureDate, flight: $0.departureFlight, time: $0.departureTime)
        }
    }

    func vehicle(for traveler: TravelerEntry, arrival: Bool) -> String {
        let key = arrival
            ? groupKey(date: traveler.arrivalDate, flight: traveler.arrivalFlight, time: traveler.arrivalTime)
            : groupKey(date: traveler.departureDate, flight: traveler.departureFlight, time: traveler.departureTime)
        let count = (arrival ? arrivalGroups : departureGroups)[key]?.count ?? 1
        return Self.vehicle(forCount: count)
    }

    var arrivalsSorted: [TravelerEntry] {
        travelers.filter { $0.arrivalDate != nil }.sorted {
            Self.dayString($0.arrivalDate) + Self.timeString($0.arrivalTime) < Self.dayString($1.arrivalDate) + Self.timeString($1.arrivalTime)
        }
    }

    var departuresSorted: [TravelerEntry] {
        travelers.filter { $0.departureDate != nil }.sorted {
            Self.dayString($0.departureDate) + Self.timeString($0.departureTime) < Self.dayString($1.departureDate) + Self.timeString($1.departureTime)
        }
    }

    func upsert(_ traveler: TravelerEntry) {
        if let idx = travelers.firstIndex(where: { $0.id == traveler.id }) {
            travelers[idx] = traveler
        } else {
            travelers.append(traveler)
        }
    }

    func remove(_ traveler: TravelerEntry) {
        travelers.removeAll { $0.id == traveler.id }
    }

    // MARK: Export

    private func headerStyle() -> String { "hdr" }

    private func buildSpreadsheet() -> String {
        let titleStyle = SpreadsheetStyle(id: "title", bold: true, fontSize: 16, fontColor: "#C00000", fillColor: "#FDEADA", wrap: true, hAlign: "Center")
        let headerStyle = SpreadsheetStyle(id: "hdr", bold: true, fontSize: 10, fillColor: "#DBEEF4", border: true, hAlign: "Center")
        let cellStyle = SpreadsheetStyle(id: "cell", fontSize: 10, wrap: true, border: true, hAlign: "Center")

        func row(_ arrival: Bool, _ t: TravelerEntry) -> SpreadsheetRow {
            if arrival {
                return SpreadsheetRow(cells: [
                    .text(t.type.label, style: "cell"),
                    .text(t.firstName, style: "cell"),
                    .text(t.lastName, style: "cell"),
                    .text(t.phone, style: "cell"),
                    .text(Self.dayString(t.arrivalDate), style: "cell"),
                    .text(t.arrivalFlight, style: "cell"),
                    .text(Self.timeString(t.arrivalTime), style: "cell"),
                    .text(vehicle(for: t, arrival: true), style: "cell"),
                ])
            } else {
                return SpreadsheetRow(cells: [
                    .text(t.type.label, style: "cell"),
                    .text(t.firstName, style: "cell"),
                    .text(t.lastName, style: "cell"),
                    .text(t.phone, style: "cell"),
                    .text(Self.dayString(t.departureDate), style: "cell"),
                    .text(t.departureFlight, style: "cell"),
                    .text(Self.timeString(t.departureTime), style: "cell"),
                    .text(Self.timeString(t.departurePickupTime), style: "cell"),
                    .text(vehicle(for: t, arrival: false), style: "cell"),
                ])
            }
        }

        var arrivalRows: [SpreadsheetRow] = [
            SpreadsheetRow(cells: [.text("From \(arrivalAirport) to \(hotel)", style: "title")]),
            SpreadsheetRow(cells: [
                .text("Type", style: "hdr"), .text("First Name", style: "hdr"), .text("Last Name", style: "hdr"),
                .text("Cell Number", style: "hdr"), .text("Arrival Date", style: "hdr"),
                .text("Flight Number", style: "hdr"), .text("Arrival Time", style: "hdr"), .text("Vehicle", style: "hdr"),
            ]),
        ]
        arrivalRows.append(contentsOf: arrivalsSorted.map { row(true, $0) })

        var departureRows: [SpreadsheetRow] = [
            SpreadsheetRow(cells: [.text("From \(hotel) to \(departureAirport)", style: "title")]),
            SpreadsheetRow(cells: [
                .text("Type", style: "hdr"), .text("First Name", style: "hdr"), .text("Last Name", style: "hdr"),
                .text("Cell Number", style: "hdr"), .text("Departure Date", style: "hdr"),
                .text("Flight Number", style: "hdr"), .text("Departure Time", style: "hdr"),
                .text("Hotel Pickup Time", style: "hdr"), .text("Vehicle", style: "hdr"),
            ]),
        ]
        departureRows.append(contentsOf: departuresSorted.map { row(false, $0) })

        let sheets = [
            SpreadsheetSheet(name: "Arrivals", rows: arrivalRows, columnWidths: [70, 90, 90, 90, 90, 100, 80, 80]),
            SpreadsheetSheet(name: "Departures", rows: departureRows, columnWidths: [70, 90, 90, 90, 90, 100, 80, 100, 80]),
        ]
        return SpreadsheetMLBuilder.build(sheets: sheets, styles: [titleStyle, headerStyle, cellStyle])
    }

    func save(actorEmail: String) async {
        let code = eventCode.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else {
            error = "Enter an event code first."
            return
        }
        guard !travelers.isEmpty else {
            error = "Add at least one traveler first."
            return
        }
        saving = true
        error = nil
        defer { saving = false }

        let xml = buildSpreadsheet()
        guard let data = xml.data(using: .utf8) else { return }
        let safeCity = eventCity.replacingOccurrences(of: " ", with: "_")
        let fileName = "\(code)_\(safeCity)_Transfer_List.xls"

        do {
            let result = try await EventOSService.saveTransferListToDrive(
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
