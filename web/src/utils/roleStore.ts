// ─── Role & capability definitions ────────────────────────────────────────

export type AppRole = 'admin' | 'project_lead' | 'director';

export const ROLE_LABELS: Record<AppRole, string> = {
  admin:        'Admin',
  project_lead: 'Project Lead',
  director:     'Director',
};

export const ROLE_COLORS: Record<AppRole, { bg: string; color: string }> = {
  admin:        { bg: '#fee2e2', color: '#b91c1c' },
  project_lead: { bg: '#dbeafe', color: '#1d4ed8' },
  director:     { bg: '#ede9fe', color: '#6d28d9' },
};

// ─── Capabilities ─────────────────────────────────────────────────────────

export type AppCapability =
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'events.assign'
  | 'tasks.view'
  | 'tasks.manage'
  | 'task_templates'
  | 'team.view'
  | 'templates.view'
  | 'templates.manage'
  | 'designs'
  | 'generators'
  | 'sow_generator'
  | 'admin_panel';

export interface CapabilityMeta {
  key: AppCapability;
  label: string;
  group: string;
  /** Short help text on the Role Permissions page */
  description?: string;
  /** Admin always has this — cannot be toggled */
  adminLocked?: boolean;
}

/** Display order for permission groups on the Role Permissions tab. */
export const CAPABILITY_GROUPS = [
  'Events',
  'Tasks',
  'Team',
  'Templates',
  'Tools',
  'Admin',
] as const;

export const CAPABILITY_LIST: CapabilityMeta[] = [
  {
    key: 'events.view',
    label: 'View events & workspaces',
    group: 'Events',
    description: 'See the dashboard, calendar, and event workspaces.',
  },
  {
    key: 'events.create',
    label: 'Create new events',
    group: 'Events',
    description: 'Use “New event” and the SOW generator to add projects.',
  },
  {
    key: 'events.edit',
    label: 'Edit event details',
    group: 'Events',
    description: 'Update LEM, venue, SOW link, notes, and per-diem fields.',
  },
  {
    key: 'events.delete',
    label: 'Delete events permanently',
    group: 'Events',
    description: 'Remove events and their tasks from the dashboard (cannot be undone).',
  },
  {
    key: 'events.assign',
    label: 'Change assigned member',
    group: 'Events',
    description: 'Reassign who owns an event from the workspace Overview tab.',
  },
  {
    key: 'tasks.view',
    label: 'View tasks',
    group: 'Tasks',
    description: 'Open task lists and task details inside event workspaces.',
  },
  {
    key: 'tasks.manage',
    label: 'Create / update tasks',
    group: 'Tasks',
    description: 'Add tasks, change status, upload files, and post comments.',
  },
  {
    key: 'task_templates',
    label: 'Task Templates page',
    group: 'Tasks',
    description: 'Access the reusable LEM task templates library.',
  },
  {
    key: 'team.view',
    label: 'View team members',
    group: 'Team',
    description: 'See the Team page and who is assigned to which events.',
  },
  {
    key: 'templates.view',
    label: 'View file templates',
    group: 'Templates',
    description: 'Browse org-wide reference files and template attachments.',
  },
  {
    key: 'templates.manage',
    label: 'Upload / delete templates',
    group: 'Templates',
    description: 'Add or remove files on the Org Templates page.',
  },
  {
    key: 'designs',
    label: 'Designs (badges, certs…)',
    group: 'Tools',
    description: 'Open the Designs workspace for badges, certificates, and banners.',
  },
  {
    key: 'generators',
    label: 'Generators hub',
    group: 'Tools',
    description: 'Access transfer lists, AV lists, and other generators.',
  },
  {
    key: 'sow_generator',
    label: 'SOW Event Generator',
    group: 'Tools',
    description: 'Parse SOW PDFs and create fully templated events.',
  },
  {
    key: 'admin_panel',
    label: 'Admin Panel',
    group: 'Admin',
    description: 'Manage members and role permissions (admins only).',
    adminLocked: true,
  },
];

