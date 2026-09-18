import SwiftUI
import Charts

struct ReportsView: View {
    @StateObject private var vm = ReportsViewModel()

    var body: some View {
        Group {
            if vm.loading {
                ProgressView("Loading reports…").tint(Theme.green)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.error {
                Text(error).foregroundStyle(Theme.statusRisk)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                content
            }
        }
        .background(Theme.bg)
        .navigationTitle("Reports")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                yearPicker
                kpiRow
                trendChart
                BreakdownSection(title: "By cost category", entries: vm.categoryBreakdown)
                BreakdownSection(title: "By team member", entries: vm.ownerBreakdown)
                BreakdownSection(title: "By country", entries: vm.countryBreakdown)
                eventList
            }
            .padding(16)
        }
    }

    private var yearPicker: some View {
        HStack {
            Text("Year").font(.subheadline).foregroundStyle(Theme.textSecondary)
            Spacer()
            Menu {
                ForEach(vm.years, id: \.self) { year in
                    Button(String(year)) { vm.selectedYear = year }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(String(vm.selectedYear)).font(.subheadline.bold())
                    Image(systemName: "chevron.down").font(.caption2)
                }
                .foregroundStyle(Theme.textPrimary)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(Theme.cardAlt)
                .clipShape(Capsule())
            }
        }
    }

    private var kpiRow: some View {
        let k = vm.kpis
        return HStack(spacing: 0) {
            StatBlock(value: money(k.revenue), label: "Revenue")
            StatBlock(value: money(k.cost), label: "Cost")
            StatBlock(value: money(k.profit), label: "Profit", color: k.profit < 0 ? Theme.statusRisk : Theme.statusGood)
            StatBlock(value: "\(k.count)", label: "Events")
        }
        .cardStyle()
    }

    private var trendChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeaderRow(icon: "chart.line.uptrend.xyaxis", title: "Monthly trend")
            HStack(spacing: 14) {
                legendDot("Revenue", Theme.green)
                legendDot("Cost", Theme.statusRisk)
                legendDot("Profit", Theme.statusInfo)
            }
            Chart {
                ForEach(vm.monthlyTrend) { point in
                    LineMark(x: .value("Month", point.month), y: .value("Amount", point.revenue), series: .value("Series", "Revenue"))
                        .foregroundStyle(Theme.green)
                    LineMark(x: .value("Month", point.month), y: .value("Amount", point.cost), series: .value("Series", "Cost"))
                        .foregroundStyle(Theme.statusRisk)
                    LineMark(x: .value("Month", point.month), y: .value("Amount", point.profit), series: .value("Series", "Profit"))
                        .foregroundStyle(Theme.statusInfo)
                }
            }
            .frame(height: 180)
            .chartXAxis { AxisMarks(values: .automatic) { _ in AxisValueLabel().foregroundStyle(Theme.textTertiary) } }
            .chartYAxis { AxisMarks(values: .automatic) { _ in AxisValueLabel().foregroundStyle(Theme.textTertiary) } }
        }
        .cardStyle()
    }

    private func legendDot(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(Theme.textSecondary)
        }
    }

    private var eventList: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeaderRow(icon: "list.bullet.rectangle", title: "Events")
                Spacer()
            }
            HStack(spacing: 8) {
                Menu {
                    ForEach(ReportSortColumn.allCases) { col in
                        Button(col.rawValue) { vm.sortColumn = col }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text("Sort: \(vm.sortColumn.rawValue)").font(.caption.weight(.semibold))
                        Image(systemName: "chevron.down").font(.caption2)
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Theme.cardAlt)
                    .clipShape(Capsule())
                }
                Button {
                    vm.sortAscending.toggle()
                } label: {
                    Image(systemName: vm.sortAscending ? "arrow.up" : "arrow.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(8)
                        .background(Theme.cardAlt)
                        .clipShape(Circle())
                }
                Spacer()
            }

            if vm.sortedRows.isEmpty {
                Text("No events in \(String(vm.selectedYear)).").foregroundStyle(Theme.textSecondary)
            }

            VStack(spacing: 8) {
                ForEach(vm.sortedRows) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(row.code).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Text(money(row.profit))
                                .font(.subheadline.bold())
                                .foregroundStyle(row.profit < 0 ? Theme.statusRisk : Theme.statusGood)
                        }
                        HStack {
                            Text(row.location).font(.caption).foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text("\(money(row.revenue)) rev · \(money(row.cost)) cost")
                                .font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                        if !row.owner.isEmpty {
                            Text(row.owner).font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    .padding(12)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(Theme.border, lineWidth: 1))
                }
            }
        }
        .cardStyle()
    }

    private func money(_ amount: Double) -> String {
        amount.formatted(.number.precision(.fractionLength(0)))
    }
}

private struct BreakdownSection: View {
    let title: String
    let entries: [BreakdownEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeaderRow(icon: "chart.bar.fill", title: title)
            if entries.isEmpty {
                Text("No data yet.").foregroundStyle(Theme.textSecondary)
            }
            let maxValue = max(1, entries.map { abs($0.value) }.max() ?? 1)
            ForEach(entries) { entry in
                HStack(spacing: 10) {
                    Text(entry.label)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                        .frame(width: 90, alignment: .leading)
                    GeometryReader { geo in
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(entry.value < 0 ? Theme.statusRisk : Theme.green)
                            .frame(width: max(3, geo.size.width * CGFloat(abs(entry.value) / maxValue)), height: 8)
                    }
                    .frame(height: 8)
                    Text(entry.value.formatted(.number.precision(.fractionLength(0))))
                        .font(.caption.bold())
                        .foregroundStyle(Theme.textPrimary)
                        .frame(width: 60, alignment: .trailing)
                }
            }
        }
        .cardStyle()
    }
}
