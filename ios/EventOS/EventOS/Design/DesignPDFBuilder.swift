import UIKit

/// Renders the 5 design outputs directly into PDFs via `UIGraphicsPDFRenderer`,
/// matching `PerDiemPDFBuilder.swift`'s approach. Every layout constant here is
/// a direct port of `web/src/utils/pdfDesigns.ts` (same mm→pt conversion, same
/// zone heights/positions) — only the *mechanism* for centering text and for
/// the table tent's upside-down back half differs, since jsPDF's per-call
/// `angle`/baseline-`y` text options have no direct Core Graphics equivalent:
/// this builder centers text within explicit rects (rather than baseline math)
/// and rotates the tent's back half via a single CTM transform (rather than
/// per-text-call angles) — both produce the same visual result more robustly
/// in UIKit than a literal translation would.
///
/// Every function takes only plain value types (never a `@MainActor` view
/// model), so none of them carry the actor-isolation warning `PerDiemPDFBuilder`
/// has when it reads `vm` properties inside its renderer closure.
enum DesignPDFBuilder {

    // MARK: Shared helpers

    private static func mm(_ v: Double) -> CGFloat { CGFloat(v) * 2.834645669 }

    private static let brandColor = UIColor(hex: EventDesignSetup.brandColorHex)

    private static func fill(_ ctx: CGContext, _ rect: CGRect, _ color: UIColor) {
        color.setFill()
        ctx.fill(rect)
    }

    private static func stroke(_ ctx: CGContext, _ rect: CGRect, _ color: UIColor, width: CGFloat) {
        color.setStroke()
        ctx.setLineWidth(width)
        ctx.stroke(rect)
    }

    private static func line(_ ctx: CGContext, from: CGPoint, to: CGPoint, color: UIColor, width: CGFloat, dashed: Bool = false) {
        ctx.saveGState()
        color.setStroke()
        ctx.setLineWidth(width)
        if dashed { ctx.setLineDash(phase: 0, lengths: [4, 3]) }
        ctx.move(to: from)
        ctx.addLine(to: to)
        ctx.strokePath()
        ctx.restoreGState()
    }

