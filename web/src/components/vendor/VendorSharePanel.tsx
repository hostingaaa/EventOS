import { useCallback, useEffect, useState } from 'react';
import {
  getVendorLink,
  listVendorLinks,
  regenerateVendorLink,
  revokeVendorLink,
  vendorPortalUrl,
  type VendorLinkOptions,
} from '../../api/client';
import type { Task, VendorLink } from '../../types';
import './VendorSharePanel.css';

interface Props {
  eventCode: string;
  eventRowId: string;
  actorEmail: string;
  /** All tasks for this event, used to derive the available category list. */
  tasks: Task[];
}

interface NewLinkDraft {
  vendorCategory: string;
  vendorName: string;
  permission: 'view' | 'collaborate';
}

const emptyDraft: NewLinkDraft = {
  vendorCategory: '',
  vendorName: '',
  permission: 'view',
};

export function VendorSharePanel({ eventCode, eventRowId, actorEmail, tasks }: Props) {
  const [links, setLinks] = useState<VendorLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<NewLinkDraft | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await listVendorLinks(eventCode));
    } finally {
      setLoading(false);
    }
  }, [eventCode]);

  useEffect(() => {
    setLinks([]);
    setDraft(null);
    setCopiedId(null);
    load();
  }, [eventCode, eventRowId, load]);

  const categoriesInUse = Array.from(
    new Set(tasks.map((t) => (t.category || '').trim()).filter(Boolean)),
  ).sort();

  async function createLink(options: VendorLinkOptions) {
    setLoading(true);
    try {
      await getVendorLink(eventCode, eventRowId, actorEmail, options);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate(link: VendorLink) {
    if (!confirm('This will invalidate the existing link and create a new one. Continue?')) return;
    setLoading(true);
    try {
      await regenerateVendorLink(eventCode, eventRowId, actorEmail, {
        vendorCategory: link.vendorCategory,
        vendorName: link.vendorName,
        permission: link.permission,
        label: link.label,
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(link: VendorLink) {
    if (!confirm(`Revoke the link for ${link.label}?`)) return;
    setLoading(true);
    try {
      await revokeVendorLink(link.linkId, actorEmail);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(link: VendorLink) {
    const url = vendorPortalUrl(link.token);
    await navigator.clipboard.writeText(url);
    setCopiedId(link.linkId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleCreateDraft() {
    if (!draft) return;
    await createLink({
      vendorCategory: draft.vendorCategory || undefined,
      vendorName: draft.vendorName || undefined,
      permission: draft.permission,
    });
    setDraft(null);
  }

  const hasFullEventLink = links.some((l) => !l.vendorCategory);
  const usedCategories = new Set(
    links.filter((l) => l.vendorCategory).map((l) => l.vendorCategory),
  );

  return (
    <section className="vendor-share">
      <header className="vendor-share__head">
        <div>
          <h3>Vendor portal links · {eventCode}</h3>
          <p>
            Each link is unique to <strong>{eventCode}</strong> and the vendor scope. Scoped links
            hide tasks outside their category.
          </p>
        </div>
        <div className="vendor-share__head-actions">
          {!hasFullEventLink && (
            <button
              type="button"
              className="vendor-share__add"
              onClick={() => createLink({})}
              disabled={loading}
            >
              + Full-event link
            </button>
          )}
          <button
            type="button"
            className="vendor-share__add primary"
            onClick={() => setDraft({ ...emptyDraft })}
            disabled={loading}
          >
            + Add vendor link
          </button>
        </div>
      </header>

      {links.length === 0 && !loading && (
        <p className="vendor-share__empty">
          No vendor links yet. Add one above to give a vendor a read-only portal scoped to their
          work.
        </p>
      )}

      <ul className="vendor-share__list">
        {links.map((link) => {
          const url = vendorPortalUrl(link.token);
          return (
            <li key={link.linkId} className="vendor-share__item">
              <div className="vendor-share__item-head">
                <div>
                  <span
                    className={`vendor-share__scope ${
                      link.vendorCategory ? 'vendor-share__scope--cat' : 'vendor-share__scope--full'
                    }`}
                  >
                    {link.vendorCategory ? link.vendorCategory : 'Full event'}
                  </span>
                  {link.vendorName && (
                    <span className="vendor-share__vendor"> · {link.vendorName}</span>
                  )}
                  <span className="vendor-share__perm">
                    {link.permission === 'collaborate' ? 'Collaborator' : 'View only'}
                  </span>
                </div>
                <div className="vendor-share__item-actions">
                  <button type="button" onClick={() => handleRegenerate(link)} disabled={loading}>
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleRevoke(link)}
                    disabled={loading}
                  >
                    Revoke
                  </button>
                </div>
              </div>
              <div className="vendor-share__url">
                <input
                  type="text"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`Vendor link for ${link.label}`}
                />
                <button type="button" onClick={() => copyLink(link)} disabled={loading}>
                  {copiedId === link.linkId ? 'Copied' : 'Copy'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft && (
        <div className="modal-overlay" onClick={() => setDraft(null)} role="presentation">
          <div className="modal-card vendor-share__editor" onClick={(e) => e.stopPropagation()}>
            <h3>New vendor link for {eventCode}</h3>
            <label>
              Vendor name (optional)
              <input
                value={draft.vendorName}
                onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })}
                placeholder="e.g. ACME Audio"
                autoFocus
              />
            </label>
            <label>
              Category scope
              <select
                value={draft.vendorCategory}
                onChange={(e) => setDraft({ ...draft, vendorCategory: e.target.value })}
              >
                <option value="">Full event (all tasks)</option>
                {categoriesInUse.map((cat) => (
                  <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
                    {cat}
                    {usedCategories.has(cat) ? ' · already linked' : ''}
                  </option>
                ))}
              </select>
              <small>
                Vendors only see tasks in the chosen category. They will never see other tasks or
                files for {eventCode}.
              </small>
            </label>
            <label>
              Permission
              <select
                value={draft.permission}
                onChange={(e) =>
                  setDraft({ ...draft, permission: e.target.value as 'view' | 'collaborate' })
                }
              >
                <option value="view">View only (read-only)</option>
                <option value="collaborate">
                  Collaborator (submit rates, upload files, mark complete)
                </option>
              </select>
            </label>
            <footer>
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleCreateDraft}>
                Create link
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
