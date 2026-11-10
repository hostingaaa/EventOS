import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearApiCaches, fetchWhoami, useMockData } from '../api/client';
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
const ROLE_CACHE_KEY = 'event-ops-role-v1';

/** The role the server last gave this user — lets the app render with the right menus before whoami returns. */
function loadCachedRole(email: string | undefined): AppRole | null {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; role?: AppRole };
    if (parsed.email === email.toLowerCase() && parsed.role) return parsed.role;
  } catch {
    /* ignore */
  }
  return null;
}

function saveCachedRole(email: string, role: AppRole): void {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ email: email.toLowerCase(), role }));
  } catch {
    /* ignore */
  }
}

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
  // A returning user (real backend) starts with their last-known role and is ready immediately; the
  // network round trips below then confirm it in the background instead of blocking the first paint.
  const [cachedRole] = useState<AppRole | null>(() =>
    useMockData() ? null : loadCachedRole(loadUser()?.email),
  );
  const [role, setRole] = useState<AppRole | null>(cachedRole);
  const [isReady, setIsReady] = useState(cachedRole !== null);

  const refreshRole = useCallback(
    async (u: TeamUser | null, whoRequest?: ReturnType<typeof fetchWhoami>) => {
      if (!u) {
        setRole(null);
        return;
      }
      if (useMockData()) {
        setRole(resolveRoleFromEmail(u.email));
        return;
      }
      try {
        const who = await (whoRequest ?? fetchWhoami(u.email));
        // If API returns isAdmin, treat as admin; otherwise derive from org store
        const r: AppRole = who.isAdmin ? 'admin' : resolveRoleFromEmail(u.email);
        setRole(r);
        saveCachedRole(u.email, r);
      } catch {
        // Keep the role we already have (cached) rather than demoting on a network blip.
        setRole((prev) => prev ?? resolveRoleFromEmail(u.email));
      }
    },
    [],
  );

  // Seed the default admin account on first run, then resolve the current user's role.
  // whoami doesn't depend on the account/member sync, so it runs alongside it.
  useEffect(() => {
    const whoRequest = user && !useMockData() ? fetchWhoami(user.email) : undefined;
    whoRequest?.catch(() => {}); // handled in refreshRole; avoids an unhandled-rejection warning
    initAuthStore()
      .then(() => refreshRole(user, whoRequest))
      .finally(() => setIsReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-resolve role when the signed-in user changes after the initial mount
  const skipFirstUserEffect = useRef(true);
  useEffect(() => {
    if (skipFirstUserEffect.current) {
      skipFirstUserEffect.current = false;
      return;
    }
    refreshRole(user);
  }, [user, refreshRole]);

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
    clearApiCaches(); // never carry one account's cached data into another's session
    setUserState(withRole);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ROLE_CACHE_KEY);
    clearApiCaches();
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
