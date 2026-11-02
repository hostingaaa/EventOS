import { useEffect, useMemo, useState } from 'react';
import { fetchReportData, saveReportSettings } from '../api/client';
import { useUser } from '../context/UserContext';
import type { ReportData } from '../types';
import { CostBreakdown } from '../components/reports/CostBreakdown';
import { CountryList } from '../components/reports/CountryList';
import { KpiCards } from '../components/reports/KpiCards';
import { OwnerCards } from '../components/reports/OwnerCards';
import { PeriodSwitcher } from '../components/reports/PeriodSwitcher';
import { PnlTable } from '../components/reports/PnlTable';
import { ReportSection } from '../components/reports/ReportSection';
import { RevenueCostChart } from '../components/reports/RevenueCostChart';
import { getMemberByEmail } from '../utils/roleStore';
import {
  buildReport,
  defaultDir,
  defaultPeriod,
  periodOptions,
  prepareEvents,
  reportCsv,
  type PeriodId,
  type SortKey,
} from '../utils/reports';
import './ReportsPage.css';

/** A person's display name for an owner email: their member name, else the part before the @. */
function ownerName(email: string): string {
  if (!email) return 'Unassigned';
  return getMemberByEmail(email)?.name || email.split('@')[0];
}

function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { user, can, isAdmin } = useUser();
  const allowed = can('reports.view');
  const today = useMemo(() => new Date(), []);
  const thisYear = today.getFullYear();

  const [year, setYear] = useState(thisYear);
  const [periodId, setPeriodId] = useState<PeriodId>(defaultPeriod(thisYear, today));
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('month');
  const [dir, setDir] = useState<1 | -1>(1);
  const [years, setYears] = useState<number[]>([thisYear]);
  const [loaded, setLoaded] = useState<{ year: number; data?: ReportData; error?: string } | null>(null);

  const email = user?.email ?? '';

  useEffect(() => {
    if (!allowed || !email) return;
    let cancelled = false;
    fetchReportData(year, email)
      .then((data) => {
        if (cancelled) return;
        setLoaded({ year, data });
        setYears(Array.from(new Set([thisYear, ...data.years])).sort((a, b) => b - a));
      })
      .catch((e) => {
        if (!cancelled) setLoaded({ year, error: e instanceof Error ? e.message : 'Failed to load the report' });
      });
    return () => {
      cancelled = true;
    };
  }, [year, allowed, email, thisYear]);

  const current = loaded && loaded.year === year ? loaded : null;
  const data = current?.data;

  const events = useMemo(() => (data ? prepareEvents(data.rows, today, ownerName) : []), [data, today]);
  const options = useMemo(() => periodOptions(year, today), [year, today]);
  const period = options.find((o) => o.id === periodId) ?? options.find((o) => o.id === defaultPeriod(year, today)) ?? options[0];

  const view = useMemo(
    () => buildReport({ events, year, period, country, monthlyTarget: data?.monthlyTarget ?? 0, today, sort, dir }),
    [events, year, period, country, data?.monthlyTarget, today, sort, dir],
  );

  if (!allowed) {
    return (
      <div className="rp-denied">
        <h2>Access denied</h2>
        <p>Reports show company revenue and margins. Ask an admin to enable Reports for your role.</p>
      </div>
    );
  }

  function pickYear(next: number) {
    setYear(next);
    setPeriodId(defaultPeriod(next, today));
    setCountry(null);
  }

  function toggleSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(defaultDir(key));
    }
  }

  async function saveTarget(monthlyTarget: number) {
    const saved = await saveReportSettings({ monthlyTarget }, email);
    setLoaded((l) => (l && l.data ? { ...l, data: { ...l.data, monthlyTarget: saved.monthlyTarget } } : l));
  }

  const caption = period.caption + (country ? ` · ${country}` : '');
  const empty = !!data && data.rows.length === 0;

  return (
    <div className="reports rp">
      <header className="rp-title">
        <div className="rp-title__main">
          <div className="rp-kicker">Admins &amp; management</div>
          <h1>Reports</h1>
          <p className="rp-title__caption">{caption}</p>
        </div>
        <div className="rp-title__controls">
          {years.length > 1 && (
            <select className="rp-year" value={year} onChange={(e) => pickYear(Number(e.target.value))} aria-label="Year">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <PeriodSwitcher options={options} value={period.id} onChange={setPeriodId} />
          <button
            type="button"
            className="rp-btn"
            disabled={!data || view.rows.length === 0}
            onClick={() => downloadCsv(reportCsv(view.rows), `eventos-report-${year}-${period.id}.csv`)}
          >
            Export CSV
          </button>
        </div>
      </header>

      {!data && !current?.error && <p className="rp-msg">Loading report…</p>}
      {current?.error && <p className="rp-msg rp-msg--err">{current.error}</p>}

      {data && (
        <>
          {data.unconvertedCurrencies.length > 0 && (
            <p className="rp-banner">
              Some costs are in {data.unconvertedCurrencies.join(', ')}, which couldn&rsquo;t be converted to USD, so they&rsquo;re counted at face value.
            </p>
          )}

          {empty ? (
            <div className="rp-card rp-emptycard">
              <h3>No awarded or completed events in {year} yet</h3>
              <p>
                Reports counts events marked Awarded or Completed. Add each event&rsquo;s contract value on its Financials tab and it
                will appear here.
              </p>
            </div>
          ) : (
            <>
              <KpiCards kpis={view.kpis} />
              {view.missingRevenue > 0 && (
                <p className="rp-note rp-note--kpis">
                  {view.missingRevenue} delivered event{view.missingRevenue > 1 ? 's have' : ' has'} no contract value yet, so
                  {view.missingRevenue > 1 ? ' they' : ' it'} add{view.missingRevenue > 1 ? '' : 's'} nothing to revenue. Enter it on the event&rsquo;s Financials tab.
                </p>
              )}

              <ReportSection title="Company financials" />
              <div className="rp-grid">
                <div className="rp-grid__full">
                  <RevenueCostChart
                    year={year}
                    months={view.months}
                    chartMax={view.chartMax}
                    monthlyTarget={data.monthlyTarget}
                    canEditTarget={isAdmin}
                    onSaveTarget={saveTarget}
                  />
                </div>
                <CountryList countries={view.countries} selected={country} onSelect={setCountry} />
                <CostBreakdown categories={view.costCategories} total={view.deliveredCost} />
              </div>

              <ReportSection title="Operations by owner" />
              <OwnerCards owners={view.owners} totalRevenue={view.kpis.revenue} />

              <ReportSection
                title="Event P&L"
                caption={`${view.rows.length} event${view.rows.length === 1 ? '' : 's'}${country ? ` in ${country}` : ''} · margins under 25% flagged`}
              />
              <PnlTable rows={view.rows} totals={view.totals} sort={sort} dir={dir} onSort={toggleSort} />
            </>
          )}
        </>
      )}
    </div>
  );
}
