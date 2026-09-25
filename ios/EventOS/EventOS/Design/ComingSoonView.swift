import SwiftUI

/// Placeholder for features not yet ported from the web app.
struct ComingSoonView: View {
    let title: String
    let icon: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(Theme.green)
            Text(title).font(.title2.bold()).foregroundStyle(Theme.textPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