export type CapMatrix = Record<AppRole, Record<AppCapability, boolean>>;

const DEFAULT_MATRIX: CapMatrix = {
  admin: Object.fromEntries(
    CAPABILITY_LIST.map((c) => [c.key, true]),
  ) as Record<AppCapability, boolean>,

  project_lead: {
    'events.view':       true,
    'events.create':     true,
    'events.edit':       true,
    'events.delete':     false,
    'events.assign':     false,
    'tasks.view':        true,
    'tasks.manage':      true,
    'task_templates':    false,
    'team.view':         true,
    'templates.view':    true,
    'templates.manage':  false,
    'designs':           true,
    'generators':        true,
    'sow_generator':     false,
    'admin_panel':       false,
  },

  director: {
    'events.view':       true,
    'events.create':     false,
    'events.edit':       false,
    'events.delete':     false,
    'events.assign':     false,
    'tasks.view':        true,
    'tasks.manage':      false,
    'task_templates':    false,
    'team.view':         true,
    'templates.view':    true,
    'templates.manage':  false,
    'designs':           true,
    'generators':        false,
    'sow_generator':     false,
    'admin_panel':       false,
  },
};

// ─── Org members ──────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: 'active' | 'invited' | 'inactive';
  createdAt: string;
  invitedBy: string;
}

const MEMBERS_KEY = 'org_members_v1';
const CAPS_KEY    = 'role_capabilities_v1';

const SEED_MEMBERS: OrgMember[] = [
  { id: 'seed-admin', name: 'Admin',       email: 'admin@team.org',    role: 'admin',        status: 'active', createdAt: '2025-01-01', invitedBy: '' },
  { id: 'seed-lead',  name: 'Lead',        email: 'lead@team.org',     role: 'project_lead', status: 'active', createdAt: '2025-01-01', invitedBy: 'admin@team.org' },
  { id: 'seed-dir',   name: 'Director',    email: 'director@team.org', role: 'director',     status: 'active', createdAt: '2025-01-01', invitedBy: 'admin@team.org' },
  { id: 'member-noemi', name: 'Noemi', email: 'translations@connectmice.com', role: 'project_lead', status: 'active', createdAt: '2026-06-05', invitedBy: 'admin@connectmice.com' },
];

// ── Members CRUD ─────────────────────────────────────────────────────────

export function getMembers(): OrgMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (raw) return JSON.parse(raw) as OrgMember[];
  } catch { /* ignore */ }
  // First run: seed defaults (mock mode only; real mode seeds via initAuthStore)
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(SEED_MEMBERS));
  return SEED_MEMBERS;
}

