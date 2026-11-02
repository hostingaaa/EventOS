import type { PeriodId, PeriodOption } from '../../utils/reports';

interface Props {
  options: PeriodOption[];
  value: PeriodId;
  onChange: (id: PeriodId) => void;
}

/** The white pill group of reporting periods (Q3 · Q4 · YTD · FY). */
export function PeriodSwitcher({ options, value, onChange }: Props) {
  return (
    <div className="rp-periods" role="group" aria-label="Reporting period">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`rp-periods__opt${o.id === value ? ' is-on' : ''}`}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
