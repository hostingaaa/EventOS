import SwiftUI

/// The animated EventOS mark — same choreography as web's eventos-logo.css /
/// EventOSLogo.tsx: top bar draws in, bottom bar follows 0.16s later, the
/// emerald live row lands at 1.6s, the wordmark reveals at 2.8s, and "OS"
/// pops at 3.25s. Ground #0b1220, tile #0f1728, bars white, live row
/// #10b981. No corner radius, no gradients, no second accent color.
///
/// `size` is the tile edge (proportions below mirror the web version, which
/// parametrizes off its own `size` prop the same way):
/// padding = size×0.1667, bar height = size×0.1083, gap = size×0.0917,
/// middle bar = 62% of the other bars' width.
struct EventOSLogoView: View {
    var size: CGFloat = 120
    var wordmark: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var tileIn = false
    @State private var topBarIn = false
    @State private var bottomBarIn = false
    @State private var liveBarIn = false
    @State private var wordIn = false
    @State private var osIn = false

    private var padding: CGFloat { size * 0.1667 }
    private var barHeight: CGFloat { size * 0.1083 }
    private var gap: CGFloat { size * 0.0917 }
    private var barWidth: CGFloat { size - 2 * padding }
    private var liveWidth: CGFloat { barWidth * 0.62 }
    private var wordFontSize: CGFloat { size * 0.56 } // 8.4em / 15em in the web version

    private var tileRevealed: Bool { tileIn || reduceMotion }
    private var topRevealed: Bool { topBarIn || reduceMotion }
    private var bottomRevealed: Bool { bottomBarIn || reduceMotion }
    private var liveRevealed: Bool { liveBarIn || reduceMotion }
    private var wordRevealed: Bool { wordIn || reduceMotion }
    private var osRevealed: Bool { osIn || reduceMotion }

    var body: some View {
        HStack(spacing: size * 0.2133) { // 3.2em / 15em
            tileView
            if wordmark {
                wordView
            }
        }
        .onAppear(perform: start)
    }

    private var tileView: some View {
        VStack(alignment: .leading, spacing: gap) {
            bar(width: barWidth, color: .white, revealed: topRevealed)
            bar(width: liveWidth, color: EventOSBrand.live, revealed: liveRevealed)
            bar(width: barWidth, color: .white, revealed: bottomRevealed)
        }
        .padding(.horizontal, padding)
        .frame(width: size, height: size)
        .background(EventOSLogoBrand.tile)
        .scaleEffect(tileRevealed ? 1 : 0.9)
    }

    private func bar(width: CGFloat, color: Color, revealed: Bool) -> some View {
        Rectangle()
            .fill(color)
            .frame(width: width, height: barHeight)
            .scaleEffect(x: revealed ? 1 : 0, y: 1, anchor: .leading)
    }

    private var wordView: some View {
        HStack(spacing: 0) {
            Text("Event")
                .foregroundColor(.white)
            Text("OS")
                .foregroundColor(EventOSBrand.live)
                .scaleEffect(osRevealed ? 1 : 0.72, anchor: .leading)
        }
        .font(.system(size: wordFontSize, weight: .bold))
        .opacity(wordRevealed ? 1 : 0)
        .offset(x: wordRevealed ? 0 : -1.1 * wordFontSize)
    }

    private func start() {
        guard !reduceMotion else { return } // computed properties above already jump to the final state
        withAnimation(.timingCurve(0.34, 1.56, 0.64, 1, duration: 0.85)) { tileIn = true }
        withAnimation(.timingCurve(0.77, 0, 0.175, 1, duration: 0.66)) { topBarIn = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            withAnimation(.timingCurve(0.77, 0, 0.175, 1, duration: 0.66)) { bottomBarIn = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            withAnimation(.timingCurve(0.77, 0, 0.175, 1, duration: 0.66)) { liveBarIn = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.8) {
            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.9)) { wordIn = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.25) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.55)) { osIn = true }
        }
    }
}

/// Colors specific to the animated mark — the tile shade (#0f1728) is
/// lighter than EventOSBrand.tile (#0b1220) so it reads against the app's
/// own dark ground instead of blending into it.
enum EventOSLogoBrand {
    static let tile = Color(red: 0x0f / 255.0, green: 0x17 / 255.0, blue: 0x28 / 255.0)
}

/// Full-screen splash on the app's ground color (#0b1220) — use as the root
/// view until the first load completes (see RootView's `!session.isReady`
/// branch).
struct EventOSSplashView: View {
    var body: some View {
        EventOSLogoView(size: 96)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(EventOSBrand.tile) // #0b1220 ground
    }
}

#Preview {
    VStack(spacing: 40) {
        EventOSLogoView(size: 120)
        EventOSLogoView(size: 60, wordmark: false)
    }
    .padding(40)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(EventOSBrand.tile)
}
