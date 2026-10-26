import { useCallback, useEffect, useState } from 'react';
import { getVendorLink, listVendorLinks, regenerateVendorLink, revokeVendorLink, type VendorLinkOptions } from '../../api/client';
import type { VendorLink } from '../../types';

/** The event's active vendor-portal links plus the create / regenerate / revoke actions on them. */
export function useVendorLinks(eventCode: string, eventRowId: string, actorEmail: string) {
  const [loaded, setLoaded] = useState<{ eventCode: string; links: VendorLink[] }>({ eventCode: '', links: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVendorLinks(eventCode)
      .then((links) => {
        if (!cancelled) setLoaded({ eventCode, links });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ eventCode, links: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [eventCode, eventRowId]);

  // Never show another event's links while this event's are still loading.
  const links = loaded.eventCode === eventCode ? loaded.links : [];

  const reload = useCallback(async () => {
    const next = await listVendorLinks(eventCode);
    setLoaded({ eventCode, links: next });
  }, [eventCode]);

  /** Runs a link action, keeping `busy`/`error` in sync; rethrows so a dialog can show its own message. */
  const run = useCallback(
    async (action: () => Promise<unknown>, fallback: string) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : fallback);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const create = useCallback(
    (options: VendorLinkOptions) => run(() => getVendorLink(eventCode, eventRowId, actorEmail, options), 'Failed to create the vendor link'),
    [run, eventCode, eventRowId, actorEmail],
  );

  const regenerate = useCallback(
    (link: VendorLink) =>
      run(
        () =>
          regenerateVendorLink(eventCode, eventRowId, actorEmail, {
            vendorCategory: link.vendorCategory,
            vendorName: link.vendorName,
            permission: link.permission,
            label: link.label,
          }),
        'Failed to regenerate the link',
      ),
    [run, eventCode, eventRowId, actorEmail],
  );

  const revoke = useCallback(
    (link: VendorLink) => run(() => revokeVendorLink(link.linkId, actorEmail), 'Failed to revoke the link'),
    [run, actorEmail],
  );

  return { links, busy, error, clearError: () => setError(null), create, regenerate, revoke };
}
