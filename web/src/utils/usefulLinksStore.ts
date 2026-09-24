/** Mock-mode (localStorage) backing store for the "Useful Links" section on
 * the Templates page — mirrors orgTemplatesStore.ts's shape, minus any file
 * handling since a link is just a title + URL. */
const STORAGE_KEY = 'useful_links_v1';

export interface UsefulLinkEntry {
  id: string;
  title: string;
  url: string;
  notes?: string;
  addedBy: string;
  addedAt: string;
}

function load(): UsefulLinkEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UsefulLinkEntry[];
  } catch {
    // ignore
  }
  return [];
}

function save(links: UsefulLinkEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function getUsefulLinks(): UsefulLinkEntry[] {
  return load();
}

export function upsertUsefulLink(
  payload: { id?: string; title: string; url: string; notes?: string },
  actorEmail: string,
): UsefulLinkEntry {
  const links = load();
  const now = new Date().toISOString();
  if (payload.id) {
    const idx = links.findIndex((l) => l.id === payload.id);
    if (idx === -1) throw new Error('Not found');
    links[idx] = { ...links[idx], title: payload.title, url: payload.url, notes: payload.notes, addedBy: actorEmail, addedAt: now };
    save(links);
    return links[idx];
  }
  const entry: UsefulLinkEntry = {
    id: 'link-' + Date.now(),
    title: payload.title,
    url: payload.url,
    notes: payload.notes,
    addedBy: actorEmail,
    addedAt: now,
  };
  save([...links, entry]);
  return entry;
}

export function deleteUsefulLinkEntry(id: string): void {
  save(load().filter((l) => l.id !== id));
}
