import Foundation
import SwiftUI
import UIKit

/// Shared hex-color parsing for both SwiftUI chrome (the "Locked" brand swatch)
/// and the UIKit-based PDF builder (which needs `UIColor` for `CGContext` fills).
func rgbComponents(hex: String) -> (r: CGFloat, g: CGFloat, b: CGFloat) {
    let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: s).scanHexInt64(&value)
    return (
        CGFloat((value >> 16) & 0xFF) / 255,
        CGFloat((value >> 8) & 0xFF) / 255,
        CGFloat(value & 0xFF) / 255
    )
}

extension Color {
    init(hex: String) {
        let c = rgbComponents(hex: hex)
        self.init(red: c.r, green: c.g, blue: c.b)
    }
}

extension UIColor {
    convenience init(hex: String) {
        let c = rgbComponents(hex: hex)
        self.init(red: c.r, green: c.g, blue: c.b, alpha: 1)
    }
}

/// Mirrors web/src/utils/designStore.ts's BADGE_PRESETS exactly (label, width mm, height mm).
enum BadgePreset: String, CaseIterable, Identifiable, Codable {
    case p90x54 = "90x54", p85x55 = "85x55", p105x74 = "105x74", p105x148 = "105x148", custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .p90x54: return "90 × 54 mm — standard credit-card"
        case .p85x55: return "85 × 55 mm — standard"
        case .p105x74: return "105 × 74 mm — medium lanyard"
        case .p105x148: return "105 × 148 mm — large / A6"
        case .custom: return "Custom size…"
        }
    }

    var size: (w: Double, h: Double) {
        switch self {
        case .p90x54: return (90, 54)
        case .p85x55: return (85, 55)
        case .p105x74: return (105, 74)
        case .p105x148: return (105, 148)
        case .custom: return (90, 54)
        }
    }
}

enum BannerSize: String, CaseIterable, Identifiable, Codable {
    case s85x200 = "85x200", s80x200 = "80x200"
    var id: String { rawValue }
    var label: String { self == .s85x200 ? "85 × 200 cm" : "80 × 200 cm" }
    var widthMm: Double { self == .s85x200 ? 850 : 800 }
}

struct DesignSigner: Codable, Equatable, Identifiable {
    var id = UUID()
    var name = ""
    var title = ""
}

struct DesignAttendee: Codable, Equatable, Identifiable {
    var id = UUID()
    var name = ""
    var title = ""
    var organization = ""
}

/// Local-only draft state for one event's design assets — mirrors web's
/// `EventDesignSetup` but stores logos as native `Data` (JSONEncoder/Decoder
/// already round-trip `Data` through JSON as base64, so no manual string
/// management is needed the way web's localStorage blob required).
struct EventDesignSetup: Codable, Equatable {
    var eventCode: String
    var title = ""
    var dateStr = ""
    var cityCountry = ""
    var logos: [Data] = []
    var signers: [DesignSigner] = []
    var badgePreset: BadgePreset = .p90x54
    var badgeWidthMm: Double = 90
    var badgeHeightMm: Double = 54
    var bannerSize: BannerSize = .s85x200
    var savedAt: Date?

    /// Locked, non-editable brand color — matches web's hardcoded `#203864`
    /// (displayed as a "Locked" swatch there too, not a real color picker).
    static let brandColorHex = "203864"

    static func makeDefault(eventCode: String, title: String, dateStr: String, cityCountry: String) -> EventDesignSetup {
        EventDesignSetup(eventCode: eventCode, title: title, dateStr: dateStr, cityCountry: cityCountry)
    }
}

private let attendeeFieldSplitRegex = try? NSRegularExpression(pattern: "\\t|\\s*[|,]\\s*")

/// Parses pasted attendee text the same way web's `parseAttendeeText` does:
/// one attendee per line, fields split by tab, `|`, or `,`.
func parseAttendeeText(_ raw: String) -> [DesignAttendee] {
    raw
        .split(separator: "\n", omittingEmptySubsequences: true)
        .map { $0.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty }
        .compactMap { line -> DesignAttendee? in
            let parts = splitAttendeeLine(line)
            let name = parts.first?.trimmingCharacters(in: .whitespaces) ?? ""
            guard !name.isEmpty else { return nil }
            let title = parts.count > 1 ? parts[1].trimmingCharacters(in: .whitespaces) : ""
            let org = parts.count > 2 ? parts[2].trimmingCharacters(in: .whitespaces) : ""
            return DesignAttendee(name: name, title: title, organization: org)
        }
}

private func splitAttendeeLine(_ line: String) -> [String] {
    guard let regex = attendeeFieldSplitRegex else { return [line] }
    let range = NSRange(line.startIndex..., in: line)
    var result: [String] = []
    var lastEnd = line.startIndex
    regex.enumerateMatches(in: line, range: range) { match, _, _ in
        guard let match, let matchRange = Range(match.range, in: line) else { return }
        result.append(String(line[lastEnd..<matchRange.lowerBound]))
        lastEnd = matchRange.upperBound
    }
    result.append(String(line[lastEnd...]))
    return result
}
