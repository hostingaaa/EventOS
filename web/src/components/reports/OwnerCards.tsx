import type { OwnerCard } from '../../utils/reports';
import { marginText, moneyShort } from '../../utils/reports';

/** One card per owner, biggest revenue first: delivered/booked counts, revenue, margin, share, money left to collect. */
export function OwnerCards({ owners, totalRevenue }: { owners: OwnerCard[]; totalRevenue: number }) {
  if (owners.length === 0) return <p className="rp-empty rp-empty--block">No events in this period.</p>;
  return (
    <div className="rp-owners">
      {owners.map((o) => {
        const share = totalRevenue ? (o.revenue / totalRevenue) * 100 : 0;
        return (
          <div key={o.email || o.name} className="rp-card rp-owner">
            <div className="rp-owner__head">
              <span className="rp-owner__avatar">{(o.name || '?').charAt(0)}</span>
              <span className="rp-owner__name">{o.name}</span>
              <span className="rp-owner__count">
                {o.delivered} delivered{o.booked ? ` · ${o.booked} booked` : ''}
              </span>
            </div>
            <div className="rp-owner__stats">
              <div>
                <div className="rp-label">Revenue</div>
                <div className="rp-owner__figure">{moneyShort(o.revenue)}</div>
              </div>
              <div>
                <div className="rp-label">Margin</div>
                <div className="rp-owner__figure">{marginText(o.revenue, o.cost)}</div>
              </div>
            </div>
            <div className="rp-owner__share">
              <div>
                <span>Share of revenue</span>
                <span>{Math.round(share)}%</span>
              </div>
              <div className="rp-bar-track"><div className="rp-bar-fill" style={{ width: `${share}%` }} /></div>
            </div>
            {o.unpaidCount > 0 && (
              <div className="rp-owner__warn">
                {o.unpaidCount} unpaid · {moneyShort(o.unpaidValue)} to collect
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
