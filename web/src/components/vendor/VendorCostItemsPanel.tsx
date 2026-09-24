import { useState } from 'react';
import type { CostItem } from '../../types';
import { vendorCreateCostItem, vendorUpdateCostItem, vendorSubmitRates } from '../../api/client';
import './VendorCostItemsPanel.css';

interface Props {
  vendorToken: string;
  costItems: CostItem[];
  ratesSubmittedAt?: string;
  onCostItemAdded: (item: CostItem) => void;
  onCostItemUpdated: (item: CostItem) => void;
  onRatesSubmitted: (ratesSubmittedAt: string) => void;
}

const DEFAULT_CURRENCY = 'USD';

function emptyDraft() {
  return { description: '', quantity: '1', unitRate: '', currency: DEFAULT_CURRENCY, notes: '' };
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function isOwnSubmission(item: CostItem): boolean {
  return (item.createdBy || '').startsWith('vendor:');
}

/** Vendor-portal sibling of FinancialsPanel — no revenue/profit, category is
 * locked to the link's own scope. A vendor can freely edit a row they
 * submitted themselves; a row the team (or a generator, e.g. the AV
 * Equipment list) created is theirs to quote a rate on, but the quantity/
 * description stay under the team's control (enforced server-side; this
 * just matches the UI to it). Once the vendor clicks "Submit rates", the
 * whole list locks read-only (also enforced server-side) — they can still
 * see everything, just not change it. */
export function VendorCostItemsPanel({
  vendorToken,
  costItems,
  ratesSubmittedAt,
  onCostItemAdded,
  onCostItemUpdated,
  onRatesSubmitted,
}: Props) {
  const [draft, setDraft] = useState(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitted = !!ratesSubmittedAt;

  async function handleAdd() {
    const description = draft.description.trim();
    if (!description) return;
    setAdding(true);
    setError(null);
    try {
      const item = await vendorCreateCostItem(vendorToken, {
        description,
        quantity: parseFloat(draft.quantity) || 1,
        unitRate: parseFloat(draft.unitRate) || 0,
        currency: draft.currency.trim() || DEFAULT_CURRENCY,
        notes: draft.notes.trim() || undefined,
      });
      onCostItemAdded(item);
      setDraft(emptyDraft());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add rate');
    } finally {
      setAdding(false);
    }
  }

  async function handleFieldEdit(item: CostItem, field: 'quantity' | 'unitRate', value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setBusyItemId(item.costItemId);
    try {
      const updated = await vendorUpdateCostItem(vendorToken, item.costItemId, { [field]: num });
      onCostItemUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update rate');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleSubmit() {
    if (!confirm('Once submitted, you won’t be able to change these rates. Submit now?')) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await vendorSubmitRates(vendorToken);
      onRatesSubmitted(res.ratesSubmittedAt || new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit rates');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="vendor-costs">
      {error && <p className="vendor-costs__error">{error}</p>}

      {submitted && (
        <p className="vendor-costs__submitted">
          ✓ Rates submitted on {new Date(ratesSubmittedAt!).toLocaleString()}. They're locked and
          can no longer be edited.
        </p>
      )}

      {costItems.length === 0 && <p className="vendor-costs__empty">No rates submitted yet.</p>}
      {costItems.length > 0 && (
        <table className="vendor-costs__table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {costItems.map((item) => {
              const ownSubmission = isOwnSubmission(item);
              const busy = busyItemId === item.costItemId;
              return (
                <tr key={item.costItemId} className={busy ? 'vendor-costs__row--busy' : ''}>
                  <td>{item.description}</td>
                  <td>
                    {ownSubmission && !submitted ? (
                      <input
                        type="number"
                        className="vendor-costs__cell-input"
                        defaultValue={item.quantity}
                        onBlur={(e) => handleFieldEdit(item, 'quantity', e.target.value)}
                        disabled={busy}
                      />
                    ) : item.quantity}
                  </td>
                  <td>
                    {submitted ? (
                      item.unitRate
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        className="vendor-costs__cell-input"
                        defaultValue={item.unitRate}
                        onBlur={(e) => handleFieldEdit(item, 'unitRate', e.target.value)}
                        disabled={busy}
                      />
                    )}
                  </td>
                  <td>{formatMoney(item.total, item.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!submitted && (
        <div className="vendor-costs__add">
          <input
            placeholder="What is this for? (e.g. Wireless mic x10)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <input
            type="number"
            placeholder="Qty"
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Unit rate"
            value={draft.unitRate}
            onChange={(e) => setDraft({ ...draft, unitRate: e.target.value })}
          />
          <input
            className="vendor-costs__currency-input"
            placeholder="Currency"
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          />
          <button
            type="button"
            className="vendor-costs__add-btn"
            onClick={handleAdd}
            disabled={adding || !draft.description.trim()}
          >
            {adding ? 'Adding…' : '+ Add rate'}
          </button>
        </div>
      )}

      {!submitted && (
        <button
          type="button"
          className="vendor-costs__submit-btn"
          onClick={handleSubmit}
          disabled={submitting || costItems.length === 0}
        >
          {submitting ? 'Submitting…' : 'Submit rates'}
        </button>
      )}
    </div>
  );
}
