import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchWhoami, useMockData } from '../api/client';
import type { TeamUser } from '../types';
import {
  type AppCapability,
  type AppRole,
  can as canForRole,
  getCapMatrix,
  getMemberByEmail,
} from '../utils/roleStore';
import { initAuthStore } from '../utils/authStore';

const STORAGE_KEY = 'event-ops-user';

interface UserContextValue {
  user: TeamUser | null;
  setUser: (user: TeamUser) => void;
  clearUser: () => void;
  isAdmin: boolean;
  role: AppRole | null;
  can: (cap: AppCapability) => boolean;
  isReady: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

function getMockAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

function loadUser(): TeamUser | null {
  try {
    // An invitation link (?email=...) must always land on registration/
    // sign-in for that specific address — never silently show whichever
    // account happens to already be logged in on this device/browser (e.g.
    // a shared computer, or the admin's own browser after inviting
    // someone). See the matching ?email= handling in JoinTeamModal.tsx.
    if (new URLSearchParams(window.location.search).has('email')) return null;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeamUser;
    if (parsed.name && parsed.email) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function resolveRoleFromEmail(email: string): AppRole {
  // Check org members store first
  const member = getMemberByEmail(email);
  if (member && member.status === 'active') return member.role;

  // Fall back to env-list / email heuristic
  const admins = getMockAdminEmails();
  const lower = email.toLowerCase();
  if (admins.length > 0 && admins.includes(lower)) return 'admin';
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('director')) return 'director';
  return 'project_lead';
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<TeamUser | null>(() => loadUser());
  const [role, setRole] = useState<AppRole | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshRole = useCallback(async (u: TeamUser | null) => {
    if (!u) {
      setRole(null);
      return;
    }
    if (useMockData()) {
      setRole(resolveRoleFromEmail(u.email));
      return;
    }
    try {
      const who = await fetchWhoami(u.email);
      // If API returns isAdmin, treat as admin; otherwise derive from org store
      const r: AppRole = who.isAdmin ? 'admin' : resolveRoleFromEmail(u.email);
      setRole(r);
    } catch {
      setRole(resolveRoleFromEmail(u.email));
    }
  }, []);

  // Seed the default admin account on first run, then resolve the current user's role
  useEffect(() => {
    initAuthStore()
      .then(() => refreshRole(user))
      .finally(() => setIsReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-resolve role when user changes after initial mount
  useEffect(() => {
    if (isReady) refreshRole(user);
  }, [user, refreshRole, isReady]);

  // Re-resolve if the capability matrix or members store changes
  // (triggered by admin panel saves via storage events)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'org_members_v1' || e.key === 'role_capabilities_v1') {
        if (user) refreshRole(user);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [user, refreshRole]);

  const isAdmin = role === 'admin';

  const can = useCallback(
    (cap: AppCapability) => {
      if (!role) return false;
      if (role === 'admin') return true;
      // Always re-read matrix (live updates from admin panel)
      const matrix = getCapMatrix();
      return matrix[role]?.[cap] ?? false;
    },
    [role],
  );

  const setUser = useCallback((u: TeamUser) => {
    const resolvedRole = resolveRoleFromEmail(u.email);
    const withRole: TeamUser = { ...u, isAdmin: resolvedRole === 'admin', role: resolvedRole };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withRole));
    setUserState(withRole);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, clearUser, isAdmin, role, can, isReady }),
    [user, setUser, clearUser, isAdmin, role, can, isReady],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

/** Convenience: check a capability without the full hook */
export function useCapability(cap: AppCapability): boolean {
  return useUser().can(cap);
}

/** Expose role store helper so callers can force re-resolve after admin saves */
export function refreshUserRole(): void {
  // Dispatch a synthetic storage event on the current window
  window.dispatchEvent(new StorageEvent('storage', { key: 'org_members_v1' }));
}

export { canForRole };
