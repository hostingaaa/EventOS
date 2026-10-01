import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildMonthDays, parseIsoDate, startOfMonth, todayAtNoon } from '../utils/calendarDates';
import { formatProgramDates } from '../utils/dateFormat';
import './ProgramDatesPicker.css';

interface ProgramDatesPickerProps {
  value: string[];
  onChange: (dates: string[]) => void;
  id?: string;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ProgramDatesPicker({ value, onChange, id }: ProgramDatesPickerProps) {
  const [open, setOpen]           = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIsoDate(value[0]) || todayAtNoon()));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Flip the panel above the trigger when it would otherwise render partly
  // or fully below the viewport — without this, the Done/Clear footer can
  // land off-screen with no way to reach it.
  useLayoutEffect(() => {
    if (!open || !rootRef.current || !panelRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const fitsBelow = triggerRect.bottom + panelHeight <= window.innerHeight;
    const fitsAbove = triggerRect.top - panelHeight >= 0;
    setOpenUpward(!fitsBelow && fitsAbove);
  }, [open, viewMonth]);

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) setViewMonth(startOfMonth(parseIsoDate(value[0]) || todayAtNoon()));
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

  return (
    <div className="pdp" ref={rootRef}>
      <button id={id} type="button" className="pdp-trigger" onClick={toggleOpen}>
        <span className="pdp-trigger__text">{summary || 'Select program dates'}</span>
        <span className="pdp-trigger__icon">📅</span>
      </button>

      {open && (
        <div ref={panelRef} className={`pdp-panel${openUpward ? ' pdp-panel--up' : ''}`}>
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
        </div>
      )}
    </div>
  );
}
