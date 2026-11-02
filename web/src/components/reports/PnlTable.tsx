import { Link } from 'react-router-dom';
import type { ReportEvent, ReportView, SortKey } from '../../utils/reports';
import { LOW_MARGIN, MONTH_LABELS, moneyFull } from '../../utils/reports';

interface Props {
  rows: ReportEvent[];
  totals: ReportView['totals'];
  sort: SortKey;
  dir: 1 | -1;
  onSort: (key: SortKey) => void;
}

const TAG: Record<ReportEvent['status'], string> = { Paid: 'rp-tag--paid', Invoiced: 'rp-tag--invoiced', Booked: 'rp-tag--booked' };

/** Event-by-event P&L: sortable, margins under 25% flagged, a totals row at the bottom. */
export function PnlTable({ rows, totals, sort, dir, onSort }: Props) {
  const head = (key: SortKey, label: string, right = false) => (
    <button
      type="button"
      className={`rp-th${right ? ' rp-th--right' : ''}${sort === key ? ' is-sorted' : ''}`}
      aria-sort={sort === key ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(key)}
    >
      {label}
      {sort === key && <span aria-hidden="true">{dir === 1 ? ' ↑' : ' ↓'}</span>}
    </button>
  );

  return (
    <div className="rp-card rp-table-wrap">
      <div className="rp-table">
        <div className="rp-table__row rp-table__row--head">
          {head('code', 'Event')}
          <div>Location</div>
          {head('month', 'Month')}
          <div>Owner</div>
          {head('revenue', 'Contract', true)}
          <div className="rp-right">Cost</div>
          {head('profit', 'Profit', true)}
          {head('margin', 'Margin', true)}
          <div className="rp-table__status">Status</div>
        </div>

        {rows.map((r) => (
          <div key={r.code} className="rp-table__row rp-table__row--body">
            <Link className="rp-table__code" to={`/event/${encodeURIComponent(r.code)}`}>{r.code}</Link>
            <div className="rp-table__loc">
              {r.city}
              <span>, {r.country}</span>
            </div>
            <div className="rp-table__muted">{MONTH_LABELS[r.month]}</div>
            <div className="rp-table__muted rp-table__owner">{r.owner}</div>
            <div className="rp-right">{moneyFull(r.revenue)}</div>
            <div className="rp-right rp-table__muted">{moneyFull(r.cost)}</div>
            <div className="rp-right rp-table__bold">{moneyFull(r.profit)}</div>
            <div className={`rp-right rp-table__bold${r.margin !== null && r.margin < LOW_MARGIN ? ' is-low' : ' is-ok'}`}>
              {r.margin === null ? '—' : `${Math.round(r.margin * 100)}%`}
            </div>
            <div className="rp-table__status">
              <span className={`rp-tag ${TAG[r.status]}`}>{r.status}</span>
            </div>
          </div>
        ))}

        {rows.length === 0 && <p className="rp-empty rp-empty--block">No events in this period for the selected country.</p>}

        <div className="rp-table__row rp-table__row--total">
          <div className="rp-table__total-label">Total</div>
          <div className="rp-right">{moneyFull(totals.revenue)}</div>
          <div className="rp-right">{moneyFull(totals.cost)}</div>
          <div className="rp-right rp-table__profit">{moneyFull(totals.profit)}</div>
          <div className="rp-right">{totals.revenue > 0 ? `${Math.round((totals.profit / totals.revenue) * 100)}%` : '—'}</div>
          <div />
        </div>
      </div>
    </div>
  );
}