    /// Centers (both axes) possibly-wrapped text within `rect`.
    private static func drawCentered(_ text: String, in rect: CGRect, font: UIFont, color: UIColor) {
        guard !text.isEmpty else { return }
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byWordWrapping
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]
        let size = (text as NSString).boundingRect(
            with: CGSize(width: rect.width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin], attributes: attrs, context: nil
        )
        let drawRect = CGRect(x: rect.minX, y: rect.midY - size.height / 2, width: rect.width, height: size.height)
        (text as NSString).draw(in: drawRect, withAttributes: attrs)
    }

    /// Lays logos out evenly across a horizontal band, centered vertically within it —
    /// mirrors `pdfDesigns.ts`'s `drawLogos`.
    private static func drawLogos(_ ctx: CGContext, logos: [Data], zone: CGRect, maxLogoH: CGFloat? = nil) {
        guard !logos.isEmpty else { return }
        let logoH = maxLogoH ?? (zone.height - mm(4))
        let logoW = logoH * 2.8
        let totalW = CGFloat(logos.count) * logoW + CGFloat(logos.count - 1) * mm(6)
        var curX = zone.minX + (zone.width - totalW) / 2
        let logoY = zone.minY + (zone.height - logoH) / 2
        for data in logos {
            if let image = UIImage(data: data) {
                image.draw(in: CGRect(x: curX, y: logoY, width: logoW, height: logoH))
            }
            curX += logoW + mm(6)
        }
    }

    private static func eventLine(_ setup: EventDesignSetup) -> String {
        [setup.title, setup.cityCountry, setup.dateStr].filter { !$0.isEmpty }.joined(separator: "  ·  ")
    }

    // MARK: Name Badges — multi-page grid, A4/A3 sheet

    static func buildNameBadgesPDF(setup: EventDesignSetup, attendees: [DesignAttendee], sheet: DesignSheetSize) -> Data {
        let margin = mm(12), gap = mm(5)
        let bw = mm(setup.badgeWidthMm), bh = mm(setup.badgeHeightMm)
        let pageW = mm(sheet == .a4 ? 210 : 297)
        let pageH = mm(sheet == .a4 ? 297 : 420)

        let cols = max(1, Int((pageW - 2 * margin + gap) / (bw + gap)))
        let rows = max(1, Int((pageH - 2 * margin + gap) / (bh + gap)))
        let perPage = cols * rows

        let gridW = CGFloat(cols) * bw + CGFloat(cols - 1) * gap
        let gridH = CGFloat(rows) * bh + CGFloat(rows - 1) * gap
        let startX = (pageW - gridW) / 2
        let startY = (pageH - gridH) / 2

        let pageRect = CGRect(x: 0, y: 0, width: pageW, height: pageH)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { rendererCtx in
            let ctx = rendererCtx.cgContext
            for (i, attendee) in attendees.enumerated() {
                if i % perPage == 0 { rendererCtx.beginPage() }
                let idx = i % perPage
                let col = idx % cols, row = idx / cols
                let x = startX + CGFloat(col) * (bw + gap)
                let y = startY + CGFloat(row) * (bh + gap)
                drawBadge(ctx, attendee: attendee, setup: setup, rect: CGRect(x: x, y: y, width: bw, height: bh))
            }
        }
    }

    /// Badge layout (top→bottom): logo zone (white) / title strip (brand) / body (white,
    /// name+title+org) / info strip (brand, date|city). Matches `pdfDesigns.ts`'s `drawBadge`.
    private static func drawBadge(_ ctx: CGContext, attendee: DesignAttendee, setup: EventDesignSetup, rect: CGRect) {
        let bh = rect.height
        let logoH = (bh * 0.24).rounded()
        let titleH = (bh * 0.14).rounded()
        let infoH = (bh * 0.14).rounded()
        let bodyH = bh - logoH - titleH - infoH

        let logoZone = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: logoH)
        fill(ctx, logoZone, .white)
        drawLogos(ctx, logos: setup.logos, zone: logoZone)
        line(ctx, from: CGPoint(x: rect.minX, y: rect.minY + logoH), to: CGPoint(x: rect.maxX, y: rect.minY + logoH), color: brandColor, width: 0.3 * 2.834645669)

        let titleZone = CGRect(x: rect.minX, y: rect.minY + logoH, width: rect.width, height: titleH)
        fill(ctx, titleZone, brandColor)
        drawCentered(setup.title, in: titleZone.insetBy(dx: mm(3), dy: 0), font: .boldSystemFont(ofSize: min(9, max(6, titleH * 0.46 / 2.834645669))), color: .white)

        let bodyZone = CGRect(x: rect.minX, y: rect.minY + logoH + titleH, width: rect.width, height: bodyH)
        fill(ctx, bodyZone, .white)
        let namePt = min(16, max(9, bh / 2.834645669 * 0.20))
        let titlePt = min(9, max(6, bh / 2.834645669 * 0.11))
        let orgPt = min(8, max(5.5, bh / 2.834645669 * 0.10))
        var lineY = bodyZone.minY + mm(1.5)
        let lineH = bodyZone.height / CGFloat([true, !attendee.title.isEmpty, !attendee.organization.isEmpty].filter { $0 }.count)
        drawCentered(attendee.name, in: CGRect(x: bodyZone.minX, y: lineY, width: bodyZone.width, height: lineH).insetBy(dx: mm(3), dy: 0), font: .boldSystemFont(ofSize: namePt), color: brandColor)
        lineY += lineH
        if !attendee.title.isEmpty {
            drawCentered(attendee.title, in: CGRect(x: bodyZone.minX, y: lineY, width: bodyZone.width, height: lineH).insetBy(dx: mm(3), dy: 0), font: .systemFont(ofSize: titlePt), color: UIColor(red: 40/255, green: 40/255, blue: 50/255, alpha: 1))
            lineY += lineH
        }
        if !attendee.organization.isEmpty {
            drawCentered(attendee.organization, in: CGRect(x: bodyZone.minX, y: lineY, width: bodyZone.width, height: lineH).insetBy(dx: mm(3), dy: 0), font: .italicSystemFont(ofSize: orgPt), color: UIColor(red: 90/255, green: 90/255, blue: 100/255, alpha: 1))
        }

        let infoZone = CGRect(x: rect.minX, y: rect.minY + logoH + titleH + bodyH, width: rect.width, height: infoH)
        fill(ctx, infoZone, brandColor)
        let parts = [setup.dateStr, setup.cityCountry].filter { !$0.isEmpty }.joined(separator: "  |  ")
        drawCentered(parts, in: infoZone.insetBy(dx: mm(3), dy: 0), font: .boldSystemFont(ofSize: min(7.5, max(5.5, infoH * 0.40 / 2.834645669))), color: .white)

        stroke(ctx, rect, brandColor, width: mm(0.4))
    }

    // MARK: Table Tents — A4 landscape, fold at mid-page, one page per attendee

    static func buildTableTentsPDF(setup: EventDesignSetup, attendees: [DesignAttendee]) -> Data {
        let pw = mm(297), ph = mm(210)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pw, height: ph))
        return renderer.pdfData { rendererCtx in
            for attendee in attendees {
                rendererCtx.beginPage()
                drawTableTent(rendererCtx.cgContext, attendee: attendee, setup: setup, pageWidth: pw, pageHeight: ph)
            }
        }
    }

    private static func drawTableTent(_ ctx: CGContext, attendee: DesignAttendee, setup: EventDesignSetup, pageWidth pw: CGFloat, pageHeight ph: CGFloat) {
        let fold = ph / 2
        let titleStripH = mm(14), infoStripH = mm(12)
        let logoZoneH: CGFloat = setup.logos.isEmpty ? 0 : mm(20)
        let bodyH = fold - titleStripH - infoStripH - logoZoneH
        let dateCity = [setup.dateStr, setup.cityCountry].filter { !$0.isEmpty }.joined(separator: "  |  ")

        // One half's content, drawn in *local* coordinates 0..<pw, 0..<fold —
        // the front half is placed directly at (0, fold); the back half is
        // placed at (0, 0) but rotated 180° around its own center so it reads
        // correctly once the sheet is folded (same end result as jsPDF's
        // per-element `angle: 180`, achieved here with one CTM transform
        // instead of flipping every draw call's math individually).
        func drawHalfContent() {
            let titleZone = CGRect(x: 0, y: 0, width: pw, height: titleStripH)
            fill(ctx, titleZone, brandColor)
            drawCentered(setup.title, in: titleZone.insetBy(dx: mm(12), dy: 0), font: .boldSystemFont(ofSize: 11), color: .white)

            if !setup.logos.isEmpty {
                let logoZone = CGRect(x: 0, y: titleStripH, width: pw, height: logoZoneH)
                fill(ctx, logoZone, .white)
                drawLogos(ctx, logos: setup.logos, zone: logoZone, maxLogoH: logoZoneH - mm(4))
            }

            let bodyZone = CGRect(x: 0, y: titleStripH + logoZoneH, width: pw, height: bodyH)
            fill(ctx, bodyZone, .white)
            let hasTitle = !attendee.title.isEmpty, hasOrg = !attendee.organization.isEmpty
            let rowCount = CGFloat([true, hasTitle, hasOrg].filter { $0 }.count)
            let rowH = bodyZone.height / rowCount
            var rowY = bodyZone.minY
            drawCentered(attendee.name, in: CGRect(x: 0, y: rowY, width: pw, height: rowH).insetBy(dx: mm(12), dy: 0), font: .boldSystemFont(ofSize: 28), color: brandColor)
            rowY += rowH
            if hasTitle {
                drawCentered(attendee.title, in: CGRect(x: 0, y: rowY, width: pw, height: rowH).insetBy(dx: mm(12), dy: 0), font: .systemFont(ofSize: 14), color: UIColor(red: 40/255, green: 40/255, blue: 50/255, alpha: 1))
                rowY += rowH
            }
            if hasOrg {
                drawCentered(attendee.organization, in: CGRect(x: 0, y: rowY, width: pw, height: rowH).insetBy(dx: mm(12), dy: 0), font: .italicSystemFont(ofSize: 12), color: UIColor(red: 90/255, green: 90/255, blue: 100/255, alpha: 1))
            }

            let infoZone = CGRect(x: 0, y: titleStripH + logoZoneH + bodyH, width: pw, height: infoStripH)
            fill(ctx, infoZone, brandColor)
            drawCentered(dateCity, in: infoZone.insetBy(dx: mm(10), dy: 0), font: .boldSystemFont(ofSize: 9), color: .white)

            stroke(ctx, CGRect(x: 0, y: 0, width: pw, height: fold), brandColor, width: mm(0.3))
        }

        // Front (bottom half)
        ctx.saveGState()
        ctx.translateBy(x: 0, y: fold)
        drawHalfContent()
        ctx.restoreGState()

        // Back (top half), rotated 180° around its own center
        ctx.saveGState()
        ctx.translateBy(x: pw / 2, y: fold / 2)
        ctx.rotate(by: .pi)
        ctx.translateBy(x: -pw / 2, y: -fold / 2)
        drawHalfContent()
        ctx.restoreGState()

        // Dashed fold line + label
        let grey = UIColor(white: 160 / 255, alpha: 1)
        line(ctx, from: CGPoint(x: 0, y: fold), to: CGPoint(x: pw, y: fold), color: grey, width: mm(0.3), dashed: true)
        drawCentered("— fold —", in: CGRect(x: 0, y: fold - mm(4), width: pw, height: mm(4)), font: .systemFont(ofSize: 6), color: grey)
    }

    // MARK: Certificates — A4 landscape, one page per attendee, name only

    static func buildCertificatesPDF(setup: EventDesignSetup, attendees: [DesignAttendee]) -> Data {
        let pw = mm(297), ph = mm(210)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pw, height: ph))
        return renderer.pdfData { rendererCtx in
            for attendee in attendees {
                rendererCtx.beginPage()
                drawCertificate(rendererCtx.cgContext, name: attendee.name, setup: setup, pageWidth: pw, pageHeight: ph)
            }
        }
    }

    private static func drawCertificate(_ ctx: CGContext, name: String, setup: EventDesignSetup, pageWidth pw: CGFloat, pageHeight ph: CGFloat) {
        stroke(ctx, CGRect(x: mm(8), y: mm(8), width: pw - mm(16), height: ph - mm(16)), brandColor, width: mm(3))
        stroke(ctx, CGRect(x: mm(12), y: mm(12), width: pw - mm(24), height: ph - mm(24)), brandColor, width: mm(0.5))

        fill(ctx, CGRect(x: mm(8), y: mm(8), width: pw - mm(16), height: mm(20)), brandColor)
        fill(ctx, CGRect(x: mm(8), y: ph - mm(28), width: pw - mm(16), height: mm(20)), brandColor)

        drawLogos(ctx, logos: setup.logos, zone: CGRect(x: mm(14), y: mm(11), width: pw - mm(28), height: mm(14)))

        drawCentered("Certificate of Participation", in: CGRect(x: 0, y: mm(35), width: pw, height: mm(16)), font: .boldSystemFont(ofSize: 22), color: brandColor)
        line(ctx, from: CGPoint(x: pw / 2 - mm(55), y: mm(50)), to: CGPoint(x: pw / 2 + mm(55), y: mm(50)), color: brandColor, width: mm(0.7))

        let mutedText = UIColor(red: 90/255, green: 90/255, blue: 100/255, alpha: 1)
        drawCentered("This is to certify that", in: CGRect(x: 0, y: mm(56), width: pw, height: mm(10)), font: .systemFont(ofSize: 11), color: mutedText)

        let nameZone = CGRect(x: mm(30), y: mm(68), width: pw - mm(60), height: mm(24))
        drawCentered(name, in: nameZone, font: .boldSystemFont(ofSize: 28), color: UIColor(red: 20/255, green: 20/255, blue: 30/255, alpha: 1))

        drawCentered("has successfully participated in", in: CGRect(x: 0, y: mm(94), width: pw, height: mm(10)), font: .systemFont(ofSize: 11), color: mutedText)

        let titleZone = CGRect(x: mm(30), y: mm(106), width: pw - mm(60), height: mm(16))
        drawCentered(setup.title, in: titleZone, font: .boldSystemFont(ofSize: 15), color: brandColor)

        let locDate = [setup.cityCountry, setup.dateStr].filter { !$0.isEmpty }.joined(separator: "  ·  ")
        drawCentered(locDate, in: CGRect(x: 0, y: mm(126), width: pw, height: mm(10)), font: .systemFont(ofSize: 10), color: mutedText)

        // Signature lines
        let signers = setup.signers.isEmpty ? [DesignSigner(name: "", title: "Authorized Signature")] : setup.signers
        let sigW = mm(58)
        let sigBaseY = ph - mm(30)
        let spread = min((pw - mm(40)) / CGFloat(signers.count), mm(110))
        let firstX = (pw - spread * CGFloat(signers.count - 1)) / 2
        let signatureColor = UIColor(red: 130/255, green: 130/255, blue: 140/255, alpha: 1)

        for (i, signer) in signers.enumerated() {
            let sx = firstX + CGFloat(i) * spread
            line(ctx, from: CGPoint(x: sx - sigW / 2, y: sigBaseY), to: CGPoint(x: sx + sigW / 2, y: sigBaseY), color: signatureColor, width: mm(0.3))
            var nameBottom = sigBaseY
            if !signer.name.isEmpty {
                drawCentered(signer.name, in: CGRect(x: sx - mm(40), y: sigBaseY + mm(5), width: mm(80), height: mm(6)), font: .boldSystemFont(ofSize: 9), color: UIColor(red: 25/255, green: 25/255, blue: 35/255, alpha: 1))
                nameBottom += mm(5)
            }
            drawCentered(signer.title, in: CGRect(x: sx - mm(40), y: nameBottom + mm(5), width: mm(80), height: mm(6)), font: .systemFont(ofSize: 8), color: UIColor(red: 85/255, green: 85/255, blue: 95/255, alpha: 1))
        }

        drawCentered(eventLine(setup), in: CGRect(x: mm(15), y: ph - mm(20), width: pw - mm(30), height: mm(8)), font: .boldSystemFont(ofSize: 9), color: .white)
    }

    // MARK: Roll-up Banner — single huge page, branding only

    static func buildBannerPDF(setup: EventDesignSetup) -> Data {
        let w = mm(setup.bannerSize.widthMm), h = mm(2000)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: w, height: h))
        return renderer.pdfData { rendererCtx in
            rendererCtx.beginPage()
            let ctx = rendererCtx.cgContext
            fill(ctx, CGRect(x: 0, y: 0, width: w, height: h), .white)
            fill(ctx, CGRect(x: 0, y: 0, width: w, height: h * 0.07), brandColor)
            fill(ctx, CGRect(x: 0, y: h - h * 0.05, width: w, height: h * 0.05), brandColor)

            drawLogos(ctx, logos: setup.logos, zone: CGRect(x: mm(40), y: h * 0.1, width: w - mm(80), height: h * 0.16), maxLogoH: h * 0.16 - mm(4))

            drawCentered(setup.title, in: CGRect(x: mm(40), y: h * 0.40, width: w - mm(80), height: h * 0.14), font: .boldSystemFont(ofSize: 80), color: UIColor(red: 20/255, green: 20/255, blue: 30/255, alpha: 1))
            drawCentered(setup.cityCountry, in: CGRect(x: mm(40), y: h * 0.58, width: w - mm(80), height: h * 0.08), font: .systemFont(ofSize: 52), color: UIColor(red: 70/255, green: 70/255, blue: 80/255, alpha: 1))
            drawCentered(setup.dateStr, in: CGRect(x: mm(40), y: h * 0.66, width: w - mm(80), height: h * 0.08), font: .boldSystemFont(ofSize: 46), color: brandColor)

            drawCentered(eventLine(setup), in: CGRect(x: mm(30), y: h - h * 0.05, width: w - mm(60), height: h * 0.03), font: .systemFont(ofSize: 32), color: .white)
        }
    }

    // MARK: Screen Banner — single 16:9 page, branding only

    static func buildScreenBannerPDF(setup: EventDesignSetup) -> Data {
        let sw = mm(338), sh = mm(190)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: sw, height: sh))
        return renderer.pdfData { rendererCtx in
            rendererCtx.beginPage()
            let ctx = rendererCtx.cgContext
            fill(ctx, CGRect(x: 0, y: 0, width: sw, height: sh), .white)
            fill(ctx, CGRect(x: 0, y: 0, width: mm(14), height: sh), brandColor)
            fill(ctx, CGRect(x: sw - mm(14), y: 0, width: mm(14), height: sh), brandColor)

            drawLogos(ctx, logos: setup.logos, zone: CGRect(x: mm(22), y: mm(12), width: sw - mm(44), height: mm(32)), maxLogoH: mm(28))
            line(ctx, from: CGPoint(x: mm(22), y: mm(55)), to: CGPoint(x: sw - mm(22), y: mm(55)), color: brandColor, width: mm(1))

            drawCentered(setup.title, in: CGRect(x: mm(30), y: sh * 0.40, width: sw - mm(60), height: sh * 0.15), font: .boldSystemFont(ofSize: 34), color: UIColor(red: 20/255, green: 20/255, blue: 30/255, alpha: 1))
            let cityDate = [setup.cityCountry, setup.dateStr].filter { !$0.isEmpty }.joined(separator: "  ·  ")
            drawCentered(cityDate, in: CGRect(x: mm(30), y: sh * 0.62, width: sw - mm(60), height: mm(10)), font: .systemFont(ofSize: 18), color: brandColor)
        }
    }
}
