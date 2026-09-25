import UIKit

/// Renders the per-diem cash disbursement form directly into a one-page PDF
/// via UIGraphicsPDFRenderer — a native stand-in for the web app's
/// print-to-PDF flow (no `window.print()` equivalent on iOS).
enum PerDiemPDFBuilder {
    static func makePDF(_ vm: PerDiemViewModel) -> Data {
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 44
            let margin: CGFloat = 44
            let width = pageRect.width - margin * 2

            func draw(_ text: String, size: CGFloat = 12, bold: Bool = false, color: UIColor = .black, spacing: CGFloat = 8) {
                let font = bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size)
                let paragraph = NSMutableParagraphStyle()
                paragraph.lineBreakMode = .byWordWrapping
                let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]
                let bounds = (text as NSString).boundingRect(
                    with: CGSize(width: width, height: .greatestFiniteMagnitude),
                    options: [.usesLineFragmentOrigin], attributes: attrs, context: nil
                )
                (text as NSString).draw(in: CGRect(x: margin, y: y, width: width, height: bounds.height), withAttributes: attrs)
                y += bounds.height + spacing
            }

            func rule() {
                let path = UIBezierPath()
                path.move(to: CGPoint(x: margin, y: y))
                path.addLine(to: CGPoint(x: pageRect.width - margin, y: y))
                UIColor.lightGray.setStroke()
                path.lineWidth = 0.5
                path.stroke()
                y += 14
            }

            draw("Per Diem Cash Disbursement Form", size: 20, bold: true, spacing: 4)
            draw("EventOS · generated on \(Date().formatted(date: .abbreviated, time: .shortened))", size: 9, color: .darkGray, spacing: 16)

            draw("Traveler: \(vm.travelerName.isEmpty ? "—" : vm.travelerName)", bold: true)
            draw("Event: \(vm.eventCode) — \(vm.eventName)")
            draw("Location: \(vm.location.isEmpty ? "—" : vm.location)")
            draw("Dates: \(vm.dates.isEmpty ? "—" : vm.dates)")
            rule()

            draw("Meals & Incidental Expenses (M&IE)", size: 15, bold: true, spacing: 6)
            draw("Daily rate: \(vm.currency) \(vm.perDiemRate.formatted(.number.precision(.fractionLength(2))))  ×  \(vm.days) day(s)")
            draw("Total M&IE disbursement: \(vm.currency) \(vm.mieTotal.formatted(.number.precision(.fractionLength(2))))", bold: true, spacing: 16)

            draw("Visa / Passport Reimbursement", size: 15, bold: true, spacing: 6)
            draw("Maximum reimbursable amount: USD \(vm.maxVisa.formatted(.number.precision(.fractionLength(2))))", spacing: 16)

            draw("Ground Transportation", size: 15, bold: true, spacing: 6)
            draw("Maximum reimbursable amount per traveler: USD \(vm.maxGround.formatted(.number.precision(.fractionLength(2))))", spacing: 24)

            rule()
            draw("Traveler signature: _______________________________   Date: _______________", spacing: 28)
            draw("LEM signature: _______________________________   Date: _______________", spacing: 28)
            draw("IPS approval (if applicable): _______________________________   Date: _______________")
        }
    }
}
