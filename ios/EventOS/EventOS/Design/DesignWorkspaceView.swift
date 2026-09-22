import SwiftUI
import PhotosUI

struct DesignWorkspaceView: View {
    @StateObject private var vm: DesignWorkspaceViewModel
    @State private var editingSigner: DesignSigner?
    @State private var newSignerName = ""
    @State private var newSignerTitle = ""

    init(eventCode: String, seedEvent: Event? = nil) {
        _vm = StateObject(wrappedValue: DesignWorkspaceViewModel(eventCode: eventCode, seedEvent: seedEvent))
    }

    var body: some View {
        VStack(spacing: 0) {
            tabBar

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    switch vm.tab {
                    case .setup: setupTab
                    case .attendees: attendeesTab
                    case .generate: generateTab
                    }
                }
                .padding(16)
            }
        }
        .background(Theme.bg)
        .navigationTitle(vm.eventCode)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Tab bar (mirrors EventWorkspaceView's underline tab strip)

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(DesignTab.allCases) { t in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { vm.tab = t }
                } label: {
                    VStack(spacing: 8) {
                        Text(t == .attendees && !vm.attendees.isEmpty ? "\(t.rawValue) (\(vm.attendees.count))" : t.rawValue)
                            .font(.subheadline.weight(vm.tab == t ? .bold : .regular))
                            .foregroundStyle(vm.tab == t ? Theme.textPrimary : Theme.textSecondary)
                        Rectangle()
                            .fill(vm.tab == t ? Theme.green : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 12)
        .background(Theme.bg)
        .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .bottom)
    }

    // MARK: Setup tab

    private var setupTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "info.circle.fill", title: "Event information")
                labeledField("Event / Meeting title", text: $vm.setup.title, placeholder: "Pre-filled from event")
                labeledField("Dates", text: $vm.setup.dateStr, placeholder: "e.g. June 4–5, 2026")
                labeledField("City, Country", text: $vm.setup.cityCountry, placeholder: "Colombo, Sri Lanka")
            }
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "paintpalette.fill", title: "Branding")
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color(hex: EventDesignSetup.brandColorHex))
                        .frame(width: 28, height: 28)
                    Text("Brand color #\(EventDesignSetup.brandColorHex) — applied to all design templates")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Text("Locked")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Theme.cardAlt)
                        .foregroundStyle(Theme.textTertiary)
                        .clipShape(Capsule())
                }
            }
            .cardStyle()

            logosCard

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "person.text.rectangle", title: "Name badge size")
                Picker("Badge preset", selection: Binding(
                    get: { vm.setup.badgePreset },
                    set: { vm.applyBadgePreset($0) }
                )) {
                    ForEach(BadgePreset.allCases) { p in Text(p.label).tag(p) }
                }
                .pickerStyle(.menu)
                .tint(Theme.green)

                if vm.setup.badgePreset == .custom {
                    HStack(spacing: 12) {
                        numberField("Width (mm)", value: $vm.setup.badgeWidthMm)
                        numberField("Height (mm)", value: $vm.setup.badgeHeightMm)
                    }
                }
            }
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "rectangle.portrait", title: "Roll-up banner size")
                Picker("Banner size", selection: $vm.setup.bannerSize) {
                    ForEach(BannerSize.allCases) { s in Text(s.label).tag(s) }
                }
                .pickerStyle(.segmented)
            }
            .cardStyle()

            signersCard

            VStack(alignment: .leading, spacing: 10) {
                Button {
                    vm.saveSetup()
                } label: {
                    if vm.saving {
                        ProgressView().tint(.black).frame(maxWidth: .infinity)
                    } else {
                        Text(vm.savedJustNow ? "✓ Saved" : "Save design setup").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(StakePrimaryButtonStyle())

                if let savedAt = vm.setup.savedAt {
                    Text("Last saved \(savedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                }
            }
        }
    }

    private var logosCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "photo.on.rectangle.angled", title: "Logos & flags")
            Text("Add logos and/or country flags in display order (left → right).")
                .font(.caption).foregroundStyle(Theme.textSecondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(vm.setup.logos.enumerated()), id: \.offset) { index, data in
                        logoThumbnail(index: index, data: data)
                    }

                    PhotosPicker(selection: $vm.logoPickerItems, maxSelectionCount: 6, matching: .images) {
                        VStack(spacing: 4) {
                            Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
                            Text("Add").font(.caption2)
                        }
                        .foregroundStyle(Theme.green)
                        .frame(width: 72, height: 72)
                        .background(Theme.cardAlt)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                    }
                }
            }
        }
        .cardStyle()
    }

    private func logoThumbnail(index: Int, data: Data) -> some View {
        VStack(spacing: 4) {
            if let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 64, height: 48)
            }
            HStack(spacing: 6) {
                if index > 0 {
                    Button { vm.moveLogo(from: index, to: index - 1) } label: {
                        Image(systemName: "arrow.left.circle.fill").font(.caption)
                    }
                }
                Button { vm.removeLogo(at: index) } label: {
                    Image(systemName: "xmark.circle.fill").font(.caption).foregroundStyle(Theme.statusRisk)
                }
                if index < vm.setup.logos.count - 1 {
                    Button { vm.moveLogo(from: index, to: index + 1) } label: {
                        Image(systemName: "arrow.right.circle.fill").font(.caption)
                    }
                }
            }
            .foregroundStyle(Theme.textSecondary)
        }
        .padding(6)
        .frame(width: 72, height: 72)
        .background(Theme.cardAlt)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }

    private var signersCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "signature", title: "Certificate signers")
            Text("Add one or more people who will sign the certificates.")
                .font(.caption).foregroundStyle(Theme.textSecondary)

            ForEach(vm.setup.signers) { signer in
                if editingSigner?.id == signer.id {
                    VStack(spacing: 8) {
                        TextField("Full name", text: Binding(
                            get: { editingSigner?.name ?? "" },
                            set: { editingSigner?.name = $0 }
                        ))
                        .textFieldStyle(.plain).padding(8).background(Theme.cardAlt)
                        .foregroundStyle(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))

                        TextField("Title / Position", text: Binding(
                            get: { editingSigner?.title ?? "" },
                            set: { editingSigner?.title = $0 }
                        ))
                        .textFieldStyle(.plain).padding(8).background(Theme.cardAlt)
                        .foregroundStyle(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))

                        Button("✓ Done") {
                            if let editingSigner { vm.upsertSigner(editingSigner) }
                            editingSigner = nil
                        }
                        .buttonStyle(StakePrimaryButtonStyle())
                    }
                } else {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(signer.name.isEmpty ? "(No name)" : signer.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                            Text(signer.title).font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Button("Edit") { editingSigner = signer }
                            .font(.caption.weight(.semibold)).foregroundStyle(Theme.green)
                        Button {
                            vm.removeSigner(signer)
                        } label: {
                            Image(systemName: "trash").foregroundStyle(Theme.statusRisk)
                        }
                    }
                    .padding(10)
                    .background(Theme.cardAlt)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                }
            }

            Button("+ Add signer") {
                let newSigner = DesignSigner()
                vm.upsertSigner(newSigner)
                editingSigner = newSigner
            }
            .font(.caption.weight(.semibold)).foregroundStyle(Theme.green)
        }
        .cardStyle()
    }

    // MARK: Attendees tab

    private var attendeesTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeaderRow(icon: "square.and.pencil", title: "Paste / import names")
                Text("One attendee per line: Name (tab or | or ,) Title (tab|,) Organization")
                    .font(.caption).foregroundStyle(Theme.textSecondary)

                TextEditor(text: $vm.pasteText)
                    .frame(height: 120)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Theme.cardAlt)
                    .foregroundStyle(Theme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))

                if let parseError = vm.parseError {
                    Text(parseError).font(.caption).foregroundStyle(Theme.statusRisk)
                }

                Button("Add to list") { vm.importPastedAttendees() }
                    .buttonStyle(StakeSecondaryButtonStyle(tint: Theme.green))
            }
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "person.3.fill", title: "Attendee list")
                ForEach(vm.attendees) { attendee in
                    attendeeRow(attendee)
                }
                Button("+ Add attendee") { vm.addBlankAttendee() }
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.green)
            }
            .cardStyle()
        }
    }

    private func attendeeRow(_ attendee: DesignAttendee) -> some View {
        VStack(spacing: 6) {
            HStack {
                TextField("Name", text: Binding(
                    get: { attendee.name },
                    set: { var a = attendee; a.name = $0; vm.updateAttendee(a) }
                ))
                .textFieldStyle(.plain).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)

                Button {
                    vm.removeAttendee(attendee)
                } label: {
                    Image(systemName: "trash").foregroundStyle(Theme.statusRisk)
                }
            }
            HStack(spacing: 8) {
                TextField("Title", text: Binding(
                    get: { attendee.title },
                    set: { var a = attendee; a.title = $0; vm.updateAttendee(a) }
                ))
                .textFieldStyle(.plain).font(.caption).foregroundStyle(Theme.textSecondary)

                TextField("Organization", text: Binding(
                    get: { attendee.organization },
                    set: { var a = attendee; a.organization = $0; vm.updateAttendee(a) }
                ))
                .textFieldStyle(.plain).font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(10)
        .background(Theme.cardAlt)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
    }

    // MARK: Generate tab

    private var generateTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeaderRow(icon: "printer.fill", title: "Select documents to generate")
                Text(vm.attendees.isEmpty
                     ? "⚠️ Add attendees first (Attendees tab) for personalized documents."
                     : "\(vm.attendees.count) attendee\(vm.attendees.count == 1 ? "" : "s") will be used.")
                .font(.caption).foregroundStyle(Theme.textSecondary)

                Toggle(isOn: $vm.genBadge) {
                    genLabel(icon: "🪪", title: "Name Badges", detail: "Name, title & organization on each badge")
                }
                .tint(Theme.green)

                if vm.genBadge {
                    Picker("Sheet size", selection: $vm.badgeSheet) {
                        ForEach(DesignSheetSize.allCases) { s in Text(s.rawValue).tag(s) }
                    }
                    .pickerStyle(.segmented)
                    .padding(.leading, 20)
                }

                Toggle(isOn: $vm.genTent) {
                    genLabel(icon: "🔖", title: "Table Tents", detail: "A4 landscape, fold in half — one per attendee")
                }
                .tint(Theme.green)

                Toggle(isOn: $vm.genCert) {
                    genLabel(icon: "📜", title: "Certificates", detail: "A4 landscape, name only — one per attendee")
                }
                .tint(Theme.green)

                Toggle(isOn: $vm.genBanner) {
                    genLabel(icon: "🖼️", title: "Roll-up Banner", detail: "\(vm.setup.bannerSize.label) — event branding only")
                }
                .tint(Theme.green)

                Toggle(isOn: $vm.genScreen) {
                    genLabel(icon: "📺", title: "Screen Banner", detail: "16:9 slide — logo, title, city, dates")
                }
                .tint(Theme.green)
            }
            .cardStyle()

            Button {
                vm.generate()
            } label: {
                if vm.generating {
                    ProgressView().tint(.black).frame(maxWidth: .infinity)
                } else {
                    Text("🖨️ Generate PDF(s)").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(StakePrimaryButtonStyle())
            .disabled(vm.generating || !vm.hasSelection)

            if vm.setup.savedAt == nil {
                Text("Save your design setup first before generating.")
                    .font(.caption).foregroundStyle(Theme.statusAttention)
            }
            if let generateError = vm.generateError {
                Text(generateError).font(.caption).foregroundStyle(Theme.statusRisk)
            }

            if !vm.generatedFiles.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderRow(icon: "checkmark.circle.fill", title: "Ready to share")
                    ForEach(vm.generatedFiles) { file in
                        ShareLink(item: file.url) {
                            HStack {
                                Image(systemName: "doc.richtext")
                                Text(file.title)
                                Spacer()
                                Image(systemName: "square.and.arrow.up")
                            }
                            .foregroundStyle(Theme.textPrimary)
                            .padding(10)
                            .background(Theme.cardAlt)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                        }
                    }
                }
            }
        }
    }

    private func genLabel(icon: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(icon) \(title)").font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
            Text(detail).font(.caption2).foregroundStyle(Theme.textSecondary)
        }
    }

    // MARK: Shared field helpers

    private func labeledField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            TextField(placeholder, text: text)
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
