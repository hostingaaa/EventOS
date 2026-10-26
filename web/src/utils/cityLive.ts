/** Presentation helpers for the event page's "city now" card. */

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'snow';

/** Icon family for a WMO weather code (https://open-meteo.com/en/docs#weathervariables). */
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return 'sun';
  if (code <= 3 || code === 45 || code === 48) return 'cloud';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

export function weatherName(code: number): string {
  return WEATHER_NAMES[code] ?? 'Mixed';
}

/** "12,000 UZS", "3.01 TND", "0.89 EUR" — enough precision for the size of the rate. */
export function formatRate(rate: number, currency: string): string {
  const digits = rate >= 100 ? 0 : rate >= 10 ? 1 : 2;
  const text = rate.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  return `${text} ${currency}`;
}

/** "Updated 15 Oct" from a unix-seconds timestamp. */
export function formatRateUpdated(unixSeconds: number | undefined): string {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  return `Updated ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
}

/** Local time in an IANA zone as "HH:MM"; empty when the zone is missing or invalid. */
export function localClock(timezone: string, now: number): string {
  if (!timezone) return '';
  try {
    return new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  } catch {
    return '';
  }
}

/** The city portion of an event's Location cell ("Tashkent, Uzbekistan" → "Tashkent"). */
export function cityOf(location: string): string {
  return (location || '').split(',')[0].trim();
}
