import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface Anchor {
  top:    number;
  bottom: number;
  left:   number;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_WIDTH = 280;
const GAP = 6;

export function SingleDatePicker({ value, onChange, min, id, placeholder, disabled }: SingleDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIsoDate(value) || todayAtNoon()));
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

  // Re-anchor on scroll of any ancestor (or window resize) — the panel is
  // portaled and positioned from a rect captured at open time, so it would
  // otherwise drift out of place as the page (or a scrolling container)
  // moves under it. Note: closing on scroll instead of repositioning would
  // also misfire from the browser's own scroll-into-view on focus, which
  // fires right as the panel opens and would close it before it's seen.
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

  // Flip the panel above the trigger when it would otherwise overflow the
  // bottom of the viewport. Positioned relative to the viewport (not an
  // ancestor), so this can never be clipped by a scrolling container.
  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const panelHeight = panelRef.current.offsetHeight;
    const fitsBelow = anchor.bottom + GAP + panelHeight <= window.innerHeight;
    const fitsAbove = anchor.top - GAP - panelHeight >= 0;
    setOpenUpward(!fitsBelow && fitsAbove);
  }, [open, anchor, viewMonth]);

  function toggleOpen() {
    if (disabled) return;
    setOpen((wasOpen) => {
      if (!wasOpen) {
        setViewMonth(startOfMonth(parseIsoDate(value) || todayAtNoon()));
        const rect = rootRef.current?.getBoundingClientRect();
        if (rect) setAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left });
        setOpenUpward(false);
      }
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

  const left = anchor
    ? Math.max(8, Math.min(anchor.left, window.innerWidth - PANEL_WIDTH - 8))
    : 0;

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

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          className="sdp-panel sdp-panel--portal"
          style={{
            left,
            ...(openUpward
              ? { bottom: window.innerHeight - anchor.top + GAP, top: 'auto' }
              : { top: anchor.bottom + GAP, bottom: 'auto' }),
          }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
