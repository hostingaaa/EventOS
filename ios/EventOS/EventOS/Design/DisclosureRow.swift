import SwiftUI

/// A collapsible row showing a title + count when collapsed, expanding to
/// reveal arbitrary content — used for the Team page's "Unassigned" bucket
/// and each account's "Completed" task list.
struct DisclosureRow<Content: View>: View {
    let title: String
    let count: Int
    @Binding var isExpanded: Bool
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.easeInOut(duration: 0.15)) { isExpanded.toggle() }
            } label: {
                HStack {
                    Text(title).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text("\(count)").font(.subheadline).foregroundStyle(Theme.textSecondary)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(14)
                .background(Theme.cardAlt)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            }
            .buttonStyle(.plain)

            if isExpanded {
                content()
            }
        }
    }
}
