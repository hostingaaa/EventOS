import Foundation
import SwiftUI
import PhotosUI

enum DesignTab: String, CaseIterable, Identifiable {
    case setup = "Setup", attendees = "Attendees", generate = "Generate"
    var id: String { rawValue }
}

enum DesignSheetSize: String, CaseIterable, Identifiable {
    case a4 = "A4", a3 = "A3"
    var id: String { rawValue }
}

/// One generated output, ready to share.
struct GeneratedDesignFile: Identifiable {
    let id = UUID()
    let title: String
    let url: URL
}

@MainActor
final class DesignWorkspaceViewModel: ObservableObject {
    let eventCode: String

    @Published var setup: EventDesignSetup
    @Published var attendees: [DesignAttendee] = []
    @Published var tab: DesignTab = .setup

    @Published var saving = false
    @Published var savedJustNow = false

    @Published var pasteText = ""
    @Published var parseError: String?

    @Published var genBadge = true
    @Published var genTent = false
    @Published var genCert = false
    @Published var genBanner = false
    @Published var genScreen = false
    @Published var badgeSheet: DesignSheetSize = .a4

    @Published var generating = false
    @Published var generatedFiles: [GeneratedDesignFile] = []
    @Published var generateError: String?

    @Published var logoPickerItems: [PhotosPickerItem] = [] {
        didSet { Task { await loadPickedLogos() } }
    }

    init(eventCode: String, seedEvent: Event? = nil) {
        self.eventCode = eventCode
        if let saved = DesignStore.load(eventCode: eventCode) {
            setup = saved.setup
            attendees = saved.attendees
        } else {
            setup = .makeDefault(
                eventCode: eventCode,
                title: seedEvent?.location ?? "",
                dateStr: seedEvent?.dates ?? "",
                cityCountry: seedEvent?.location ?? ""
            )
        }
    }

    // MARK: Setup

    func saveSetup() {
        saving = true
        var updated = setup
        updated.savedAt = Date()
        setup = updated
        DesignStore.save(setup: setup, attendees: attendees)
        saving = false
        savedJustNow = true
        Task {
            try? await Task.sleep(for: .seconds(2.5))
            savedJustNow = false
        }
    }

    func applyBadgePreset(_ preset: BadgePreset) {
        setup.badgePreset = preset
        let size = preset.size
        setup.badgeWidthMm = size.w
        setup.badgeHeightMm = size.h
    }

    private func loadPickedLogos() async {
        guard !logoPickerItems.isEmpty else { return }
        var newLogos: [Data] = []
        for item in logoPickerItems {
            if let data = try? await item.loadTransferable(type: Data.self) {
                newLogos.append(data)
            }
        }
        setup.logos.append(contentsOf: newLogos)
        logoPickerItems = []
    }

    func removeLogo(at index: Int) {
        guard setup.logos.indices.contains(index) else { return }
        setup.logos.remove(at: index)
    }

    func moveLogo(from: Int, to: Int) {
        guard setup.logos.indices.contains(from), setup.logos.indices.contains(to) else { return }
        setup.logos.swapAt(from, to)
    }

    func upsertSigner(_ signer: DesignSigner) {
        if let idx = setup.signers.firstIndex(where: { $0.id == signer.id }) {
            setup.signers[idx] = signer
        } else {
            setup.signers.append(signer)
        }
    }

    func removeSigner(_ signer: DesignSigner) {
        setup.signers.removeAll { $0.id == signer.id }
    }

    // MARK: Attendees

    func importPastedAttendees() {
        let trimmed = pasteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            parseError = "Paste some names first."
            return
        }
        let parsed = parseAttendeeText(pasteText)
        guard !parsed.isEmpty else {
            parseError = "Could not parse any names — expected: Name (tab or | or ,) Title (tab|,) Organization"
            return
        }
        parseError = nil
        attendees.append(contentsOf: parsed)
        DesignStore.save(setup: setup, attendees: attendees)
        pasteText = ""
    }

    func addBlankAttendee() {
        attendees.append(DesignAttendee())
    }

    func updateAttendee(_ attendee: DesignAttendee) {
        guard let idx = attendees.firstIndex(where: { $0.id == attendee.id }) else { return }
        attendees[idx] = attendee
        DesignStore.save(setup: setup, attendees: attendees)
    }

    func removeAttendee(_ attendee: DesignAttendee) {
        attendees.removeAll { $0.id == attendee.id }
        DesignStore.save(setup: setup, attendees: attendees)
    }

    // MARK: Generate

    var hasSelection: Bool { genBadge || genTent || genCert || genBanner || genScreen }

    func generate() {
        generating = true
        generateError = nil
        generatedFiles = []
        var files: [GeneratedDesignFile] = []

        do {
            if genBadge && !attendees.isEmpty {
                let data = DesignPDFBuilder.buildNameBadgesPDF(setup: setup, attendees: attendees, sheet: badgeSheet)
                files.append(try write(data, name: "\(eventCode)_Name_Badges_\(badgeSheet.rawValue).pdf", title: "Name Badges (\(badgeSheet.rawValue))"))
            }
            if genTent && !attendees.isEmpty {
                let data = DesignPDFBuilder.buildTableTentsPDF(setup: setup, attendees: attendees)
                files.append(try write(data, name: "\(eventCode)_Table_Tents.pdf", title: "Table Tents"))
            }
            if genCert && !attendees.isEmpty {
                let data = DesignPDFBuilder.buildCertificatesPDF(setup: setup, attendees: attendees)
                files.append(try write(data, name: "\(eventCode)_Certificates.pdf", title: "Certificates"))
            }
            if genBanner {
                let data = DesignPDFBuilder.buildBannerPDF(setup: setup)
                files.append(try write(data, name: "\(eventCode)_Banner_\(setup.bannerSize.rawValue)cm.pdf", title: "Roll-up Banner"))
            }
            if genScreen {
                let data = DesignPDFBuilder.buildScreenBannerPDF(setup: setup)
                files.append(try write(data, name: "\(eventCode)_Screen_Banner.pdf", title: "Screen Banner"))
            }
            generatedFiles = files
        } catch {
            generateError = "Could not generate the PDF(s). Please try again."
        }

        generating = false
    }

    private func write(_ data: Data, name: String, title: String) throws -> GeneratedDesignFile {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try data.write(to: url, options: .atomic)
        return GeneratedDesignFile(title: title, url: url)
    }
}
