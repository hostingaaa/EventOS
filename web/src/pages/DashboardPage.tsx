import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchDashboardHealth, fetchEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Event, EventHealth } from '../types';
import { NewProjectModal } from '../components/NewProjectModal';
import { getEventDateRange, parseIsoDate, todayAtNoon } from '../utils/calendarDates';
import { getEventStatus, isEventActive } from '../utils/eventLifecycle';
import './DashboardPage.css';

type Filter = 'all' | 'attention' | 'behind' | 'missing-sow' | 'missing-venue';
type SortKey = 'code' | 'date' | 'updated';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All active' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'behind', label: 'Behind schedule' },
  { id: 'missing-sow', label: 'Missing SOW' },
  { id: 'missing-venue', label: 'Missing venue' },
];

/** Circular-arrow refresh icon. Uses currentColor so it picks up the
 * button's own color. */
function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}

/** Calendar-with-a-plus "new event" icon. Uses currentColor so it picks up
 * the button's own color. */
function NewEventIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7" y1="2" x2="7" y2="6" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="17" y1="2" x2="17" y2="6" />
      <rect x="4" y="4.5" width="16" height="16.5" rx="2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="12" y1="12.5" x2="12" y2="18" />
      <line x1="9.25" y1="15.25" x2="14.75" y2="15.25" />
    </svg>
  );
}

/** Magnifying-glass search icon for the toolbar's search field. */
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const IMMINENT_DAYS = 3; // days until startDate → urgency tag

// Anchored at local noon (not midnight) so date-only "yyyy-MM-dd" fields
// compare correctly regardless of the viewer's UTC offset — `new Date(s)`
// parses a bare date as UTC midnight, which drifts into the previous local
// day for any positive-offset timezone and silently breaks same-day checks
// like isHappening(). Matches the convention in utils/calendarDates.ts.
function today(): Date {
  return todayAtNoon();
}

function parseDate(s: string | undefined): Date | null {
  return parseIsoDate(s);
}

