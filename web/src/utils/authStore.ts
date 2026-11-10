/**
 * Authentication store.
 *
 * In real mode (VITE_API_URL set): accounts are persisted in Google Sheets
 * via the Apps Script backend. localStorage acts as a sync cache so
 * synchronous reads work without network round-trips after startup.
 *
 * In mock mode (no VITE_API_URL / VITE_USE_MOCK=true): everything stays
 * local, behaviour is identical to before.
 *
 * Default admin account (created on first run):
 *   Email:    admin@connectmice.com
 *   Password: EventOS@2026!
 */

import {
  useMockData,
  apiAuthRegister,
  apiAuthLogin,
  apiAuthChangePassword,
  apiAuthList,
} from '../api/client';

const AUTH_KEY = 'auth_accounts_v1';

// Per-app salt — keeps offline rainbow-table attacks impractical
const SALT = 'evos-2026-cm';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

// ── Hashing ───────────────────────────────────────────────────────────────

export async function hashPassword(email: string, password: string): Promise<string> {
  const input = `${email.toLowerCase().trim()}:${SALT}:${password}`;
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Cache (localStorage) ──────────────────────────────────────────────────

function getCachedAccounts(): AuthAccount[] {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as AuthAccount[];
  } catch { /* ignore */ }
  return [];
}

function setCachedAccounts(accounts: AuthAccount[]): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
}

// ── Public API ────────────────────────────────────────────────────────────

export function getAccountByEmail(email: string): AuthAccount | null {
  const lower = email.toLowerCase().trim();
  return getCachedAccounts().find((a) => a.email === lower) ?? null;
}

export async function verifyPassword(
  email: string,
  password: string,
): Promise<AuthAccount | null> {
  const hash = await hashPassword(email, password);

  if (!useMockData()) {
    // Always verify against the server in real mode to pick up password changes
    try {
      const account = await apiAuthLogin(email, hash);
      if (account) {
        // Refresh the cache entry so subsequent offline reads stay current
        const all = getCachedAccounts().filter((a) => a.email !== account.email);
        setCachedAccounts([...all, account]);
      }
      return account;
    } catch (err) {
      console.warn('[authStore] apiAuthLogin failed, falling back to cache:', err);
      // Fall through to cache check
    }
  }

  const account = getAccountByEmail(email);
  if (!account) return null;
  return hash === account.passwordHash ? account : null;
}

export async function createAuthAccount(
  name: string,
  email: string,
  password: string,
): Promise<AuthAccount> {
  const lower = email.toLowerCase().trim();
  const passwordHash = await hashPassword(lower, password);

  if (!useMockData()) {
    try {
      const account = await apiAuthRegister(name.trim(), lower, passwordHash);
      // Add to local cache
      const all = getCachedAccounts().filter((a) => a.email !== lower);
      setCachedAccounts([...all, account]);
      return account;
    } catch (err) {
      // Re-throw — registration errors (e.g. duplicate email) must surface to the UI
      throw err;
    }
  }

  // Mock mode: local-only
  if (getAccountByEmail(lower)) {
    throw new Error('An account with this email already exists.');
  }
  const account: AuthAccount = {
    id: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    email: lower,
    passwordHash,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  setCachedAccounts([...getCachedAccounts(), account]);
  return account;
}

export async function changePassword(email: string, newPassword: string): Promise<void> {
  const newHash = await hashPassword(email, newPassword);

  if (!useMockData()) {
    await apiAuthChangePassword(email, newHash);
  }

  // Update local cache regardless of mode
  const all = getCachedAccounts();
  const idx = all.findIndex((a) => a.email === email.toLowerCase().trim());
  if (idx >= 0) {
    all[idx] = { ...all[idx], passwordHash: newHash };
    setCachedAccounts(all);
  }
}

// ── Seed (first-run) ──────────────────────────────────────────────────────

const SEED_EMAIL    = 'admin@connectmice.com';
const SEED_NAME     = 'Admin';
const SEED_PASSWORD = 'EventOS@2026!';

/**
 * Called once on app startup (awaited by UserContext before rendering).
 *
 * Real mode:
 *   1. Fetches all accounts from GAS → seeds localStorage cache.
 *   2. Creates the default admin account on the server if the sheet is empty.
 *   3. Fetches org members and capabilities → seeds their caches.
 *
 * Mock mode: seeds localStorage if empty (original behaviour).
 */
export async function initAuthStore(): Promise<void> {
  if (!useMockData()) {
    await initRealMode_();
    return;
  }
  await initMockMode_();
}

async function initRealMode_(): Promise<void> {
  const { fetchAndCacheMembers, fetchAndCacheCapMatrix } = await import('./roleStore');

  // Accounts, members and capabilities are independent reads, so fetch them together
  // (each Apps Script call takes seconds; one after another they dominated startup).
  let remoteAccounts: AuthAccount[] = [];
  const [accountsResult] = await Promise.allSettled([
    apiAuthList(),
    fetchAndCacheMembers(),
    fetchAndCacheCapMatrix(),
  ]);
  if (accountsResult.status === 'fulfilled') {
    remoteAccounts = Array.isArray(accountsResult.value) ? accountsResult.value : [];
    setCachedAccounts(remoteAccounts);
  } else {
    console.warn('[authStore] Failed to fetch accounts from server:', accountsResult.reason);
    // Continue with whatever is cached locally
  }

  // Seed default admin if the sheet is empty
  if (remoteAccounts.length === 0 && getCachedAccounts().length === 0) {
    try {
      const account = await createAuthAccount(SEED_NAME, SEED_EMAIL, SEED_PASSWORD);

      const { getMemberByEmail, upsertMember } = await import('./roleStore');
      if (!getMemberByEmail(SEED_EMAIL)) {
        upsertMember({
          id: 'seed-admin',
          name: SEED_NAME,
          email: SEED_EMAIL,
          role: 'admin',
          status: 'active',
          createdAt: account.createdAt,
          invitedBy: '',
        });
      }
    } catch { /* admin may already exist — ignore */ }
  }

}

async function initMockMode_(): Promise<void> {
  const existing = getCachedAccounts();
  if (existing.length === 0) {
    await createAuthAccount(SEED_NAME, SEED_EMAIL, SEED_PASSWORD);

    const { getMemberByEmail, upsertMember } = await import('./roleStore');
    if (!getMemberByEmail(SEED_EMAIL)) {
      upsertMember({
        id: 'seed-admin',
        name: SEED_NAME,
        email: SEED_EMAIL,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
        invitedBy: '',
      });
    }
  }

  // Demo/offline: ensure Noemi exists for translations team testing
  const NOEMI_EMAIL = 'translations@connectmice.com';
  const NOEMI_PASSWORD = 'Noemi@CM2026!';
  if (!getAccountByEmail(NOEMI_EMAIL)) {
    await createAuthAccount('Noemi', NOEMI_EMAIL, NOEMI_PASSWORD);
    const { getMemberByEmail, upsertMember } = await import('./roleStore');
    if (!getMemberByEmail(NOEMI_EMAIL)) {
      upsertMember({
        id: 'member-noemi',
        name: 'Noemi',
        email: NOEMI_EMAIL,
        role: 'project_lead',
        status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
        invitedBy: SEED_EMAIL,
      });
    }
  }
}
