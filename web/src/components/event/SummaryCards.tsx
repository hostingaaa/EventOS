import type { Task, VendorLink } from '../../types';
import { doneCount, readinessPct } from './taskStats';
import { needsOwner } from '../../utils/taskView';
import { CityNowCard } from './CityNowCard';
import './SummaryCards.css';

interface Props {
  tasks: Task[];
  location: string;
  links: VendorLink[];
  /** Whether the viewer may create vendor links. */
  canShare: boolean;
  /** Label of the selected task's category, used to scope the "+ Vendor link" button. */
  selectedCategoryLabel: string | null;
  onShowUnassigned: () => void;
  onNewVendorLink: () => void;
  onFullEventLink: () => void;
  onViewLinks: () => void;
  linkBusy: boolean;
  hasFullEventLink: boolean;
}

/** The four summary cards under the event header: readiness, city now, unassigned, vendor portal. */
export function SummaryCards({
  tasks,
  location,
  links,
  canShare,
  selectedCategoryLabel,
  onShowUnassigned,
  onNewVendorLink,
  onFullEventLink,
  onViewLinks,
  linkBusy,
  hasFullEventLink,
}: Props) {
  const total = tasks.length;
  const done = doneCount(tasks);
  const pct = readinessPct(tasks);
  const unassigned = tasks.filter(needsOwner).length;

  return (
    <div className="ws-summary">
      <div className="ws-card">
        <div className="ws-label">Readiness</div>
        <div className="ws-readiness">
          <span className="ws-readiness__pct">{pct}%</span>
          <span className="ws-readiness__sub">{done} of {total} tasks done</span>
        </div>
        <div className="ws-bar">
          <div className="ws-bar__fill" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      </div>

      <CityNowCard location={location} />

      <div className="ws-card">
        <div className="ws-label">Unassigned</div>
        <div className="ws-readiness">
          <span className="ws-readiness__count">{unassigned}</span>
          <span className="ws-readiness__sub">{unassigned === 1 ? 'task needs an owner' : 'tasks need an owner'}</span>
        </div>
        {unassigned > 0 && (
          <button type="button" className="ws-link-btn" onClick={onShowUnassigned}>
            Show them →
          </button>
        )}
      </div>

      <div className="ws-card">
        <div className="ws-label">Vendor portal</div>
        <div className="ws-vendor__title">
          {links.length ? `${links.length} active link${links.length > 1 ? 's' : ''}` : 'No links yet'}
        </div>
        <div className="ws-vendor__help">Read-only links, scoped to one category or the full event.</div>
        <div className="ws-vendor__actions">
          {canShare && (
            <>
              <button
                type="button"
                className="ws-pill ws-pill--solid"
                onClick={onNewVendorLink}
                disabled={linkBusy}
                title={selectedCategoryLabel ? `Scoped to ${selectedCategoryLabel}` : 'Create a vendor link'}
              >
                + Vendor link
              </button>
              {!hasFullEventLink && (
                <button type="button" className="ws-pill ws-pill--outline" onClick={onFullEventLink} disabled={linkBusy}>
                  Full-event link
                </button>
              )}
            </>
          )}
          {links.length > 0 && (
            <button type="button" className="ws-link-btn" onClick={onViewLinks}>
              View links →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