/** Dashboard-only label, e.g. "Sep 15–16, 2026" (en dash), or "Sep 18, 2026". */
function formatDashboardDates(ev: Event): string {
  const range = getEventDateRange(ev);
  if (!range) return ev.dates?.trim() || '—';

  const start = parseDate(range.start);
  const end = parseDate(range.end);
  if (!start) return ev.dates?.trim() || '—';

  const monthShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short' });

  if (!end || start.toDateString() === end.toDateString()) {
    return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${monthShort(start)} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

/** Split "City, Country" into its two parts for the stacked Location cell. */
function splitLocation(location: string): { city: string; country: string } {
  const trimmed = (location || '').trim();
  if (!trimmed) return { city: '—', country: '' };
  const idx = trimmed.indexOf(',');
  if (idx === -1) return { city: trimmed, country: '' };
  return { city: trimmed.slice(0, idx).trim(), country: trimmed.slice(idx + 1).trim() };
}

function daysUntilStart(ev: Event): number | null {
  const s = parseDate(ev.startDate);
  if (!s) return null;
  return Math.floor((s.getTime() - today().getTime()) / 86_400_000);
}

function isHappening(ev: Event): boolean {
  const s = parseDate(ev.startDate);
  const e = parseDate(ev.endDate);
  const t = today();
  if (!s) return false;
  if (s > t) return false;
  if (e && e < t) return false;
  return true;
}

/** Task-completion percentage backing the readiness dots and status label. */
function pctOf(health: EventHealth | null | undefined): number {
  return health?.completion ?? 0;
}

/** Derive "Month YYYY" label from a startDate ISO string. */
function monthLabel(startDate: string | undefined, fallback: string): string {
  const d = parseDate(startDate ?? '');
  if (!d) return fallback || 'Unscheduled';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function defaultDateCompare(a: Event, b: Event): number {
  const da = parseDate(a.startDate);
  const db = parseDate(b.startDate);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

function compareEvents(a: Event, b: Event, key: SortKey, dir: 1 | -1): number {
  if (key === 'code') return a.code.localeCompare(b.code) * dir;
  if (key === 'updated') return 0; // no real per-event "last updated" timestamp yet — see README note
  return defaultDateCompare(a, b) * dir;
}

/**
 * Group events by month and sort:
 *  - months chronologically (earliest first for active, latest first for completed) —
 *    always by real start date, independent of the row-level display sort below
 *  - events within each month by `compareFn` (defaults to startDate ascending)
 */
function groupByMonth(
  events: Event[],
  monthOrder: 'asc' | 'desc' = 'asc',
  compareFn: (a: Event, b: Event) => number = defaultDateCompare,
): Array<{ month: string; events: Event[] }> {
  const map = new Map<string, { events: Event[]; anchor: Date }>();

  const list = Array.isArray(events) ? events : [];
  for (const ev of list) {
    const label = monthLabel(ev.startDate, ev.monthGroup);
    const anchor = parseDate(ev.startDate) ?? new Date(0);
    if (!map.has(label)) map.set(label, { events: [], anchor });
    map.get(label)!.events.push(ev);
  }

  for (const bucket of map.values()) {
    // Month order always follows the earliest real date in the bucket,
    // regardless of which column the rows are currently sorted by.
    const earliest = [...bucket.events].sort(defaultDateCompare)[0];
    const anchorDate = parseDate(earliest?.startDate);
    if (anchorDate) bucket.anchor = anchorDate;

    bucket.events.sort(compareFn);
  }

  const entries = Array.from(map.entries()).sort(([, a], [, b]) => {
    const diff = a.anchor.getTime() - b.anchor.getTime();
    return monthOrder === 'asc' ? diff : -diff;
  });

  return entries.map(([month, { events: evs }]) => ({ month, events: evs }));
}

function matchesFilter(ev: Event, filter: Filter, health?: EventHealth | null): boolean {
  if (filter === 'all') return true;
  const sow = ev.sow?.trim().toLowerCase();
  const missingSow = !sow || sow === '??';
  const missingVenue = !ev.venue?.trim();
  if (filter === 'missing-sow') return missingSow;
  if (filter === 'missing-venue') return missingVenue;
  const days = daysUntilStart(ev);
  const pct = pctOf(health);
  if (filter === 'attention') return days !== null && days <= 21 && pct < 100;
  if (filter === 'behind') return days !== null && days <= IMMINENT_DAYS && pct < 80;
  return true;
}

function matchesSearch(ev: Event, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    ev.code.toLowerCase().includes(needle) ||
    ev.location.toLowerCase().includes(needle) ||
    ev.ownerEmail.toLowerCase().includes(needle)
  );
}

/**
 * Status label + tone (first match wins):
 *  1. happening now           → "Live"
 *  2. starting within 3 days & completion < 80%  → "Behind"
 *  3. completion === 100%     → "Ready"
 *  4. completion >= 60%       → "On track"
 *  5. otherwise               → "Needs work"
 */
function statusInfo(
  ev: Event,
  health: EventHealth | null | undefined,
  happening: boolean,
): { label: string; tone: 'live' | 'behind' | 'ready' | 'on-track' | 'needs-work' } {
  const pct = pctOf(health);
  const days = daysUntilStart(ev);
  if (happening) return { label: 'Live', tone: 'live' };
  if (days !== null && days <= IMMINENT_DAYS && pct < 80) return { label: 'Behind', tone: 'behind' };
  if (pct === 100) return { label: 'Ready', tone: 'ready' };
  if (pct >= 60) return { label: 'On track', tone: 'on-track' };
  return { label: 'Needs work', tone: 'needs-work' };
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface RowProps {
  ev: Event;
  health?: EventHealth | null;
  isCompleted: boolean;
}

function EventRow({ ev, health, isCompleted: done }: RowProps) {
  const days = daysUntilStart(ev);
  const happening = isHappening(ev);
  const showTag = !done && days !== null && days >= 0 && days <= IMMINENT_DAYS;
  const { city, country } = splitLocation(ev.location);
  const status = getEventStatus(ev);
  const awarded = status === 'Awarded';
  const { label: statusLabel, tone } = statusInfo(ev, health, happening);
  const pct = pctOf(health);
  const filledDots = Math.min(5, Math.max(0, Math.round(pct / 20)));
  const barTone = happening ? 'urgent' : days !== null && days <= IMMINENT_DAYS ? 'soon' : 'later';

  return (
    <div className={`dashboard__row-wrap${done ? ' dashboard__row-wrap--completed' : ''}`}>
      <Link
        to={`/event/${encodeURIComponent(ev.code)}`}
        className={`dashboard__row${awarded ? ' dashboard__row--awarded' : ''}`}
      >
        {/* Event code */}
        <span className="dl-event">
          <span className={`dl-bar dl-bar--${barTone}`} aria-hidden="true" />
          <span className="dl-code">
            {ev.code}
            {!ev.venue && <span className="dl-flag" title="No venue confirmed">!</span>}
          </span>
          {status !== 'Proposed' && (
            <span className={`dl-lifecycle dl-lifecycle--${status.toLowerCase()}`}>{status}</span>
          )}
        </span>

        {/* Location */}
        <span className="dl-location">
          <span className="dl-location__city">{city}</span>
          {country && <span className="dl-location__country">{country}</span>}
        </span>

        {/* Dates */}
        <span className="dl-dates">{formatDashboardDates(ev)}</span>

        {/* Urgency tag — its own track so it never collides with Assigned */}
        <span className="dl-tag-cell">
          {showTag && (
            <span className={`dl-tag${days === 0 ? ' dl-tag--today' : ' dl-tag--soon'}`}>
              {days === 0 ? 'Today' : `In ${days}d`}
            </span>
          )}
        </span>

        {/* Assigned */}
        <span className="dl-assigned">
          {ev.ownerEmail ? (
            <span className="dl-owner__chip">
              <span className={`dl-owner__avatar${happening ? ' dl-owner__avatar--live' : ''}`}>
                {ev.ownerEmail.charAt(0).toUpperCase()}
              </span>
              <span className="dl-owner__name">{ev.ownerEmail.split('@')[0]}</span>
            </span>
          ) : (
            <span className="dl-owner__none">—</span>
          )}
        </span>

        {/* Readiness + status */}
        <span className="dl-status">
          <span className="dl-status__dots" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`dl-dot${i < filledDots ? ' dl-dot--on' : ''}`} />
            ))}
          </span>
          <span className={`dl-status__label dl-status__label--${tone}`}>{statusLabel}</span>
        </span>

        {/* Updated — no real per-event last-modified timestamp is tracked yet */}
        <span className="dl-updated">—</span>

        <span className="dl-arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

// ─── Month section ────────────────────────────────────────────────────────────

interface MonthSectionProps {
  month: string;
  events: Event[];
  healthByCode: Record<string, EventHealth>;
  isCompleted: boolean;
}

function MonthSection({ month, events, healthByCode, isCompleted }: MonthSectionProps) {
  return (
    <div className="dashboard__month-group">
      <h2 className="dashboard__month-heading">
        <span className="dmh-label">{month}</span>
        <span className="dmh-rule" aria-hidden="true" />
        <span className="dmh-count">{events.length}</span>
      </h2>
      <div className="dashboard__list">
        {events.map((ev) => (
          <EventRow
            key={ev.rowId}
            ev={ev}
            health={healthByCode[ev.code]}
            isCompleted={isCompleted}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [healthByCode, setHealthByCode] = useState<Record<string, EventHealth>>({});
  const [completedOpen, setCompletedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents();
      const loadedEvents = data.events ?? [];
      setEvents(loadedEvents);
      const health = await fetchDashboardHealth(loadedEvents);
      setHealthByCode(health);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSort(key: SortKey) {
    setSortDir((prevDir) => (sortKey === key ? (prevDir === 1 ? -1 : 1) : 1));
    setSortKey(key);
  }

  // Split events into active / inactive (Proposed & Awarded are active;
  // Completed, Postponed, Cancelled, Archived are all "inactive" together)
  const { activeEvents, completedEvents } = useMemo(() => {
    const active: Event[] = [];
    const completed: Event[] = [];
    const list = Array.isArray(events) ? events : [];
    for (const ev of list) {
      (isEventActive(ev) ? active : completed).push(ev);
    }
    return { activeEvents: active, completedEvents: completed };
  }, [events]);

  // Distinct owners among active events, for the "All owners" filter
  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const ev of activeEvents) {
      const email = ev.ownerEmail?.trim();
      if (email) set.add(email);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeEvents]);

  const awardedCount = useMemo(
    () => activeEvents.filter((ev) => getEventStatus(ev) === 'Awarded').length,
    [activeEvents],
  );

  // Per-filter counts, independent of which tab is currently selected
  const filterCounts = useMemo(() => {
    const counts = {} as Record<Filter, number>;
    for (const { id } of FILTERS) {
      counts[id] = activeEvents.filter((e) => matchesFilter(e, id, healthByCode[e.code])).length;
    }
    return counts;
  }, [activeEvents, healthByCode]);

  // Apply tab filter + search + owner filter to active events
  const filteredActive = useMemo(
    () =>
      activeEvents.filter(
        (e) =>
          matchesFilter(e, filter, healthByCode[e.code]) &&
          matchesSearch(e, search) &&
          (!ownerFilter || e.ownerEmail === ownerFilter),
      ),
    [activeEvents, filter, healthByCode, search, ownerFilter],
  );

  // Group & sort — active rows honor the clicked sort column; month order
  // itself always stays chronological (see groupByMonth).
  const activeGroups = useMemo(
    () => groupByMonth(filteredActive, 'asc', (a, b) => compareEvents(a, b, sortKey, sortDir)),
    [filteredActive, sortKey, sortDir],
  );
  const completedGroups = useMemo(() => groupByMonth(completedEvents, 'desc'), [completedEvents]);

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <div className="dashboard">
      {/* Title */}
      <div className="dashboard__title-row">
        <div className="dashboard__kicker">Operational execution</div>
        <div className="dashboard__title-line">
          <h1>Event Operations</h1>
          <button
            type="button"
            className={`dashboard__refresh${loading ? ' loading' : ''}`}
            onClick={load}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
          {user && (
            <button
              type="button"
              className="dashboard__new"
              onClick={() => setShowNewProject(true)}
              title="New event"
              aria-label="New event"
            >
              <NewEventIcon />
              New event
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="dashboard__stats">
        <div className="dashboard__stat-card">
          <div className="dashboard__stat-figure">{activeEvents.length}</div>
          <div className="dashboard__stat-label">Active events</div>
        </div>
        <div className="dashboard__stat-card">
          <div className="dashboard__stat-figure">{awardedCount}</div>
          <div className="dashboard__stat-label">Awarded</div>
        </div>
        <div className="dashboard__stat-card">
          <div className="dashboard__stat-figure">{completedEvents.length}</div>
          <div className="dashboard__stat-label">Completed</div>
        </div>
      </div>

      {/* Filter pills + search + owner */}
      <div className="dashboard__toolbar">
        <div className="dashboard__filters">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`dashboard__filter-pill${filter === id ? ' active' : ''}`}
              onClick={() => setFilter(id)}
            >
              <span>{label}</span>
              <span className="dashboard__filter-count">{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="dashboard__toolbar-controls">
          <label className="dashboard__search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search event, city or owner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="dashboard__owner-filter"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {owners.map((email) => (
              <option key={email} value={email}>{email.split('@')[0]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Column header — shares the row grid */}
      <div className="dashboard__list-head">
        <button type="button" className="dlh-sort" onClick={() => toggleSort('code')}>Event{sortArrow('code')}</button>
        <span>Location</span>
        <button type="button" className="dlh-sort" onClick={() => toggleSort('date')}>Dates{sortArrow('date')}</button>
        <span />
        <span>Assigned</span>
        <span>Status</span>
        <button type="button" className="dlh-sort" onClick={() => toggleSort('updated')}>Updated{sortArrow('updated')}</button>
        <span />
      </div>

      {loading && <p className="dashboard__msg">Loading events…</p>}
      {error && <p className="dashboard__msg dashboard__msg--err">{error}</p>}

      {!loading && !error && (Array.isArray(events) ? events : []).length === 0 && (
        <div className="dashboard__empty">
          <p>No events yet.</p>
          {user && (
            <button type="button" className="dashboard__new" onClick={() => setShowNewProject(true)}>
              + Create first event
            </button>
          )}
        </div>
      )}

      {/* Active events — month sections */}
      {activeGroups.map(({ month, events: monthEvents }) => (
        <MonthSection
          key={month}
          month={month}
          events={monthEvents}
          healthByCode={healthByCode}
          isCompleted={false}
        />
      ))}

      {!loading && filteredActive.length === 0 && activeEvents.length > 0 && (
        <div className="dashboard__no-match">
          <div className="dashboard__no-match-title">Nothing matches</div>
          <p>No event in this view. Clear the filter to see the full schedule.</p>
          <button
            type="button"
            className="dashboard__clear-filters"
            onClick={() => { setFilter('all'); setSearch(''); setOwnerFilter(''); }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Completed events (Completed/Postponed/Cancelled/Archived) — collapsible, grouped by month */}
      {completedGroups.length > 0 && (
        <div className="dashboard__completed">
          <button
            type="button"
            className="dashboard__completed-toggle"
            onClick={() => setCompletedOpen((o) => !o)}
            aria-expanded={completedOpen}
          >
            <span className={`dc-chevron${completedOpen ? ' dc-chevron--open' : ''}`} aria-hidden="true">›</span>
            Completed events
            <span className="dc-count">{completedEvents.length}</span>
            <span className="dc-hint">{completedOpen ? 'Collapse' : 'Expand'}</span>
          </button>

          {completedOpen && (
            <div className="dashboard__completed-body">
              {completedGroups.map(({ month, events: monthEvents }) => (
                <MonthSection
                  key={month}
                  month={month}
                  events={monthEvents}
                  healthByCode={healthByCode}
                  isCompleted
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showNewProject && user && (
        <NewProjectModal
          actorEmail={user.email}
          onClose={() => setShowNewProject(false)}
          onCreated={(code) => {
            setShowNewProject(false);
            navigate(`/event/${encodeURIComponent(code)}`);
          }}
        />
      )}
    </div>
  );
}
