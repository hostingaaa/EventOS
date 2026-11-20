/** The event picker shared by the Generators page and the generators themselves. */
import type { Event } from '../types';
import { isEventSetAside } from './eventLifecycle';
import { cityOfLocation, countryOfLocation, UNKNOWN_COUNTRY } from './countries';
import { eventPhase, shortEventDates } from './generatorStatus';

/** Finished events stay pickable this long — service reports and late re-exports happen after the event. */
const RECENT_PAST_DAYS = 60;

/** Happening now, then upcoming (soonest first), then undated, then recently finished. `keepCode` is always kept. */
export function generatorEventOptions(events: Event[], keepCode: string | null): Event[] {
  const today = new Date();
  const ranked = events
    .map((ev) => ({ ev, phase: eventPhase(ev, today) }))
    .filter(({ ev, phase }) => {
      if (ev.code === keepCode) return true;
      if (isEventSetAside(ev)) return false;
      return phase.rank !== 2 || phase.days <= RECENT_PAST_DAYS;
    });
  ranked.sort((a, b) => a.phase.rank - b.phase.rank || a.phase.days - b.phase.days || a.ev.code.localeCompare(b.ev.code));
  return ranked.map((r) => r.ev);
}

/** "J234 · Kurumba, Maldives · Dec 2". */
export function generatorEventLabel(ev: Event): string {
  const city = cityOfLocation(ev.location ?? '');
  const country = countryOfLocation(ev.location ?? '');
  const place = [city, country !== UNKNOWN_COUNTRY && country !== city ? country : ''].filter(Boolean).join(', ');
  return [ev.code, place, shortEventDates(ev)].filter(Boolean).join(' · ');
}
