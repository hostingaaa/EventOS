import SwiftUI

@MainActor
final class DesignsHubViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var savedDesigns: [(setup: EventDesignSetup, attendeeCount: Int)] = []
    @Published var loading = true
    @Published var error: String?

    func load() async {
        loading = true
        error = nil
        do {
            let res = try await EventOSService.fetchEvents()
            events = res.events
        } catch {
            self.error = error.localizedDescription
        }
        savedDesigns = DesignStore.allSavedDesigns()
        loading = false
    }
}

private let designTypes: [(icon: String, title: String, desc: String)] = [
    ("person.text.rectangle", "Name Badge", "Personalized with name, title & organization. Fits multiple per A4 / A3 sheet."),
    ("tent", "Table Tent", "A4 landscape, fold-in-half — name visible from both sides."),
    ("doc.text.image", "Certificate", "A4 landscape, signed certificate of participation."),
    ("rectangle.portrait", "Roll-up Banner", "85 × 200 cm or 80 × 200 cm — event branding only."),
    ("tv", "Screen Banner", "16:9 presentation slide — logo, title, city, dates."),
]

struct DesignsHubView: View {
    @StateObject private var vm = DesignsHubViewModel()

    var body: some View {
        Group {
            if vm.loading {
                ProgressView("Loading…").tint(Theme.green)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                content
            }
        }
        .background(Theme.bg)
        .navigationTitle("Designs")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Create print-ready design assets for your events — name badges, table tents, certificates, and banners.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)

                if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk).font(.footnote)
                }

                if !vm.savedDesigns.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeaderRow(icon: "clock.arrow.circlepath", title: "In progress")
                        VStack(spacing: 10) {
                            ForEach(vm.savedDesigns, id: \.setup.eventCode) { entry in
                                NavigationLink {
                                    DesignWorkspaceView(eventCode: entry.setup.eventCode)
                                } label: {
                                    savedDesignCard(entry)
                                }
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderRow(icon: "plus.circle.fill", title: "Start a new design")
                    VStack(spacing: 10) {
                        ForEach(vm.events) { event in
                            NavigationLink {
                                DesignWorkspaceView(eventCode: event.code, seedEvent: event)
                            } label: {
                                eventRow(event)
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderRow(icon: "square.grid.2x2", title: "Supported design types")
                    VStack(spacing: 10) {
                        ForEach(designTypes, id: \.title) { type in
                            HStack(spacing: 14) {
                                Image(systemName: type.icon)
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(Theme.green)
                                    .frame(width: 32)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(type.title).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                                    Text(type.desc).font(.caption).foregroundStyle(Theme.textSecondary)
                                }
                            }
                            .cardStyle(padding: 12)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func savedDesignCard(_ entry: (setup: EventDesignSetup, attendeeCount: Int)) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color(hex: EventDesignSetup.brandColorHex))
                .frame(width: 6, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.setup.eventCode).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                Text(entry.setup.title.isEmpty ? "Untitled design" : entry.setup.title)
                    .font(.caption).foregroundStyle(Theme.textSecondary)
                if entry.attendeeCount > 0 {
                    Text("\(entry.attendeeCount) attendee\(entry.attendeeCount == 1 ? "" : "s")")
                        .font(.caption2).foregroundStyle(Theme.textTertiary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
        }
        .cardStyle(padding: 12)
    }

    private func eventRow(_ event: Event) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(event.code).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                Text("\(event.location) · \(event.dates)").font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
        }
        .cardStyle(padding: 12)
    }
}
