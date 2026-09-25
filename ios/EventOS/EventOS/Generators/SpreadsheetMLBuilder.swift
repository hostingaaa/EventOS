import Foundation

/// Minimal writer for Office's "SpreadsheetML" 2003 XML format — a single,
/// well-formed XML document (no zip container needed) that Excel, Numbers,
/// and Google Sheets all open directly, with basic cell styling (bold,
/// font/fill color, borders, wrap). Used instead of a full .xlsx writer so
/// the generator tools can produce a real, presentable spreadsheet natively.
enum SpreadsheetCell {
    case text(String, style: String? = nil)
    case number(Double, style: String? = nil)
}

struct SpreadsheetStyle {
    let id: String
    var bold = false
    var fontSize: Int?
    var fontColor: String?   // "#RRGGBB"
    var fillColor: String?   // "#RRGGBB"
    var wrap = false
    var border = false
    var hAlign: String?      // "Center" | "Left" | "Right"
}

struct SpreadsheetRow {
    var cells: [SpreadsheetCell]
}

struct SpreadsheetSheet {
    let name: String
    var rows: [SpreadsheetRow]
    var columnWidths: [Double] = []
}

enum SpreadsheetMLBuilder {
    static func build(sheets: [SpreadsheetSheet], styles: [SpreadsheetStyle]) -> String {
        var xml = "<?xml version=\"1.0\"?>\n<?mso-application progid=\"Excel.Sheet\"?>\n"
        xml += """
        <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" \
        xmlns:o="urn:schemas-microsoft-com:office:office" \
        xmlns:x="urn:schemas-microsoft-com:office:excel" \
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n
        """

        xml += "<Styles>\n<Style ss:ID=\"Default\" ss:Name=\"Normal\"><Alignment ss:Vertical=\"Center\" ss:WrapText=\"1\"/><Font ss:FontName=\"Calibri\" ss:Size=\"10\"/></Style>\n"
        for s in styles {
            xml += "<Style ss:ID=\"\(s.id)\">"
            xml += "<Alignment ss:Vertical=\"Center\""
            if s.wrap { xml += " ss:WrapText=\"1\"" }
            if let h = s.hAlign { xml += " ss:Horizontal=\"\(h)\"" }
            xml += "/>"
            if s.border {
                xml += "<Borders>"
                for position in ["Bottom", "Left", "Right", "Top"] {
                    xml += "<Border ss:Position=\"\(position)\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\"/>"
                }
                xml += "</Borders>"
            }
            var fontAttrs = ""
            if s.bold { fontAttrs += " ss:Bold=\"1\"" }
            if let size = s.fontSize { fontAttrs += " ss:Size=\"\(size)\"" }
            if let color = s.fontColor { fontAttrs += " ss:Color=\"\(color)\"" }
            xml += "<Font ss:FontName=\"Calibri\"\(fontAttrs)/>"
            if let fill = s.fillColor {
                xml += "<Interior ss:Color=\"\(fill)\" ss:Pattern=\"Solid\"/>"
            }
            xml += "</Style>\n"
        }
        xml += "</Styles>\n"

        for sheet in sheets {
            let safeName = escape(String(sheet.name.prefix(31)))
            xml += "<Worksheet ss:Name=\"\(safeName)\">\n<Table>\n"
            for width in sheet.columnWidths {
                xml += "<Column ss:Width=\"\(width)\"/>\n"
            }
            for row in sheet.rows {
                xml += "<Row>\n"
                for cell in row.cells {
                    switch cell {
                    case .text(let value, let style):
                        let styleAttr = style.map { " ss:StyleID=\"\($0)\"" } ?? ""
                        xml += "<Cell\(styleAttr)><Data ss:Type=\"String\">\(escape(value))</Data></Cell>\n"
                    case .number(let value, let style):
                        let styleAttr = style.map { " ss:StyleID=\"\($0)\"" } ?? ""
                        xml += "<Cell\(styleAttr)><Data ss:Type=\"Number\">\(value)</Data></Cell>\n"
                    }
                }
                xml += "</Row>\n"
            }
            xml += "</Table>\n</Worksheet>\n"
        }
        xml += "</Workbook>"
        return xml
    }

    private static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}
