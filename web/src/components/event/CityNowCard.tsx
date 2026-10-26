import type { WeatherKind } from '../../utils/cityLive';
import { cityOf, formatRate, formatRateUpdated, isNight, localClock, localHour, weatherKind, weatherName } from '../../utils/cityLive';
import { useCityLive } from './useCityLive';

const ICONS: Record<WeatherKind | 'moon', React.ReactNode> = {
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
  rain: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" />
      <path d="M16 14v6M8 14v6M12 16v6" />
    </>
  ),
  snow: <path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4" />,
};

/** The "<City> now" summary card: local time, weather, and the USD rate for the event's city. */
export function CityNowCard({ location }: { location: string }) {
  const { loading, data, now } = useCityLive(location);
  const city = (data?.city || cityOf(location) || 'City').trim();

  const weather = data?.weather ?? null;
  const kind: WeatherKind = weather ? weatherKind(weather.code) : 'cloud';
  const clock = data ? localClock(data.timezone, now) : '';
  // Background follows the weather, and goes dark at night in the city; plain green until the weather is known.
  const tone = !weather ? 'plain' : isNight(localHour(data?.timezone ?? '', now)) ? 'night' : kind;

  const temp = weather ? `${Math.round(weather.temp)}°C` : '—';
  const detail = weather
    ? `${weatherName(weather.code)} · wind ${Math.round(weather.wind)} km/h`
    : loading
      ? 'Loading weather…'
      : 'Weather unavailable';

  // USD-based countries have nothing to convert; unknown cities have no currency to show.
  const showRate = loading || (!!data?.currency && data.currency !== 'USD');
  const rate = data?.fx && data.currency ? formatRate(data.fx.rate, data.currency) : null;
  const rateText = rate ?? (loading ? 'Loading…' : 'Rate unavailable');

  return (
    <div className={`ws-card ws-city ws-city--${tone}`}>
      <div className="ws-city__head">
        <span className="ws-label">{city} now</span>
        <span className="ws-city__clock">
          <span className={`ws-city__dot${weather ? ' ws-city__dot--live' : ''}`} />
          {clock ? `${clock} local` : ''}
        </span>
      </div>
      <div className="ws-city__weather">
        <span className="ws-city__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[tone === 'night' && kind === 'sun' ? 'moon' : kind]}
          </svg>
        </span>
        <div className="ws-city__reading">
          <div className="ws-city__temp">{temp}</div>
          <div className="ws-city__detail">{detail}</div>
        </div>
      </div>
      {showRate && (
        <div className="ws-city__fx">
          <span className="ws-city__fx-label">1 USD =</span>
          <strong>{rateText}</strong>
          <span className="ws-city__fx-updated">{data?.fx ? formatRateUpdated(data.fx.updated) : ''}</span>
        </div>
      )}
    </div>
  );
}
