import Foundation

@MainActor
final class OrgTemplatesViewModel: ObservableObject {
    static let categories = ["Print Materials", "Social Media", "Forms", "Branding", "Other"]

    @Published var files: [OrgTemplateFile] = []
    @Published var loading = true
    @Published var error: String?
    @Published var busyId: String?

    func load() async {
        loading = true
        error = nil
        do {
            files = try await EventOSService.fetchOrgTemplates()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    func grouped() -> [(category: String, files: [OrgTemplateFile])] {
        var result: [(String, [OrgTemplateFile])] = []
        for cat in Self.categories {
            let matches = files.filter { $0.category == cat }
            if !matches.isEmpty { result.append((cat, matches)) }
        }
        let known = Set(Self.categories)
        let leftover = files.filter { !known.contains($0.category) }
        if !leftover.isEmpty {
            if let idx = result.firstIndex(where: { $0.0 == "Other" }) {
                result[idx].1.append(contentsOf: leftover)
            } else {
                result.append(("Other", leftover))
            }
        }
        return result
    }

    /// Attach/replace the file on an existing slot.
    func uploadToExisting(id: String, fileName: String, mimeType: String, data: Data, actorEmail: String) async {
        busyId = id
        defer { busyId = nil }
        do {
            let updated = try await EventOSService.uploadOrgTemplateFile(
                id: id, fileName: fileName, mimeType: mimeType, dataBase64: data.base64EncodedString(), actorEmail: actorEmail
            )
            if let idx = files.firstIndex(where: { $0.id == id }) {
                files[idx] = updated
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Create a brand-new slot.
    func addNew(name: String, category: String, fileName: String, mimeType: String, data: Data, actorEmail: String) async {
        busyId = "new"
        defer { busyId = nil }
        do {
            let created = try await EventOSService.uploadOrgTemplateFile(
                name: name, category: category, fileName: fileName, mimeType: mimeType,
                dataBase64: data.base64EncodedString(), actorEmail: actorEmail
            )
            files.append(created)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func delete(_ file: OrgTemplateFile, actorEmail: String) async {
        busyId = file.id
        defer { busyId = nil }
        do {
            try await EventOSService.deleteOrgTemplateFile(id: file.id, actorEmail: actorEmail)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
