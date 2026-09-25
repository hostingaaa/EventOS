import SwiftUI

/// Small circular floating button pinned above the tab bar, mirroring the
/// dark floating icon button seen on Stake's screens.
struct FloatingActionButton: View {
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            FloatingIconVisual(systemImage: systemImage)
        }
        .buttonStyle(.plain)
    }
}

/// The bare circle+icon visual, for use as a `Menu`'s label (Menu supplies its
/// own tap handling, so the label shouldn't be a `Button` itself).
struct FloatingIconVisual: View {
    let systemImage: String

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 54, height: 54)
            .background(Theme.cardAlt)
            .clipShape(Circle())
            .overlay(Circle().stroke(Theme.border, lineWidth: 1))
            .shadow(color: .black.opacity(0.4), radius: 10, y: 4)
    }
}
