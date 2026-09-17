import { useEffect, useMemo, useState } from 'react';
import { fetchAllCostItems, fetchEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import type { CostItem, Event } from '../types';
import { computeEventFinancials } from '../utils/financials';
import {
  computeCategoryBreakdown,
  computeCountryBreakdown,
  computeMonthlyTrend,
  computeOwnerBreakdown,
  filterEventsByYear,
  groupCostItemsByEvent,
  yearsInUse,
} from '../utils/reportingAggregates';
import { BreakdownBarList } from '../components/reports/BreakdownBarList';
import { MonthlyTrendChart } from '../components/reports/MonthlyTrendChart';
import './ReportsPage.css';

type SortKey = 'code' | 'location' | 'owner' | 'revenue' | 'cost' | 'profit';
type SortDir = 'asc' | 'desc';

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function ReportsPage() {
  const { isAdmin } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [eventsRes, allCostItems] = await Promise.all([fetchEvents(), fetchAllCostItems()]);
        setEvents(eventsRes.events);
        setCostItems(allCostItems);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const years = useMemo(() => yearsInUse(events), [events]);
  const yearEvents = useMemo(() => filterEventsByYear(events, year), [events, year]);
  const costItemsByEvent = useMemo(() => groupCostItemsByEvent(costItems), [costItems]);

  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(events, costItemsByEvent, year),
    [events, costItemsByEvent, year],
  );

  const categoryBreakdown = useMemo(() => {
    const codesInYear = new Set(yearEvents.map((e) => e.code));
    return computeCategoryBreakdown(costItems.filter((c) => codesInYear.has(c.eventCode)));
  }, [costItems, yearEvents]);

  const ownerBreakdown = useMemo(
    () => computeOwnerBreakdown(yearEvents, costItemsByEvent),
    [yearEvents, costItemsByEvent],
  );

  const countryBreakdown = useMemo(
    () => computeCountryBreakdown(yearEvents, costItemsByEvent),
    [yearEvents, costItemsByEvent],
  );

  const tableRows = useMemo(() => {
    const rows = yearEvents.map((ev) => {
      const f = computeEventFinancials(ev, costItemsByEvent[ev.code] ?? []);
      return {
        code: ev.code,
        location: ev.location,
        owner: ev.ownerEmail,
        revenue: f.revenue ?? 0,
        cost: f.totalCost,
        profit: (f.revenue ?? 0) - f.totalCost,
      };
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [yearEvents, costItemsByEvent, sortKey, sortDir]);

  const kpis = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    for (const ev of yearEvents) {
      const f = computeEventFinancials(ev, costItemsByEvent[ev.code] ?? []);
      revenue += f.revenue ?? 0;
      cost += f.totalCost;
    }
    return { revenue, cost, profit: revenue - cost, count: yearEvents.length };
  }, [yearEvents, costItemsByEvent]);

  if (!isAdmin) {
    return (
      <div className="reports__denied">
        <h2>Access denied</h2>
        <p>You need Admin privileges to view Reports.</p>
      </div>
    );
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  if (loading) return <p className="reports__msg">Loading reports…</p>;
  if (error) return <p className="reports__msg reports__msg--err">{error}</p>;

  return (
    <div className="reports">
      <header className="reports__header">
        <h1>Reports</h1>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </header>

      <div className="reports__kpis">
        <div className="reports__kpi-card">
          <div className="reports__kpi-figure">{money(kpis.revenue)}</div>
          <div className="reports__kpi-label">Total revenue</div>
        </div>
        <div className="reports__kpi-card">
          <div className="reports__kpi-figure">{money(kpis.cost)}</div>
          <div className="reports__kpi-label">Total cost</div>
        </div>
        <div className={`reports__kpi-card${kpis.profit < 0 ? ' reports__kpi-card--negative' : ''}`}>
          <div className="reports__kpi-figure">{money(kpis.profit)}</div>
          <div className="reports__kpi-label">Total profit</div>
        </div>
        <div className="reports__kpi-card">
          <div className="reports__kpi-figure">{kpis.count}</div>
          <div className="reports__kpi-label">Events in {year}</div>
        </div>
      </div>

      <MonthlyTrendChart points={monthlyTrend} />

      <div className="reports__breakdowns">
        <BreakdownBarList
          title="By cost category"
          entries={categoryBreakdown.map((c) => ({ key: c.category, label: c.category, value: c.total }))}
        />
        <BreakdownBarList
          title="By team member"
          entries={ownerBreakdown.map((o) => ({ key: o.key, label: o.label, value: o.profit }))}
        />
        <BreakdownBarList
          title="By country"
          entries={countryBreakdown.map((c) => ({ key: c.key, label: c.label, value: c.profit }))}
        />
      </div>

      <div className="reports__table-wrap">
        <table className="reports__table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('code')}>Event{sortIndicator('code')}</th>
              <th onClick={() => toggleSort('location')}>Location{sortIndicator('location')}</th>
              <th onClick={() => toggleSort('owner')}>Owner{sortIndicator('owner')}</th>
              <th onClick={() => toggleSort('revenue')}>Revenue{sortIndicator('revenue')}</th>
              <th onClick={() => toggleSort('cost')}>Cost{sortIndicator('cost')}</th>
              <th onClick={() => toggleSort('profit')}>Profit{sortIndicator('profit')}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.location}</td>
                <td>{row.owner || '—'}</td>
                <td>{money(row.revenue)}</td>
                <td>{money(row.cost)}</td>
                <td className={row.profit < 0 ? 'reports__profit-negative' : ''}>{money(row.profit)}</td>
              </tr>
            ))}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={6} className="reports__table-empty">No events in {year}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
