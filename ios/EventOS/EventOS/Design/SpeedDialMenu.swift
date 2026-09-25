import SwiftUI

struct SpeedDialItem: Identifiable {
    let id: String
    let icon: String
    let label: String
    let action: () -> Void
}

/// Expanding "+" button: tapping it slides a stack of glassy pill buttons up
/// from behind it, closest item first, with a spring cascade.
struct SpeedDialMenu: View {
    /// Ordered farthest-from-button first — the last item sits closest to "+".
    let items: [SpeedDialItem]
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .trailing, spacing: 12) {
            if isExpanded {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    itemButton(item)
                        .transition(.asymmetric(
                            insertion: .move(edge: .bottom).combined(with: .opacity),
                            removal: .move(edge: .bottom).combined(with: .opacity)
                        ))
                        .animation(
                            .spring(response: 0.4, dampingFraction: 0.72)
                                .delay(Double(items.count - 1 - index) * 0.045),
                            value: isExpanded
                        )
                }
            }

            toggleButton
        }
    }

    private func itemButton(_ item: SpeedDialItem) -> some View {
        Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.8)) {
                isExpanded = false
            }
            item.action()
        } label: {
            HStack(spacing: 10) {
                Text(item.label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Image(systemName: item.icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.green)
                    .frame(width: 36, height: 36)
                    .background(.white.opacity(0.12), in: Circle())
            }
            .padding(.leading, 16)
            .padding(.trailing, 6)
            .padding(.vertical, 6)
            .background {
                Capsule()
                    .fill(.ultraThinMaterial)
                    .overlay(Capsule().fill(Theme.cardAlt.opacity(0.6)))
            }
            .overlay(Capsule().stroke(.white.opacity(0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.3), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
    }

    private var toggleButton: some View {
        Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.72)) {
                isExpanded.toggle()
            }
        } label: {
            FloatingIconVisual(systemImage: "plus")
                .rotationEffect(.degrees(isExpanded ? 45 : 0))
        }
        .buttonStyle(.plain)
    }
}

/// Full-screen tap-to-dismiss scrim shown behind an expanded speed dial.
struct SpeedDialScrim: View {
    @Binding var isExpanded: Bool

    var body: some View {
        if isExpanded {
            Color.black.opacity(0.001)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.8)) {
                        isExpanded = false
                    }
                }
        }
    }
}
