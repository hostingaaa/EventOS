import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildMonthDays, parseIsoDate, startOfMonth, todayAtNoon } from '../utils/calendarDates';
import { formatProgramDates } from '../utils/dateFormat';
import './ProgramDatesPicker.css';

interface ProgramDatesPickerProps {
  value: string[];
  onChange: (dates: string[]) => void;
  id?: string;
}

interface Anchor {
  top:    number;
  bottom: number;
  left:   number;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_WIDTH = 280;
const GAP = 6;

/** Height (px) reserved by a fixed bottom bar (e.g. the mobile tab bar),
 * read from the layout's own CSS contract so popovers never render content
 * behind it. 0 on desktop, where no such bar exists. */
function readBottomNavHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-nav-h');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function ProgramDatesPicker({ value, onChange, id }: ProgramDatesPickerProps) {
  const [open, setOpen]           = useState(false);
  const [anchor, setAnchor]       = useState<Anchor | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIsoDate(value[0]) || todayAtNoon()));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click — the panel is portaled to <body>, so it's no
  // longer a DOM descendant of rootRef and must be checked separately.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Re-anchor (not close) on scroll of any ancestor or window resize — the
  // panel's position is only captured at open time, so it would otherwise
  // drift out of place. Closing on scroll would also misfire from the
  // browser's own scroll-into-view-on-focus firing right as the panel opens.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left });
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Flip the panel above the trigger when it would otherwise render partly
  // or fully below the viewport — without this, the Done/Clear footer can
  // land off-screen (or behind a fixed bottom bar) with no way to reach it.
  // When NEITHER direction has room for the panel's full natural height
  // (small viewport, trigger mid-page), pick whichever side has more space
  // and cap the panel to exactly that — with its own overflow-y:auto, the
  // footer stays reachable by scrolling the panel itself instead of
  // overflowing past the viewport/nav bar with no way to reach it.
  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const panelHeight = panelRef.current.scrollHeight;
    const viewportBottom = window.innerHeight - readBottomNavHeight();
    const availableBelow = viewportBottom - anchor.bottom - GAP;
    const availableAbove = anchor.top - GAP;
    const fitsBelow = panelHeight <= availableBelow;
    const fitsAbove = panelHeight <= availableAbove;
    const upward = !fitsBelow && (fitsAbove || availableAbove > availableBelow);
    setOpenUpward(upward);
    setMaxHeight(Math.max(120, upward ? availableAbove : availableBelow));
  }, [open, anchor, viewMonth]);

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        setViewMonth(startOfMonth(parseIsoDate(value[0]) || todayAtNoon()));
        const rect = rootRef.current?.getBoundingClientRect();
        if (rect) setAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left });
        setOpenUpward(false);
        setMaxHeight(null);
      }
      return !wasOpen;
    });
  }

  function toggleDate(iso: string) {
    const next = new Set(value);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange(Array.from(next).sort());
  }

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1, 12, 0, 0, 0));
  }

  const days           = buildMonthDays(viewMonth);
  const leadingBlanks  = days.length ? days[0].date.getDay() : 0;
  const selected       = new Set(value);
  const summary        = formatProgramDates(value);

  const left = anchor
    ? Math.max(8, Math.min(anchor.left, window.innerWidth - PANEL_WIDTH - 8))
    : 0;

  return (
    <div className="pdp" ref={rootRef}>
      <button id={id} type="button" className="pdp-trigger" onClick={toggleOpen}>
        <span className="pdp-trigger__text">{summary || 'Select program dates'}</span>
        <span className="pdp-trigger__icon">📅</span>
      </button>

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          className="pdp-panel"
          style={{
            left,
            maxHeight: maxHeight ?? undefined,
            ...(openUpward
              ? { bottom: window.innerHeight - anchor.top + GAP, top: 'auto' }
              : { top: anchor.bottom + GAP, bottom: 'auto' }),
          }}
        >
          <div className="pdp-panel__header">
            <button type="button" className="pdp-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <span className="pdp-panel__month">
              {viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="pdp-nav" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>

          <div className="pdp-weekdays">
            {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="pdp-grid">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} className="pdp-day pdp-day--blank" />
            ))}
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                className={[
                  'pdp-day',
                  selected.has(d.iso) ? 'pdp-day--selected' : '',
                  d.isToday ? 'pdp-day--today' : '',
                  d.isWeekend ? 'pdp-day--weekend' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => toggleDate(d.iso)}
              >
                {d.dayNum}
              </button>
            ))}
          </div>

          <div className="pdp-panel__footer">
            <span className="pdp-panel__count">
              {value.length} date{value.length === 1 ? '' : 's'} selected
            </span>
            <div className="pdp-panel__actions">
              {value.length > 0 && (
                <button type="button" className="pdp-clear" onClick={() => onChange([])}>Clear</button>
              )}
              <button type="button" className="pdp-done" onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
