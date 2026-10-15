/** Turns an Activity-sheet row into the "**Who** did what" sentence the Activity tab shows. */
import type { ActivityItem } from '../types';
import { getMemberByEmail } from './roleStore';

const STATUS_WORDS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

/**
 * Rows written before the readable-activity change store a bare value as `summary` (a task title, a status
 * key, a note excerpt…), so these types are phrased here. Every newer type already stores the full sentence
 * (e.g. "completed SOW / contract") as `summary` and is shown as-is.
 */
const LEGACY: Record<string, (summary: string) => string> = {
  task_created: (s) => `added the task “${s}”`,
  task_updated: (s) => (STATUS_WORDS[s] ? `set a task to ${STATUS_WORDS[s]}` : `updated “${s}”`),
  comment_added: (s) => `commented “${s}”`,
  file_uploaded: (s) => `uploaded ${s}`,
  file_deleted: (s) => `removed ${s}`,
  cost_item_created: (s) => `added cost item “${s}”`,
  cost_item_updated: (s) => `updated cost item “${s}”`,
  cost_item_deleted: (s) => `removed cost item “${s}”`,
  vendor_link_created: (s) =>
    /^vendor link created$/i.test(s) ? 'created a vendor link' : `created the ${s.replace(/ link created$/i, '')} vendor link`,
  vendor_link_revoked: () => 'revoked a vendor link',
  event_created: () => 'created the event',
  event_deleted: () => 'deleted the event',
  templates_applied: (s) => `added ${s}`,
};

export function activityPhrase(item: Pick<ActivityItem, 'type' | 'summary'>): string {
  const summary = (item.summary || '').trim();
  const legacy = LEGACY[item.type];
  if (legacy) return legacy(summary);
  return summary || item.type.replace(/_/g, ' ');
}

/** A person's display name for an Activity `actor` (an email, "system", or "vendor:<name>"). */
export function actorName(actor: string): string {
  const a = (actor || '').trim();
  if (!a) return 'Someone';
  if (a === 'system' || a === 'template') return 'System';
  if (a.startsWith('vendor:')) return `${a.slice(7).trim() || 'A vendor'} (vendor)`;
  const member = getMemberByEmail(a);
  if (member?.name) return member.name;
  return a.includes('@') ? a.split('@')[0] : a;
}

/** "Today 14:05", "Yesterday", "14 Oct", or "14 Oct 2025" for older years. */
export function formatLogTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '';
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) {
    return `Today ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  const base = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "Today 14:05" or "13 Oct 16:40" (with the year when it isn't this one) — the time stamp on a note. */
export function formatNoteTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '';
  const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return `Today ${clock}`;
  const day = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  return `${d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`} ${clock}`;
}
