import { useMemo, useState } from 'react';
import type { CostItem, Event } from '../types';
import { createCostItem, deleteCostItem, updateCostItem, updateEvent } from '../api/client';
import { computeEventFinancials } from '../utils/financials';
import './FinancialsPanel.css';

interface Props {
  event: Event;
  costItems: CostItem[];
  categoriesInUse: string[];
  isAdmin: boolean;
  actorEmail: string;
  onEventUpdated: (event: Event) => void;
  onCostItemAdded: (item: CostItem) => void;
  onCostItemUpdated: (item: CostItem) => void;
  onCostItemDeleted: (costItemId: string) => void;
}

const DEFAULT_CURRENCY = 'USD';

function emptyDraft() {
  return { category: '', description: '', quantity: '1', unitRate: '', currency: DEFAULT_CURRENCY, vendorName: '', notes: '' };
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function FinancialsPanel({
  event,
  costItems,
  categoriesInUse,
  isAdmin,
  actorEmail,
  onEventUpdated,
  onCostItemAdded,
  onCostItemUpdated,
  onCostItemDeleted,
}: Props) {
  const [draft, setDraft] = useState(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revenueInput, setRevenueInput] = useState(event.revenue ?? '');
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const financials = useMemo(() => computeEventFinancials(event, costItems), [event, costItems]);
  const currencyEntries = Object.entries(financials.totalsByCurrency);

  async function handleAdd() {
    const description = draft.description.trim();
    if (!description) return;
    setAdding(true);
    setError(null);
    try {
      const item = await createCostItem({
        eventCode: event.code,
        eventRowId: event.rowId,
        category: draft.category.trim() || 'General',
        description,
        quantity: parseFloat(draft.quantity) || 1,
        unitRate: parseFloat(draft.unitRate) || 0,
        currency: draft.currency.trim() || DEFAULT_CURRENCY,
        vendorName: draft.vendorName.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        createdBy: actorEmail,
      });
      onCostItemAdded(item);
      setDraft(emptyDraft());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add cost item');
    } finally {
      setAdding(false);
    }
  }

  async function handleFieldEdit(item: CostItem, field: 'quantity' | 'unitRate', value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setBusyItemId(item.costItemId);
    try {
      const updated = await updateCostItem(item.costItemId, { [field]: num }, actorEmail);
      onCostItemUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update cost item');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleDelete(item: CostItem) {
    if (!confirm(`Remove "${item.description}"?`)) return;
    setBusyItemId(item.costItemId);
    try {
      await deleteCostItem(item.costItemId, actorEmail);
      onCostItemDeleted(item.costItemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove cost item');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleSaveRevenue() {
    setSavingRevenue(true);
    setError(null);
    try {
      const updated = await updateEvent(event.rowId, event.code, { revenue: revenueInput.trim() }, actorEmail);
      onEventUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update revenue');
    } finally {
      setSavingRevenue(false);
    }
  }

  return (
    <div className="financials">
      {error && <p className="financials__error">{error}</p>}

      {isAdmin && (
        <section className="financials__revenue">
          <h3>Revenue</h3>
          <div className="financials__revenue-row">
            <input
              type="number"
              step="0.01"
              placeholder="Contract value"
              value={revenueInput}
              onChange={(e) => setRevenueInput(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={handleSaveRevenue} disabled={savingRevenue}>
              {savingRevenue ? 'Saving…' : 'Save'}
            </button>
          </div>
          {financials.profit != null && (
            <p className={`financials__profit${financials.profit < 0 ? ' financials__profit--negative' : ''}`}>
              Profit: {formatMoney(financials.profit, DEFAULT_CURRENCY)}
            </p>
          )}
        </section>
      )}

      <section className="financials__items">
        <h3>Cost items</h3>
        {costItems.length === 0 && <p className="financials__empty">No cost items recorded yet.</p>}
        {costItems.length > 0 && (
          <table className="financials__table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Qty</th>
                <th>Unit rate</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {costItems.map((item) => (
                <tr key={item.costItemId} className={busyItemId === item.costItemId ? 'financials__row--busy' : ''}>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td>{item.vendorName || '—'}</td>
                  <td>
                    <input
                      type="number"
                      className="financials__cell-input"
                      defaultValue={item.quantity}
                      onBlur={(e) => handleFieldEdit(item, 'quantity', e.target.value)}
                      disabled={busyItemId === item.costItemId}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="financials__cell-input"
                      defaultValue={item.unitRate}
                      onBlur={(e) => handleFieldEdit(item, 'unitRate', e.target.value)}
                      disabled={busyItemId === item.costItemId}
                    />
                  </td>
                  <td>{formatMoney(item.total, item.currency)}</td>
                  <td>
                    <button
                      type="button"
                      className="financials__delete-btn"
                      onClick={() => handleDelete(item)}
                      disabled={busyItemId === item.costItemId}
                      title="Remove cost item"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {currencyEntries.length > 0 && (
          <div className="financials__totals">
            {currencyEntries.map(([currency, amount]) => (
              <span key={currency} className="financials__total-chip">
                Total: {formatMoney(amount, currency)}
              </span>
            ))}
          </div>
        )}

        <div className="financials__add">
          <input
            list="financials-categories"
            placeholder="Category"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
          <datalist id="financials-categories">
            {categoriesInUse.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <input
            placeholder="Vendor (optional)"
            value={draft.vendorName}
            onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })}
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
            className="financials__currency-input"
            placeholder="Currency"
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleAdd}
            disabled={adding || !draft.description.trim()}
          >
            {adding ? 'Adding…' : '+ Add cost item'}
          </button>
        </div>
      </section>
    </div>
  );
}
