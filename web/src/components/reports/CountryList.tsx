import type { CountryRow } from '../../utils/reports';
import { marginText, moneyShort } from '../../utils/reports';

interface Props {
  countries: CountryRow[];
  selected: string | null;
  onSelect: (country: string | null) => void;
}

/** Delivered revenue by country; clicking a row filters the whole page to it. */
export function CountryList({ countries, selected, onSelect }: Props) {
  const top = Math.max(1, ...countries.map((c) => c.revenue));
  return (
    <div className="rp-card">
      <div className="rp-card__head">
        <h3>Revenue by country</h3>
        {selected && (
          <button type="button" className="rp-link rp-link--right" onClick={() => onSelect(null)}>
            Clear filter
          </button>
        )}
      </div>
      <div className="rp-countries">
        {countries.map((c) => {
          const on = selected === c.name;
          return (
            <button
              key={c.name}
              type="button"
              className={`rp-country${on ? ' is-on' : ''}${selected && !on ? ' is-dim' : ''}`}
              aria-pressed={on}
              onClick={() => onSelect(on ? null : c.name)}
            >
              <span className="rp-country__line">
                <span className="rp-country__name">{c.name}</span>
                <span className="rp-country__count">{c.count} event{c.count > 1 ? 's' : ''}</span>
                <span className="rp-country__value">{moneyShort(c.revenue)}</span>
                <span className="rp-country__margin">{marginText(c.revenue, c.cost)}</span>
              </span>
              <span className="rp-bar-track">
                <span className="rp-bar-fill" style={{ width: `${(c.revenue / top) * 100}%` }} />
              </span>
            </button>
          );
        })}
        {countries.length === 0 && <p className="rp-empty">No delivered events in this period.</p>}
      </div>
      <p className="rp-note">Right column is gross margin. Click a country to filter the report.</p>
    </div>
  );
}
