import SwiftUI

/// Design tokens for the dark navy + emerald-green look (inspired by Stake's investor app),
/// applied across EventOS's screens: dashboard, workspace, team.
enum Theme {
    // Backgrounds
    static let bg = Color(red: 0.035, green: 0.055, blue: 0.09)           // #090E17 page background
    static let card = Color(red: 0.071, green: 0.098, blue: 0.145)        // #121925 card surface
    static let cardAlt = Color(red: 0.098, green: 0.133, blue: 0.192)     // #192231 nested surface
    static let border = Color.white.opacity(0.08)

    // Text
    static let textPrimary = Color.white
    static let textSecondary = Color(red: 0.60, green: 0.66, blue: 0.75)  // muted blue-gray
    static let textTertiary = Color(red: 0.42, green: 0.47, blue: 0.56)

    // Brand green
    static let green = Color(red: 0.11, green: 0.84, blue: 0.62)         // #1CD69E bright accent
    static let greenDeep = Color(red: 0.06, green: 0.35, blue: 0.28)     // deep gradient base
    static let greenMid = Color(red: 0.09, green: 0.52, blue: 0.40)

    // Status
    static let statusGood = green
    static let statusAttention = Color(red: 0.96, green: 0.65, blue: 0.20)  // amber
    static let statusRisk = Color(red: 0.98, green: 0.36, blue: 0.36)       // coral red
    static let statusInfo = Color(red: 0.32, green: 0.62, blue: 0.98)       // blue (in progress)

    static var headerGradient: LinearGradient {
        LinearGradient(colors: [greenMid, greenDeep], startPoint: .top, endPoint: .bottom)
    }

    static func tierColor(_ tier: String?) -> Color {
        switch tier {
        case "on-track": return statusGood
        case "attention": return statusAttention
        case "at-risk", "critical": return statusRisk
        default: return textTertiary
        }
    }

    static func eventStatusColor(_ status: EventStatus) -> Color {
        switch status {
        case .proposed: return textTertiary
        case .awarded: return green
        case .completed: return Color(hex: "475569")
        case .postponed: return statusAttention
        case .cancelled: return statusRisk
        case .archived: return Color(hex: "1e293b")
        }
    }

    static func tierLabel(_ tier: String?) -> String {
        switch tier {
        case "on-track": return "On track"
        case "attention": return "Attention"
        case "at-risk": return "At risk"
        case "critical": return "Critical"
        default: return "No data"
        }
    }

    static let corner: CGFloat = 20
    static let cornerSmall: CGFloat = 14
}

extension View {
    /// Standard dark card surface used throughout the redesigned screens.
    func cardStyle(padding: CGFloat = 16, corner: CGFloat = Theme.corner) -> some View {
        self
            .padding(padding)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .stroke(Theme.border, lineWidth: 1)
            )
    }
}

/// A small dark translucent pill used for overlay badges on hero/grid cards
/// (mirrors Stake's "33% funded" / "262 investors" / "DFSA" chips).
struct OverlayBadge: View {
    let text: String
    var systemImage: String? = nil
    var tint: Color = .white

    var body: some View {
        HStack(spacing: 5) {
            if let systemImage {
                Image(systemName: systemImage).font(.caption2.weight(.semibold))
            }
            Text(text).font(.caption2.weight(.semibold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.black.opacity(0.45))
        .clipShape(Capsule())
    }
}

/// A rounded segmented pill filter, mirroring Stake's "Available / Funded / Exited" chip row.
struct PillChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.footnote.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isSelected ? Theme.green : Theme.cardAlt)
                .foregroundStyle(isSelected ? Color.black : Theme.textSecondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// Section header with a leading SF Symbol, bold title, and an optional trailing action —
/// mirrors Stake's "💎 StakeOne opportunities · View all" pattern.
struct SectionHeaderRow: View {
    let icon: String
    let title: String
    var trailing: String? = nil
    var trailingAction: (() -> Void)? = nil

    var body: some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.title3.bold())
                .foregroundStyle(Theme.textPrimary)
            Spacer()
            if let trailing {
                Button(action: { trailingAction?() }) {
                    Text(trailing).font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// A big-number stat block used in header stat rows.
struct StatBlock: View {
    let value: String
    let label: String
    var color: Color = Theme.textPrimary
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(value).font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

/// A decorative gradient "photo" placeholder standing in for the property photos Stake uses —
/// EventOS has no imagery, so a tier-tinted gradient plus a watermark glyph fills that role.
struct GradientTile: View {
    var colors: [Color] = [Theme.greenMid, Theme.greenDeep]
    var glyph: String = "building.2.fill"
    var height: CGFloat = 150

    var body: some View {
        ZStack {
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: glyph)
                .font(.system(size: height * 0.55))
                .foregroundStyle(.white.opacity(0.14))
                .offset(x: height * 0.25, y: height * 0.08)
        }
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
    }
}
