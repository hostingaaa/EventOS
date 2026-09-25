import Foundation

/// Local-only persistence for design drafts, one JSON file per event code.
/// Mirrors web's localStorage-backed `designStore.ts` in scope (no backend
/// sync, no Drive upload of the draft itself) but uses Application Support
/// (not Documents — this is app-internal draft state, not a user-visible
/// document) since iOS has no local-storage-equivalent precedent anywhere
/// else in this app yet.
enum DesignStore {
    private struct SavedDesign: Codable {
        var setup: EventDesignSetup
        var attendees: [DesignAttendee]
    }

    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("designs", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func fileURL(for eventCode: String) -> URL {
        let safe = eventCode.trimmingCharacters(in: .whitespaces).uppercased()
        return directory.appendingPathComponent("design_\(safe).json")
    }

    static func load(eventCode: String) -> (setup: EventDesignSetup, attendees: [DesignAttendee])? {
        guard let data = try? Data(contentsOf: fileURL(for: eventCode)) else { return nil }
        guard let decoded = try? JSONDecoder().decode(SavedDesign.self, from: data) else { return nil }
        return (decoded.setup, decoded.attendees)
    }

    static func save(setup: EventDesignSetup, attendees: [DesignAttendee]) {
        let record = SavedDesign(setup: setup, attendees: attendees)
        guard let data = try? JSONEncoder().encode(record) else { return }
        try? data.write(to: fileURL(for: setup.eventCode), options: .atomic)
    }

    static func delete(eventCode: String) {
        try? FileManager.default.removeItem(at: fileURL(for: eventCode))
    }

    /// Event codes with a saved draft, for the hub's "in progress" list.
    static func savedEventCodes() -> [String] {
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { load(eventCode: $0.deletingPathExtension().lastPathComponent.replacingOccurrences(of: "design_", with: "")) }
            .map { $0.setup.eventCode }
    }

    static func allSavedDesigns() -> [(setup: EventDesignSetup, attendeeCount: Int)] {
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { url -> (EventDesignSetup, Int)? in
                guard let data = try? Data(contentsOf: url),
                      let decoded = try? JSONDecoder().decode(SavedDesign.self, from: data) else { return nil }
                return (decoded.setup, decoded.attendees.count)
            }
            .map { (setup: $0.0, attendeeCount: $0.1) }
    }
}
