import SwiftUI

/// The EventOS brand mark's fixed palette — distinct from `Theme`'s adaptive
/// UI colors. This is the logo's own identity, not a UI accent: tile
/// `#0b1220`, bars white, "live row" `#10b981`.
enum EventOSBrand {
    static let tile = Color(red: 0x0b / 255.0, green: 0x12 / 255.0, blue: 0x20 / 255.0)
    static let live = Color(red: 0x10 / 255.0, green: 0xb9 / 255.0, blue: 0x81 / 255.0)
}

/// The EventOS brand mark: three bars on a square tile, the middle "live
/// row" shorter (62% width) and emerald. Pure SwiftUI — no image asset
/// needed for in-app use. (The exported eventos-icon.svg / 1024px PNG in
/// Assets.xcassets are for the web favicon and the Home Screen app icon,
/// which do need real files.)
struct EventOSIcon: View {
    /// Reversed = white tile + dark bars, for placing on the app's own dark
    /// backgrounds (this app's screens are always dark) so the mark doesn't
    /// blend in. Primary (dark tile) is for light backgrounds.
    var reversed: Bool = false
    var size: CGFloat = 40

    private var tile: Color { reversed ? .white : EventOSBrand.tile }
    private var bar: Color { reversed ? EventOSBrand.tile : .white }

    var body: some View {
        let barHeight = size * 0.12
        let gap = size * 0.12
        let barsWidth = size * 0.56
        let liveWidth = barsWidth * 0.62
        let corner = size * 0.03

        ZStack(alignment: .topLeading) {
            tile
            VStack(alignment: .leading, spacing: gap) {
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(bar)
                    .frame(width: barsWidth, height: barHeight)
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(EventOSBrand.live)
                    .frame(width: liveWidth, height: barHeight)
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(bar)
                    .frame(width: barsWidth, height: barHeight)
            }
            .padding(.leading, size * 0.22)
            .padding(.top, size * 0.20)
        }
        .frame(width: size, height: size)
        .clipShape(Rectangle()) // zero corner radius — square tile, no rounding
    }
}

/// Icon + live "EventOS" text, matching the web EventOSWordmark component.
/// "OS" is always emerald; "Event" follows the current foreground color.
struct EventOSWordmark: View {
    var reversed: Bool = false
    var iconSize: CGFloat = 28
    var textSize: CGFloat = 20

    var body: some View {
        HStack(spacing: 8) {
            EventOSIcon(reversed: reversed, size: iconSize)
            // Archivo isn't bundled in the app (the web wordmark uses it via
            // Google Fonts); the system font at bold weight is the honest
            // in-app equivalent rather than naming a font that isn't there.
            (
                Text("Event")
                    + Text("OS").foregroundColor(EventOSBrand.live)
            )
            .font(.system(size: textSize, weight: .bold, design: .default))
        }
    }
}

#Preview {
    VStack(spacing: 32) {
        EventOSIcon(size: 96)
        EventOSWordmark(reversed: true, iconSize: 32, textSize: 24)
            .foregroundColor(.white)
    }
    .padding(40)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Theme.bg)
}
