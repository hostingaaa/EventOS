import type { CostCategory } from '../../utils/reports';
import { moneyShort } from '../../utils/reports';

/** Segment colours, darkest first: accent 800 / 600 / 400 / 300, then neutral. */
const PALETTE = ['#0a5046', '#0f8572', '#5cbdab', '#9bd6ca', '#b4bcbf'];

/** Where delivered cost went, summed from the real cost items on each event's Financials tab. */
export function CostBreakdown({ categories, total }: { categories: CostCategory[]; total: number }) {
  return (
    <div className="rp-card">
      <h3 className="rp-card__title">Where the cost goes</h3>
      <p className="rp-card__sub">{moneyShort(total)} delivered cost in period</p>
      {categories.length > 0 ? (
        <>
          <div className="rp-costbar" role="img" aria-label="Cost by category">
            {categories.map((c, i) => (
              <span key={c.name} title={`${c.name}: ${moneyShort(c.value)}`} style={{ flex: Math.max(c.value, 1), background: PALETTE[i % PALETTE.length] }} />
            ))}
          </div>
          <div className="rp-costlist">
            {categories.map((c, i) => (
              <div key={c.name} className="rp-costlist__row">
                <i className="rp-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span>{c.name}</span>
                <span className="rp-costlist__value">{moneyShort(c.value)}</span>
                <span className="rp-costlist__pct">{Math.round(c.share * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="rp-empty">No cost items recorded for delivered events in this period. Add them on an event&rsquo;s Financials tab.</p>
      )}
    </div>
  );
}
