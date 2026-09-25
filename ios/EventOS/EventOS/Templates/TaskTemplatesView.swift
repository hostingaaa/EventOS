import SwiftUI
import UniformTypeIdentifiers

struct TaskTemplatesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = TaskTemplatesViewModel()
    @State private var draft: TemplateDraft?
    @State private var filePickerTemplateId: String?
    @State private var deactivateTarget: TaskTemplate?

    private var isAdmin: Bool { session.user?.isAdmin ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if vm.loading {
                    ProgressView("Loading templates…").tint(Theme.green)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk)
                } else if vm.templates.isEmpty {
                    Text("No task templates yet.").foregroundStyle(Theme.textSecondary)
                } else {
                    ForEach(vm.templates) { item in
                        templateCard(item)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Task Templates")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        draft = .new()
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .sheet(item: $draft) { draft in
            TemplateEditSheet(draft: draft) { saved in
                Task {
                    if await vm.save(saved, actorEmail: session.user?.email ?? "") {
                        self.draft = nil
                    }
                }
            } onCancel: {
                self.draft = nil
            }
        }
        .fileImporter(
            isPresented: Binding(get: { filePickerTemplateId != nil }, set: { if !$0 { filePickerTemplateId = nil } }),
            allowedContentTypes: [.item],
            allowsMultipleSelection: false
        ) { result in
            guard let templateId = filePickerTemplateId else { return }
            handleFileImport(result, templateId: templateId)
        }
        .confirmationDialog(
            "Deactivate this template?",
            isPresented: Binding(get: { deactivateTarget != nil }, set: { if !$0 { deactivateTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button("Deactivate", role: .destructive) {
                if let target = deactivateTarget {
                    Task { await vm.deactivate(target, actorEmail: session.user?.email ?? "") }
                }
                deactivateTarget = nil
            }
            Button("Cancel", role: .cancel) { deactivateTarget = nil }
        }
    }

    private func handleFileImport(_ result: Result<[URL], Error>, templateId: String) {
        guard case .success(let urls) = result, let url = urls.first else { return }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return }
        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        Task {
            await vm.uploadFile(templateId: templateId, fileName: url.lastPathComponent, mimeType: mimeType, data: data, actorEmail: session.user?.email ?? "")
        }
    }

    private func templateCard(_ item: TaskTemplateWithFiles) -> some View {
        let template = item.template
        let busy = vm.busyTemplateId == template.templateId

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(template.category.isEmpty ? "General" : template.category)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.green.opacity(0.18))
                    .foregroundStyle(Theme.green)
                    .clipShape(Capsule())
                Spacer()
            }

            Text(template.title).font(.headline).foregroundStyle(Theme.textPrimary)

            Text(template.instructions.isEmpty ? "No instructions" : template.instructions)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)

            if !template.defaultAssigneeName.isEmpty {
                Label("Default: \(template.defaultAssigneeName)", systemImage: "person.fill")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }
            if let offset = template.dueOffsetDays {
                Label("Due \(offset >= 0 ? "+\(offset)" : "\(offset)") days from event start", systemImage: "calendar.badge.clock")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }

            if !item.files.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(item.files) { file in
                        if let url = URL(string: file.driveUrl) {
                            Link(destination: url) {
                                Label(file.fileName, systemImage: "paperclip")
                                    .font(.caption).foregroundStyle(Theme.green)
                            }
                        }
                    }
                }
            }

            if isAdmin {
                HStack(spacing: 10) {
                    Button {
                        draft = .editing(template)
                    } label: {
                        Label("Edit", systemImage: "pencil").font(.caption.weight(.semibold))
                    }
                    Button {
                        filePickerTemplateId = template.templateId
                    } label: {
                        Label("Add file", systemImage: "paperclip").font(.caption.weight(.semibold))
                    }
                    Spacer()
                    Button {
                        deactivateTarget = template
                    } label: {
                        Label("Deactivate", systemImage: "trash").font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(Theme.statusRisk)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.green)
                .padding(.top, 4)
                .opacity(busy ? 0.5 : 1)
                .disabled(busy)
            }
        }
        .cardStyle()
    }
}

private struct TemplateEditSheet: View {
    @State var draft: TemplateDraft
    let onSave: (TemplateDraft) -> Void
    let onCancel: () -> Void
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    field("Title") {
                        TextField("e.g. {{event_name}} AV setup", text: $draft.title)
                            .textFieldStyle(.plain).styledInput()
                    }
                    field("Category") {
                        TextField("General", text: $draft.category)
                            .textFieldStyle(.plain).styledInput()
                    }
                    field("Instructions") {
                        TextEditor(text: $draft.instructions)
                            .frame(minHeight: 100)
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .background(Theme.cardAlt)
                            .foregroundStyle(Theme.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                    }
                    field("Default assignee name") {
                        TextField("Jane Doe", text: $draft.defaultAssigneeName)
                            .textFieldStyle(.plain).styledInput()
                    }
                    field("Default assignee email") {
                        TextField("jane@company.com", text: $draft.defaultAssigneeEmail)
                            .textFieldStyle(.plain).styledInput()
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }
                    field("Due date offset (days from event start)") {
                        TextField("e.g. -7", text: $draft.dueOffsetDaysText)
                            .textFieldStyle(.plain).styledInput()
                            .keyboardType(.numbersAndPunctuation)
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle(draft.templateId == nil ? "New Template" : "Edit Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onCancel).foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saving = true
                        onSave(draft)
                    }
                    .foregroundStyle(Theme.green)
                    .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }

    private func field(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            content()
        }
    }
}

private extension View {
    func styledInput() -> some View {
        self.padding(12)
            .background(Theme.cardAlt)
            .foregroundStyle(Theme.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }
}
