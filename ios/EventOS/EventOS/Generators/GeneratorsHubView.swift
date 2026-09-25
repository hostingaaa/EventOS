import SwiftUI

struct GeneratorsHubView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                NavigationLink {
                    TransferListView()
                } label: {
                    GeneratorCard(
                        icon: "airplane",
                        title: "Transfer List",
                        description: "Build the airport ↔ hotel transfer list — groups travelers by flight and auto-assigns a vehicle by headcount.",
                        detail: "SEDAN · VAN · SPRINTER · MINIBUS · BUS"
                    )
                }

                NavigationLink {
                    AVEquipmentView()
                } label: {
                    GeneratorCard(
                        icon: "tv",
                        title: "AV Equipment List",
                        description: "Pick setup style and PAX, then configure each equipment item for the event.",
                        detail: "Sound · Projection · Mics · Interpretation"
                    )
                }

                NavigationLink {
                    PerDiemView()
                } label: {
                    GeneratorCard(
                        icon: "banknote",
                        title: "Per Diem Form",
                        description: "Enter the daily rate, visa cap, and ground transport cap — generates a signable PDF to share or print.",
                        detail: nil
                    )
                }

                NavigationLink {
                    ComingSoonView(
                        title: "SOW Generator",
                        icon: "doc.badge.gearshape",
                        message: "Upload a SOW PDF to auto-extract event details and create the event — coming to the iOS app soon."
                    )
                } label: {
                    GeneratorCard(
                        icon: "doc.badge.gearshape",
                        title: "SOW Event Generator",
                        description: "Upload a SOW PDF and auto-create the event workspace in one click.",
                        detail: "Admin · Coming soon"
                    )
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Generators")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct GeneratorCard: View {
    let icon: String
    let title: String
    let description: String
    let detail: String?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(Theme.headerGradient).frame(width: 46, height: 46)
                Image(systemName: icon).foregroundStyle(.white).font(.system(size: 18, weight: .semibold))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline).foregroundStyle(Theme.textPrimary)
                Text(description).font(.subheadline).foregroundStyle(Theme.textSecondary)
                if let detail {
                    Text(detail).font(.caption.weight(.semibold)).foregroundStyle(Theme.green)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
        }
        .cardStyle()
    }
}
