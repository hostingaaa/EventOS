import { useState } from 'react';
import { vendorPortalUrl } from '../../api/client';
import type { VendorLink } from '../../types';
import { actorName, formatLogTime } from '../../utils/activityText';
import { categoryDotFor, categoryLabel } from '../../utils/taskView';

interface Props {
  eventCode: string;
  links: VendorLink[];
  busy: boolean;
  error: string | null;
  /** Whether the viewer may create, regenerate or revoke links. */
  canManage: boolean;
  hasFullEventLink: boolean;
  onNewVendorLink: () => void;
  onFullEventLink: () => void;
  onRegenerate: (link: VendorLink) => void;
  onRevoke: (link: VendorLink) => void;
}

export function LinksTab({
  eventCode,
  links,
  busy,
  error,
  canManage,
  hasFullEventLink,
  onNewVendorLink,
  onFullEventLink,
  onRegenerate,
  onRevoke,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(link: VendorLink) {
    try {
      await navigator.clipboard.writeText(vendorPortalUrl(link.token));
    } catch {
      // Clipboard can be blocked (insecure context / permissions); the URL stays selectable in the row.
    }
    setCopiedId(link.linkId);
    setTimeout(() => setCopiedId((id) => (id === link.linkId ? null : id)), 1600);
  }

  return (
    <section className="ws-panel ws-links">
      <div className="ws-panel__head">
        <div>
          <h3>Active vendor links</h3>
          <p>
            Each link opens a portal for {eventCode}. Scoped links hide tasks outside their category; view-only links can&rsquo;t
            change anything.
          </p>
        </div>
        {canManage && (
          <div className="ws-panel__actions">
            <button type="button" className="ws-pill ws-pill--solid ws-pill--lg" onClick={onNewVendorLink} disabled={busy}>
              + Vendor link
            </button>
            {!hasFullEventLink && (
              <button type="button" className="ws-pill ws-pill--outline ws-pill--lg" onClick={onFullEventLink} disabled={busy}>
                Full-event link
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="ws-panel__error">{error}</p>}

      {links.length > 0 && (
        <div className="ws-links__table">
          <div className="ws-links__cols" aria-hidden="true">
            <span>Scope</span>
            <span>Link</span>
            <span>Created</span>
            <span />
          </div>
          {links.map((link) => {
            const url = vendorPortalUrl(link.token);
            const scope = categoryLabel(link.vendorCategory || '');
            const copied = copiedId === link.linkId;
            return (
              <div key={link.linkId} className="ws-links__row">
                <div className="ws-links__scope">
                  <span className="ws-dot" style={{ background: link.vendorCategory ? categoryDotFor(link.vendorCategory) : 'var(--eo-accent)' }} />
                  <div className="ws-links__scope-text">
                    <strong>{scope}</strong>
                    <small>
                      {link.vendorName ? `${link.vendorName} · ` : ''}
                      {link.permission === 'collaborate' ? 'Collaborator' : 'View only'}
                    </small>
                  </div>
                </div>
                <a className="ws-links__url" href={url} target="_blank" rel="noreferrer" title={url}>
                  {url}
                </a>
                <span className="ws-links__created">
                  {formatLogTime(link.createdAt)}
                  {link.createdBy ? ` · ${actorName(link.createdBy)}` : ''}
                </span>
                <div className="ws-links__actions">
                  <button type="button" className={`ws-pill ws-pill--soft${copied ? ' is-copied' : ''}`} onClick={() => void copy(link)}>
                    {copied ? 'Copied ✓' : 'Copy link'}
                  </button>
                  {canManage && (
                    <>
                      <button type="button" className="ws-pill ws-pill--ghost" onClick={() => onRegenerate(link)} disabled={busy} title="Invalidate this link and issue a new one">
                        Regenerate
                      </button>
                      <button type="button" className="ws-pill ws-pill--danger" onClick={() => onRevoke(link)} disabled={busy}>
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {links.length === 0 && (
        <p className="ws-panel__empty">
          No active links.{canManage ? ' Create one above to give a vendor access to their part of this event.' : ''}
        </p>
      )}
    </section>
  );
}
