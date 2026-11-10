/**
 * Tiny persisted cache for read-only API data (events list, dashboard health).
 *
 * The Apps Script backend takes several seconds per call, so pages render the last-known data
 * immediately and refresh it in the background. Everything here is best-effort: localStorage can be
 * unavailable or full, in which case the app simply behaves as it did before (wait for the network).
 */

const PREFIX = 'eventos-cache-v1:';

export interface Stamped<T> {
  value: T;
  /** ms since epoch when the value was fetched. */
  at: number;
}

export function readPersisted<T>(key: string): Stamped<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stamped<T>;
    if (parsed && typeof parsed.at === 'number' && 'value' in parsed) return parsed;
  } catch {
    /* corrupt or unavailable — treat as a miss */
  }
  return null;
}

export function writePersisted<T>(key: string, entry: Stamped<T>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / private mode — the in-memory copy still works */
  }
}

/** Removes every persisted API cache entry (sign-out / switching accounts). */
export function clearPersisted(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
