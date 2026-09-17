import './BreakdownBarList.css';

interface Entry {
  key: string;
  label: string;
  value: number;
}

interface Props {
  title: string;
  entries: Entry[];
  formatValue?: (n: number) => string;
  emptyText?: string;
}

function defaultFormat(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Ranked horizontal bar list — used for category/owner/country breakdowns. */
export function BreakdownBarList({ title, entries, formatValue = defaultFormat, emptyText = 'No data yet.' }: Props) {
  const max = Math.max(1, ...entries.map((e) => Math.abs(e.value)));

  return (
    <div className="breakdown-bars">
      <h3>{title}</h3>
      {entries.length === 0 && <p className="breakdown-bars__empty">{emptyText}</p>}
      {entries.map((entry) => (
        <div key={entry.key} className="breakdown-bars__row">
          <span className="breakdown-bars__label" title={entry.label}>{entry.label}</span>
          <div className="breakdown-bars__track">
            <div
              className={`breakdown-bars__fill${entry.value < 0 ? ' breakdown-bars__fill--negative' : ''}`}
              style={{ width: `${(Math.abs(entry.value) / max) * 100}%` }}
            />
          </div>
          <span className="breakdown-bars__value">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}