export function saveMembers(members: OrgMember[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function getMemberByEmail(email: string): OrgMember | null {
  return getMembers().find((m) => m.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Active and invited org members who can be assigned to events. */
export function getAssignableMembers(): OrgMember[] {
  return getMembers().filter((m) => m.status !== 'inactive');
}

/**
 * Upserts a member in the local cache and, in real mode, fires a background
 * write to GAS (non-blocking so the UI stays responsive).
 */
export function upsertMember(member: OrgMember, actorEmail?: string): void {
  // Local cache update (synchronous — keeps existing callers unchanged)
  const all = getMembers();
  const idx = all.findIndex((m) => m.id === member.id);
  if (idx >= 0) all[idx] = member;
  else all.push(member);
  saveMembers(all);

  // Background sync to GAS (fire-and-forget)
  import('../api/client').then(({ useMockData, apiMembersUpsert }) => {
    if (!useMockData()) {
      apiMembersUpsert(member, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] membersUpsert failed:', err),
      );
    }
  });
}

/**
 * Deactivates a member in the local cache and, in real mode, fires a
 * background write to GAS.
 */
export function deactivateMember(id: string, actorEmail?: string): void {
  const all = getMembers().map((m) => m.id === id ? { ...m, status: 'inactive' as const } : m);
  saveMembers(all);

  import('../api/client').then(({ useMockData, apiMembersDeactivate }) => {
    if (!useMockData()) {
      apiMembersDeactivate(id, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] membersDeactivate failed:', err),
      );
    }
  });
}

/**
 * Permanently removes a member from the local cache and, in real mode,
 * fires a background write to GAS. Unlike deactivateMember, this can't be
 * undone — meant for cleaning up unused accounts (stale invites, test
 * rows), not for removing someone still genuinely on the team.
 */
export function deleteMember(id: string, actorEmail?: string): void {
  const all = getMembers().filter((m) => m.id !== id);
  saveMembers(all);

  import('../api/client').then(({ useMockData, apiMembersDelete }) => {
    if (!useMockData()) {
      apiMembersDelete(id, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] membersDelete failed:', err),
      );
    }
  });
}

// ── Capability matrix CRUD ───────────────────────────────────────────────

/** Merge stored matrix with defaults so new capabilities appear after upgrades. */
export function normalizeCapMatrix(stored: Partial<CapMatrix> | null): CapMatrix {
  const merged: CapMatrix = {
    admin: { ...DEFAULT_MATRIX.admin },
    project_lead: { ...DEFAULT_MATRIX.project_lead },
    director: { ...DEFAULT_MATRIX.director },
  };
  if (!stored) return merged;

  for (const role of ['project_lead', 'director'] as AppRole[]) {
    const saved = stored[role];
    if (!saved) continue;
    for (const cap of CAPABILITY_LIST) {
      if (saved[cap.key] !== undefined) {
        merged[role][cap.key] = saved[cap.key]!;
      }
    }
  }
  return merged;
}

export function getCapMatrix(): CapMatrix {
  try {
    const raw = localStorage.getItem(CAPS_KEY);
    if (raw) {
      return normalizeCapMatrix(JSON.parse(raw) as Partial<CapMatrix>);
    }
  } catch { /* ignore */ }
  return normalizeCapMatrix(null);
}

/**
 * Saves the capability matrix to the local cache and, in real mode, fires a
 * background write to GAS.
 */
export function saveCapMatrix(matrix: CapMatrix, actorEmail?: string): void {
  const normalized = normalizeCapMatrix({
    project_lead: matrix.project_lead,
    director: matrix.director,
  });
  normalized.admin = DEFAULT_MATRIX.admin;
  localStorage.setItem(CAPS_KEY, JSON.stringify(normalized));

  import('../api/client').then(({ useMockData, apiCapsSave }) => {
    if (!useMockData()) {
      apiCapsSave(normalized, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] capsSave failed:', err),
      );
    }
  });
}

export function can(role: AppRole | null | undefined, cap: AppCapability): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const matrix = getCapMatrix();
  return matrix[role]?.[cap] ?? false;
}

// ── Remote sync helpers (called by initAuthStore on startup) ──────────────

/** Fetches org members from GAS and refreshes the localStorage cache. */
export async function fetchAndCacheMembers(): Promise<void> {
  const { apiMembersList } = await import('../api/client');
  try {
    const remote = await apiMembersList();
    if (remote.length === 0) return;

    const local = getMembers();
    const seen = new Set(remote.map((m) => m.email.toLowerCase()));
    const merged = [
      ...remote,
      ...local.filter((m) => !seen.has(m.email.toLowerCase())),
    ];
    saveMembers(merged);
  } catch (err) {
    console.warn('[roleStore] Failed to fetch members from server:', err);
  }
}

/** Fetches the capability matrix from GAS and refreshes the localStorage cache. */
export async function fetchAndCacheCapMatrix(): Promise<void> {
  const { apiCapsList } = await import('../api/client');
  try {
    const matrix = await apiCapsList();
    if (matrix) {
      localStorage.setItem(CAPS_KEY, JSON.stringify(normalizeCapMatrix(matrix)));
    }
  } catch (err) {
    console.warn('[roleStore] Failed to fetch cap matrix from server:', err);
  }
}
