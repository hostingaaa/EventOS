import { useEffect, useState } from 'react';
import { fetchCityLive } from '../../api/client';
import type { CityLive } from '../../types';

const REFRESH_MS = 10 * 60 * 1000;
const CLOCK_MS = 30 * 1000;

/**
 * Live weather / FX for an event's city. Refreshes every 10 minutes and ticks a clock every 30 seconds so the
 * "local time" stays right. `data` is null while loading and after a failure with nothing earlier to show;
 * a failed refresh keeps the last good data.
 */
export function useCityLive(location: string): { loading: boolean; data: CityLive | null; now: number } {
  const [result, setResult] = useState<{ location: string; data: CityLive | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchCityLive(location)
        .then((data) => {
          if (!cancelled) setResult({ location, data });
        })
        .catch(() => {
          if (!cancelled) setResult((prev) => (prev && prev.location === location && prev.data ? prev : { location, data: null }));
        });
    };
    load();
    const refresh = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [location]);

  const current = result && result.location === location ? result : null;
  return { loading: !current, data: current?.data ?? null, now };
}
