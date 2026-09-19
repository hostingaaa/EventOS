import { useState, useCallback, useEffect, Fragment } from 'react';
import { useUser } from '../context/UserContext';
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LIST,
  ROLE_COLORS,
  ROLE_LABELS,
  type AppRole,
  type CapMatrix,
  type OrgMember,
  getCapMatrix,
  getMembers,
  saveCapMatrix,
  upsertMember,
} from '../utils/roleStore';
import './AdminPanelPage.css';

const ROLES: AppRole[] = ['admin', 'project_lead', 'director'];

// ── helpers ────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function newId(): string {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── sub-components ─────────────────────────────────────────────────────────

interface AddMemberModalProps {
  invitedBy: string;
  onClose: () => void;
  onSave: (m: OrgMember) => void;
}

function AddMemberModal({ invitedBy, onClose, onSave }: AddMemberModalProps) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<AppRole>('project_lead');
  const [err, setErr]     = useState('');

  function submit() {
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (!email.trim() || !email.includes('@')) { setErr('Valid email is required.'); return; }
    const all = getMembers();
    if (all.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())) {
      setErr('A member with this email already exists.'); return;
    }
    onSave({
      id: newId(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: 'invited',
      createdAt: new Date().toISOString().slice(0, 10),
      invitedBy,
    });
  }

  return (
    <div className="ap-modal-backdrop" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add new member</h3>
        <label>Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </label>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@org.com" />
        </label>
        <label>Role
          <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
        {err && <p className="ap-modal__err">{err}</p>}
        <div className="ap-modal__actions">
          <button className="ap-btn ap-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ap-btn ap-btn--primary" onClick={submit}>Add member</button>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────

export function AdminPanelPage() {
  const { user, isAdmin } = useUser();

  const [tab, setTab]             = useState<'members' | 'permissions'>('members');
  const [members, setMembers]     = useState<OrgMember[]>(() => getMembers());
  const [matrix, setMatrix]       = useState<CapMatrix>(() => getCapMatrix());
  const [showAdd, setShowAdd]     = useState(false);
  const [capSaved, setCapSaved]   = useState(false);

  // ── members tab ──────────────────────────────────────────────────────────

  const handleRoleChange = useCallback((id: string, role: AppRole) => {
    setMembers((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, role } : m);
      const changed = next.find((m) => m.id === id)!;
      upsertMember(changed);
      // Notify other tabs / UserContext
      window.dispatchEvent(new StorageEvent('storage', { key: 'org_members_v1' }));
      return next;
    });
  }, []);

  const handleStatusToggle = useCallback((id: string) => {
    setMembers((prev) => {
      const member = prev.find((m) => m.id === id)!;
      const next = member.status === 'inactive' ? 'active' : 'inactive';
      const updated = { ...member, status: next as OrgMember['status'] };
      upsertMember(updated);
      window.dispatchEvent(new StorageEvent('storage', { key: 'org_members_v1' }));
      return prev.map((m) => m.id === id ? updated : m);
    });
  }, []);

  const handleAddMember = useCallback((m: OrgMember) => {
    upsertMember(m);
    setMembers(getMembers());
    setShowAdd(false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'org_members_v1' }));
  }, []);

  // ── permissions tab ──────────────────────────────────────────────────────

  const handleToggleCap = useCallback(
    (role: AppRole, cap: (typeof CAPABILITY_LIST)[number]['key']) => {
      if (role === 'admin') return; // admin is locked
      setMatrix((prev) => {
        const next: CapMatrix = JSON.parse(JSON.stringify(prev));
        next[role][cap] = !next[role][cap];
        return next;
      });
    },
    [],
  );

  const handleSaveCaps = useCallback(() => {
    saveCapMatrix(matrix, user?.email);
    setMatrix(getCapMatrix());
    setCapSaved(true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'role_capabilities_v1' }));
    setTimeout(() => setCapSaved(false), 2500);
  }, [matrix, user?.email]);

  // Refresh matrix when opening permissions (picks up newly added capabilities).
  useEffect(() => {
    if (tab !== 'permissions') return;
    setMatrix(getCapMatrix());
  }, [tab]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'role_capabilities_v1') setMatrix(getCapMatrix());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (!isAdmin) {
    return (
      <div className="ap-denied">
        <h2>Access denied</h2>
        <p>You need Admin privileges to access this panel.</p>
      </div>
    );
  }

  // Group capabilities for the permissions tab (stable group order).
  const capGroups = CAPABILITY_GROUPS.map((group) => ({
    group,
    caps: CAPABILITY_LIST.filter((c) => c.group === group),
  })).filter((g) => g.caps.length > 0);

  const activeCount = members.filter((m) => m.status !== 'inactive').length;

  return (
    <div className="ap-page">
      <header className="ap-header">
        <div>
          <h1>Admin Panel</h1>
          <p>Manage team members, roles, and feature access.</p>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="ap-tabs">
        <button
          className={`ap-tab ${tab === 'members' ? 'ap-tab--active' : ''}`}
          onClick={() => setTab('members')}
        >
          Members
          <span className="ap-tab__badge">{activeCount}</span>
        </button>
        <button
          className={`ap-tab ${tab === 'permissions' ? 'ap-tab--active' : ''}`}
          onClick={() => setTab('permissions')}
        >
          Role Permissions
        </button>
      </div>

      {/* ── Members ── */}
      {tab === 'members' && (
        <section className="ap-section">
          <div className="ap-section__head">
            <span>{activeCount} active member{activeCount !== 1 ? 's' : ''}</span>
            <button className="ap-btn ap-btn--primary" onClick={() => setShowAdd(true)}>
              + Add member
            </button>
          </div>

          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const roleStyle = ROLE_COLORS[m.role];
                  const isSelf = m.email.toLowerCase() === user?.email?.toLowerCase();
                  return (
                    <tr key={m.id} className={m.status === 'inactive' ? 'ap-table__row--inactive' : ''}>
                      <td>
                        <div className="ap-member">
                          <span
                            className="ap-avatar"
                            style={{ background: roleStyle.bg, color: roleStyle.color }}
                          >
                            {initials(m.name)}
                          </span>
                          <div>
                            <strong>{m.name} {isSelf && <span className="ap-self">(you)</span>}</strong>
                            <small>{m.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          className="ap-role-select"
                          value={m.role}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as AppRole)}
                          style={{ borderColor: roleStyle.bg, color: roleStyle.color }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`ap-status ap-status--${m.status}`}>
                          {m.status === 'invited' ? 'Invited' : m.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="ap-date">{m.createdAt}</td>
                      <td>
                        {!isSelf && (
                          <button
                            className={`ap-btn ap-btn--sm ${m.status === 'inactive' ? 'ap-btn--ghost' : 'ap-btn--danger-ghost'}`}
                            onClick={() => handleStatusToggle(m.id)}
                          >
                            {m.status === 'inactive' ? 'Activate' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Permissions ── */}
      {tab === 'permissions' && (
        <section className="ap-section">
          <div className="ap-section__head">
            <span>Toggle which features each role can access.</span>
            <button
              className={`ap-btn ${capSaved ? 'ap-btn--success' : 'ap-btn--primary'}`}
              onClick={handleSaveCaps}
            >
              {capSaved ? '✓ Saved' : 'Save permissions'}
            </button>
          </div>

          <div className="ap-perms-wrap">
            <table className="ap-perms-table">
              <thead>
                <tr>
                  <th className="ap-perms-table__cap">Capability</th>
                  {ROLES.map((r) => {
                    const s = ROLE_COLORS[r];
                    return (
                      <th
                        key={r}
                        className="ap-perms-table__role"
                        style={{ color: s.color }}
                      >
                        {ROLE_LABELS[r]}
                        {r === 'admin' && <div className="ap-perms-table__lock">🔒 Full access</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {capGroups.map(({ group, caps }) => (
                  <Fragment key={`group-${group}`}>
                    <tr className="ap-perms-table__group">
                      <td colSpan={4}>{group}</td>
                    </tr>
                    {caps.map((cap) => (
                      <tr key={cap.key}>
                        <td className="ap-perms-table__label">
                          <span className="ap-perms-table__name">{cap.label}</span>
                          {cap.description && (
                            <span className="ap-perms-table__desc">{cap.description}</span>
                          )}
                        </td>
                        {ROLES.map((r) => {
                          const locked = r === 'admin' || cap.adminLocked;
                          const checked = r === 'admin' ? true : (matrix[r][cap.key] ?? false);
                          return (
                            <td key={r} className="ap-perms-table__cell">
                              <label className={`ap-toggle ${locked ? 'ap-toggle--locked' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked}
                                  onChange={() => handleToggleCap(r, cap.key)}
                                />
                                <span className="ap-toggle__track" />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <p className="ap-perms-note">
            Changes take effect immediately for active sessions after saving.
          </p>
        </section>
      )}

      {showAdd && (
        <AddMemberModal
          invitedBy={user?.email ?? 'admin'}
          onClose={() => setShowAdd(false)}
          onSave={handleAddMember}
        />
      )}
    </div>
  );
}
