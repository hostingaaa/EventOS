import type { ReportView } from '../../utils/reports';
import { marginText, moneyShort } from '../../utils/reports';

/** The four headline numbers: revenue delivered, gross profit, events delivered, outstanding receivables. */
export function KpiCards({ kpis }: { kpis: ReportView['kpis'] }) {
  const targetPct = kpis.target ? Math.min(100, (kpis.revenue / kpis.target) * 100) : 0;

  const revenueSub = kpis.bookedRevenue
    ? `+ ${moneyShort(kpis.bookedRevenue)} booked, not yet delivered`
    : kpis.target
      ? `${Math.round((kpis.revenue / kpis.target) * 100)}% of ${moneyShort(kpis.target)} target`
      : '—';

  const cards = [
    { label: 'Revenue delivered', value: moneyShort(kpis.revenue), sub: revenueSub, bar: kpis.target > 0 },
    { label: 'Gross profit', value: moneyShort(kpis.profit), sub: `${marginText(kpis.revenue, kpis.cost)} margin on ${moneyShort(kpis.cost)} cost`, bar: false },
    {
      label: 'Events delivered',
      value: String(kpis.deliveredCount),
      sub: kpis.bookedCount
        ? `${kpis.bookedCount} more booked in period`
        : `Avg ${moneyShort(kpis.deliveredCount ? kpis.revenue / kpis.deliveredCount : 0)} per event`,
      bar: false,
    },
    {
      label: 'Outstanding receivables',
      value: moneyShort(kpis.receivables),
      sub: kpis.unpaidCount
        ? `${kpis.unpaidCount} invoice${kpis.unpaidCount > 1 ? 's' : ''} unpaid · oldest ${kpis.oldestUnpaid}`
        : 'All delivered events paid',
      bar: false,
    },
  ];

  return (
    <div className="rp-kpis">
      {cards.map((c) => (
        <div key={c.label} className="rp-card rp-kpi">
          <div className="rp-label">{c.label}</div>
          <div className="rp-kpi__value">{c.value}</div>
          <div className="rp-kpi__sub">{c.sub}</div>
          {c.bar && (
            <div className="rp-bar-track rp-kpi__bar">
              <div className="rp-bar-fill" style={{ width: `${targetPct}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
