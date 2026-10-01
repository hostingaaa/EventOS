import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { buildMonthDays, parseIsoDate, startOfMonth, todayAtNoon, toIsoDate } from '../utils/calendarDates';
import { formatIsoDate } from '../utils/dateFormat';
import './SingleDatePicker.css';

interface SingleDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function SingleDatePicker({ value, onChange, min, id, placeholder, disabled }: SingleDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIsoDate(value) || todayAtNoon()));
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

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !panelRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const fitsBelow = triggerRect.bottom + panelHeight <= window.innerHeight;
    const fitsAbove = triggerRect.top - panelHeight >= 0;
    setOpenUpward(!fitsBelow && fitsAbove);
  }, [open, viewMonth]);

  function toggleOpen() {
    if (disabled) return;
    setOpen((wasOpen) => {
      if (!wasOpen) setViewMonth(startOfMonth(parseIsoDate(value) || todayAtNoon()));
      return !wasOpen;
    });
  }

  function pickDate(iso: string) {
    if (min && iso < min) return;
    onChange(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1, 12, 0, 0, 0));
  }

  const days          = buildMonthDays(viewMonth);
  const leadingBlanks = days.length ? days[0].date.getDay() : 0;
  const todayIso      = toIsoDate(todayAtNoon());

  return (
    <div className="sdp" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="sdp-trigger"
        onClick={toggleOpen}
        disabled={disabled}
      >
        <span className="sdp-trigger__text">{value ? formatIsoDate(value) : placeholder || 'Select date'}</span>
        <span className="sdp-trigger__icon">📅</span>
      </button>

      {open && (
        <div ref={panelRef} className={`sdp-panel${openUpward ? ' sdp-panel--up' : ''}`}>
          <div className="sdp-panel__header">
            <button type="button" className="sdp-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <span className="sdp-panel__month">
              {viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="sdp-nav" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>

          <div className="sdp-weekdays">
            {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="sdp-grid">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} className="sdp-day sdp-day--blank" />
            ))}
            {days.map((d) => {
              const isDisabled = !!min && d.iso < min;
              return (
                <button
                  key={d.iso}
                  type="button"
                  disabled={isDisabled}
                  className={[
                    'sdp-day',
                    d.iso === value ? 'sdp-day--selected' : '',
                    d.iso === todayIso ? 'sdp-day--today' : '',
                    d.isWeekend ? 'sdp-day--weekend' : '',
                    isDisabled ? 'sdp-day--disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pickDate(d.iso)}
                >
                  {d.dayNum}
                </button>
              );
            })}
          </div>

          <div className="sdp-panel__footer">
            <button type="button" className="sdp-today" onClick={() => pickDate(todayIso)}>Today</button>
            {value && (
              <button type="button" className="sdp-clear" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
