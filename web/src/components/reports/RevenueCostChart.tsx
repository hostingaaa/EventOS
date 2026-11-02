import { useState } from 'react';
import type { ReportView } from '../../utils/reports';
import { marginText, moneyFull, moneyShort } from '../../utils/reports';

interface Props {
  year: number;
  months: ReportView['months'];
  chartMax: number;
  monthlyTarget: number;
  /** Admins can set the monthly target from the chart's header. */
  canEditTarget: boolean;
  onSaveTarget: (target: number) => Promise<void>;
}

/** Twelve months of revenue vs cost bars (booked work stacked in a lighter tint) with an optional target line. */
export function RevenueCostChart({ year, months, chartMax, monthlyTarget, canEditTarget, onSaveTarget }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = (v: number) => `${(v / chartMax) * 100}%`;
  const active = hover !== null ? months[hover] : null;

  async function save(value: number) {
    setSaving(true);
    setError(null);
    try {
      await onSaveTarget(value);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the target');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rp-card rp-chart-card">
      <div className="rp-chart-head">
        <h3>Revenue vs cost, {year}</h3>
        <div className="rp-legend">
          <span><i className="rp-swatch rp-swatch--rev" />Revenue</span>
          <span><i className="rp-swatch rp-swatch--cost" />Cost</span>
          <span><i className="rp-swatch rp-swatch--booked" />Booked</span>
          {monthlyTarget > 0 && (
            <span><i className="rp-swatch rp-swatch--target" />Monthly target</span>
          )}
        </div>
      </div>

      {canEditTarget && (
        <div className="rp-target">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(Number(draft) || 0);
              }}
            >
              <label>
                Monthly revenue target (USD)
                <input type="number" min="0" step="1000" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. 112000" autoFocus />
              </label>
              <button type="submit" className="rp-btn rp-btn--solid" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              {monthlyTarget > 0 && (
                <button type="button" className="rp-btn" disabled={saving} onClick={() => void save(0)}>Clear</button>
              )}
              <button type="button" className="rp-btn rp-btn--ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
              {error && <span className="rp-target__error">{error}</span>}
            </form>
          ) : (
            <button
              type="button"
              className="rp-link"
              onClick={() => {
                setDraft(monthlyTarget ? String(monthlyTarget) : '');
                setEditing(true);
              }}
            >
              {monthlyTarget > 0 ? `Monthly target ${moneyShort(monthlyTarget)} · Edit` : 'Set a monthly revenue target'}
            </button>
          )}
        </div>
      )}

      <div className="rp-chart" onMouseLeave={() => setHover(null)}>
        {monthlyTarget > 0 && <div className="rp-chart__target" style={{ bottom: pct(monthlyTarget) }} />}
        {months.map((m, i) => (
          <div
            key={m.month}
            className="rp-chart__col"
            style={{ opacity: m.inPeriod ? 1 : 0.3 }}
            tabIndex={0}
            role="img"
            aria-label={`${m.label}: ${moneyFull(m.revenue + m.bookedRevenue)} revenue, ${moneyFull(m.cost + m.bookedCost)} cost`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <div className="rp-bar" style={{ height: pct(m.revenue + m.bookedRevenue) }}>
              <span className="rp-bar__seg rp-bar__seg--booked-rev" style={{ flex: m.bookedRevenue }} />
              <span className="rp-bar__seg rp-bar__seg--rev" style={{ flex: m.revenue }} />
            </div>
            <div className="rp-bar" style={{ height: pct(m.cost + m.bookedCost) }}>
              <span className="rp-bar__seg rp-bar__seg--booked-cost" style={{ flex: m.bookedCost }} />
              <span className="rp-bar__seg rp-bar__seg--cost" style={{ flex: m.cost }} />
            </div>
          </div>
        ))}

        {active && (
          <div className={`rp-tip${hover! <= 1 ? ' rp-tip--left' : hover! >= 10 ? ' rp-tip--right' : ''}`} style={hover! > 1 && hover! < 10 ? { left: `${((hover! + 0.5) / 12) * 100}%` } : undefined} role="tooltip">
            <strong>{active.label} {year}</strong>
            <span>Revenue {moneyFull(active.revenue + active.bookedRevenue)}{active.bookedRevenue > 0 && ` (${moneyFull(active.bookedRevenue)} booked)`}</span>
            <span>Cost {moneyFull(active.cost + active.bookedCost)}</span>
            <span>Margin {marginText(active.revenue + active.bookedRevenue, active.cost + active.bookedCost)}</span>
          </div>
        )}
      </div>

      <div className="rp-chart__labels">
        {months.map((m) => (
          <div key={m.month} className={`rp-chart__label${m.inPeriod ? ' is-on' : ''}`}>
            <div>{m.label}</div>
            <div className="rp-chart__margin">{m.margin === null ? '' : `${Math.round(m.margin * 100)}%`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
