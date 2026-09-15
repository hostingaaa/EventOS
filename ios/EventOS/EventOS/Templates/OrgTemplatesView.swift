import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct OrgTemplatesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = OrgTemplatesViewModel()
    @State private var uploadTargetId: String?
    @State private var showAddSheet = false
    @State private var deleteTarget: OrgTemplateFile?
    @State private var copiedId: String?

    private var isAdmin: Bool { session.user?.isAdmin ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if vm.loading {
                    ProgressView("Loading templates…").tint(Theme.green)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk)
                } else if vm.files.isEmpty {
                    Text("No template files yet.").foregroundStyle(Theme.textSecondary)
                } else {
                    ForEach(vm.grouped(), id: \.category) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeaderRow(icon: icon(for: group.category), title: group.category, trailing: "\(group.files.count)")
                            VStack(spacing: 10) {
                                ForEach(group.files) { file in
                                    fileCard(file)
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Templates")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAddSheet = true } label: { Image(systemName: "plus") }
                }
            }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .fileImporter(
            isPresented: Binding(get: { uploadTargetId != nil }, set: { if !$0 { uploadTargetId = nil } }),
            allowedContentTypes: [.pdf, .init(filenameExtension: "docx") ?? .data, .init(filenameExtension: "xlsx") ?? .data, .item],
            allowsMultipleSelection: false
        ) { result in
            guard let id = uploadTargetId else { return }
            handleImport(result) { fileName, mimeType, data in
                Task { await vm.uploadToExisting(id: id, fileName: fileName, mimeType: mimeType, data: data, actorEmail: session.user?.email ?? "") }
            }
        }
        .confirmationDialog(
            "Remove this file from the library?",
            isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let target = deleteTarget {
                    Task { await vm.delete(target, actorEmail: session.user?.email ?? "") }
                }
                deleteTarget = nil
            }
            Button("Cancel", role: .cancel) { deleteTarget = nil }
        }
        .sheet(isPresented: $showAddSheet) {
            AddTemplateSheet { name, category, fileName, mimeType, data in
                Task {
                    await vm.addNew(name: name, category: category, fileName: fileName, mimeType: mimeType, data: data, actorEmail: session.user?.email ?? "")
                    showAddSheet = false
                }
            } onCancel: {
                showAddSheet = false
            }
        }
    }

    private func icon(for category: String) -> String {
        switch category {
        case "Print Materials": return "printer.fill"
        case "Social Media": return "app.badge.fill"
        case "Forms": return "list.clipboard.fill"
        case "Branding": return "paintpalette.fill"
        default: return "paperclip"
        }
    }

    private func fileTypeIcon(_ type: String) -> String {
        switch type {
        case "pdf": return "doc.text.fill"
        case "docx", "doc": return "doc.richtext.fill"
        case "xlsx", "xls": return "tablecells.fill"
        default: return "paperclip"
        }
    }

    private func copyShareLink(_ file: OrgTemplateFile) {
        guard let url = file.shareURL else { return }
        UIPasteboard.general.string = url.absoluteString
        copiedId = file.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if copiedId == file.id { copiedId = nil }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>, then: (String, String, Data) -> Void) {
        guard case .success(let urls) = result, let url = urls.first else { return }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return }
        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        then(url.lastPathComponent, mimeType, data)
    }

    private func fileCard(_ file: OrgTemplateFile) -> some View {
        let busy = vm.busyId == file.id
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.cardAlt).frame(width: 40, height: 40)
                    Image(systemName: fileTypeIcon(file.fileType)).foregroundStyle(Theme.green)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    if file.hasFile {
                        Text("\(file.addedBy) · \(DateDisplay.writtenDate(fromIso: file.addedAt))").font(.caption2).foregroundStyle(Theme.textSecondary)
                    } else {
                        Text(isAdmin ? "File not uploaded yet" : "Coming soon")
                            .font(.caption2).foregroundStyle(isAdmin ? Theme.statusAttention : Theme.textTertiary)
                    }
                }
                Spacer()
            }

            HStack(spacing: 10) {
                if let url = file.hasFile ? (file.downloadURL ?? file.driveUrl.flatMap(URL.init(string:))) : nil {
                    Link(destination: url) {
                        Label("View", systemImage: "arrow.down.circle").font(.caption.weight(.semibold))
                    }
                }
                if file.hasFile {
                    Button {
                        copyShareLink(file)
                    } label: {
                        Label(copiedId == file.id ? "Copied!" : "Share", systemImage: copiedId == file.id ? "checkmark.circle.fill" : "link")
                            .font(.caption.weight(.semibold))
                    }
                }
                if isAdmin {
                    Button {
                        uploadTargetId = file.id
                    } label: {
                        Label(file.hasFile ? "Replace" : "Upload", systemImage: "square.and.arrow.up")
                            .font(.caption.weight(.semibold))
                    }
                    Spacer()
                    Button(role: .destructive) {
                        deleteTarget = file
                    } label: {
                        Image(systemName: "trash").font(.caption)
                    }
                } else {
                    Spacer()
                }
            }
            .foregroundStyle(Theme.green)
            .opacity(busy ? 0.5 : 1)
            .disabled(busy)
        }
        .cardStyle(padding: 12, corner: Theme.cornerSmall)
    }
}

private struct AddTemplateSheet: View {
    let onSave: (_ name: String, _ category: String, _ fileName: String, _ mimeType: String, _ data: Data) -> Void
    let onCancel: () -> Void

    @State private var name = ""
    @State private var category = OrgTemplatesViewModel.categories[0]
    @State private var pickedFile: (name: String, mime: String, data: Data)?
    @State private var showFileImporter = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("File name", text: $name)
                    Picker("Category", selection: $category) {
                        ForEach(OrgTemplatesViewModel.categories, id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("File") {
                    Button {
                        showFileImporter = true
                    } label: {
                        if let picked = pickedFile {
                            Label(picked.name, systemImage: "checkmark.circle.fill")
                        } else {
                            Label("Choose file (PDF, Word, Excel)", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
            .navigationTitle("New Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        guard let picked = pickedFile else { return }
                        onSave(name.isEmpty ? picked.name : name, category, picked.name, picked.mime, picked.data)
                    }
                    .disabled(pickedFile == nil)
                }
            }
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: [.pdf, .init(filenameExtension: "docx") ?? .data, .init(filenameExtension: "xlsx") ?? .data, .item],
                allowsMultipleSelection: false
            ) { result in
                guard case .success(let urls) = result, let url = urls.first else { return }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { return }
                let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                pickedFile = (url.lastPathComponent, mimeType, data)
                if name.isEmpty { name = url.deletingPathExtension().lastPathComponent }
            }
        }
    }
}
