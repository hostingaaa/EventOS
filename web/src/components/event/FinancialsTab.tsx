import { useMemo, useState } from 'react';
import type { CostItem, Event } from '../../types';
import { createCostItem, deleteCostItem, updateCostItem, updateEvent } from '../../api/client';
import { computeEventFinancials } from '../../utils/financials';

interface Props {
  event: Event;
  costItems: CostItem[];
  /** Task categories already in use, offered as suggestions for a new cost line. */
  categoriesInUse: string[];
  isAdmin: boolean;
  actorEmail: string;
  onEventUpdated: (event: Event) => void;
  onCostItemAdded: (item: CostItem) => void;
  onCostItemUpdated: (item: CostItem) => void;
  onCostItemDeleted: (costItemId: string) => void;
}

const DEFAULT_CURRENCY = 'USD';
const SUGGESTED_CATEGORIES = ['AV Equipment', 'Venue', 'Catering', 'Interpretation', 'Logistics'];

function money(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function emptyDraft(category = '') {
  return { category, description: '', vendorName: '', quantity: '1', unitRate: '', currency: DEFAULT_CURRENCY };
}

export function FinancialsTab({
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
  const currencies = Object.keys(financials.totalsByCurrency);
  const unpriced = costItems.filter((c) => !c.unitRate).length;

  // Revenue is entered in USD, so a margin is only meaningful when every cost line is in USD too.
  const comparable = currencies.every((c) => c === DEFAULT_CURRENCY);
  const revenue = financials.revenue != null && !isNaN(financials.revenue) ? financials.revenue : null;
  const margin = revenue != null && comparable ? revenue - financials.totalCost : null;

  const revenueClean = revenueInput.trim() === (event.revenue ?? '').trim();

  const suggestions = Array.from(new Set([...SUGGESTED_CATEGORIES, ...categoriesInUse]));

  async function handleAdd() {
    const description = draft.description.trim();
    if (!description || !draft.category.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const item = await createCostItem({
        eventCode: event.code,
        eventRowId: event.rowId,
        category: draft.category.trim(),
        description,
        quantity: parseFloat(draft.quantity) || 1,
        unitRate: parseFloat(draft.unitRate) || 0,
        currency: draft.currency.trim().toUpperCase() || DEFAULT_CURRENCY,
        vendorName: draft.vendorName.trim() || undefined,
        createdBy: actorEmail,
      });
      onCostItemAdded(item);
      // The category sticks so a run of lines in one category is quick to enter.
      setDraft(emptyDraft(draft.category));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the cost item');
    } finally {
      setAdding(false);
    }
  }

  async function handleEdit(item: CostItem, updates: Parameters<typeof updateCostItem>[1]) {
    setBusyItemId(item.costItemId);
    setError(null);
    try {
      onCostItemUpdated(await updateCostItem(item.costItemId, updates, actorEmail));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update the cost item');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleNumber(item: CostItem, field: 'quantity' | 'unitRate', raw: string) {
    const num = parseFloat(raw);
    if (isNaN(num) || num === item[field]) return;
    await handleEdit(item, { [field]: num });
  }

  async function handleDelete(item: CostItem) {
    if (!confirm(`Remove "${item.description}"?`)) return;
    setBusyItemId(item.costItemId);
    setError(null);
    try {
      await deleteCostItem(item.costItemId, actorEmail);
      onCostItemDeleted(item.costItemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove the cost item');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleSaveRevenue() {
    if (revenueClean) return;
    setSavingRevenue(true);
    setError(null);
    try {
      onEventUpdated(await updateEvent(event.rowId, event.code, { revenue: revenueInput.trim() }, actorEmail));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the contract value');
    } finally {
      setSavingRevenue(false);
    }
  }

  const canAdd = !!draft.category.trim() && !!draft.description.trim() && !adding;

  return (
    <div className="ws-fin">
      {error && <p className="ws-panel__error">{error}</p>}

      <div className="ws-fin__cards">
        {isAdmin && (
          <div className="ws-card">
            <div className="ws-label">Revenue · contract value</div>
            <div className="ws-fin__revenue">
              <div className="ws-fin__revenue-input">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueInput}
                  placeholder="0.00"
                  aria-label="Contract value"
                  onChange={(e) => setRevenueInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSaveRevenue()}
                />
                <span>{DEFAULT_CURRENCY}</span>
              </div>
              <button type="button" className="ws-pill ws-pill--solid ws-pill--lg" onClick={() => void handleSaveRevenue()} disabled={revenueClean || savingRevenue}>
                {savingRevenue ? 'Saving…' : revenueClean && event.revenue ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <div className="ws-card">
          <div className="ws-label">Total costs</div>
          {currencies.length === 0 && <div className="ws-fin__big">{money(0, DEFAULT_CURRENCY)}</div>}
          {currencies.map((c) => (
            <div key={c} className="ws-fin__big">
              {money(financials.totalsByCurrency[c], c)}
            </div>
          ))}
          <div className="ws-fin__sub">
            {costItems.length === 0
              ? 'No cost items yet'
              : unpriced
                ? `${unpriced} of ${costItems.length} items not priced yet`
                : 'All items priced'}
          </div>
        </div>

        {isAdmin && (
          <div className="ws-card">
            <div className="ws-label">Margin</div>
            <div className={`ws-fin__big${margin == null ? ' ws-fin__big--none' : margin < 0 ? ' ws-fin__big--neg' : ' ws-fin__big--pos'}`}>
              {margin == null ? '—' : money(margin, DEFAULT_CURRENCY)}
            </div>
            <div className="ws-fin__sub">
              {revenue == null
                ? 'Enter the contract value to see margin.'
                : !comparable
                  ? 'Costs are in more than one currency, so a margin can’t be worked out.'
                  : revenue
                    ? `${Math.round(((margin ?? 0) / revenue) * 100)}% of contract value`
                    : ''}
            </div>
          </div>
        )}
      </div>

      <section className="ws-panel ws-cost">
        <div className="ws-panel__head ws-panel__head--tight">
          <h3>Cost items</h3>
          <span className="ws-panel__count">{costItems.length} {costItems.length === 1 ? 'item' : 'items'}</span>
        </div>

        <div className="ws-cost__scroll">
          <div className="ws-cost__inner">
            <div className="ws-cost__cols ws-cost__grid" aria-hidden="true">
              <span>Category</span>
              <span>Description</span>
              <span>Vendor</span>
              <span>Qty</span>
              <span>Unit rate</span>
              <span className="ws-cost__right">Total</span>
              <span />
            </div>

            {costItems.map((item) => {
              const busy = busyItemId === item.costItemId;
              return (
                <div key={item.costItemId} className={`ws-cost__row ws-cost__grid${busy ? ' is-busy' : ''}`}>
                  <span className="ws-cost__cat">{item.category}</span>
                  <span className="ws-cost__desc">{item.description}</span>
                  <input
                    key={`v-${item.costItemId}-${item.vendorName ?? ''}`}
                    className="ws-cost__vendor"
                    defaultValue={item.vendorName ?? ''}
                    placeholder="Add vendor"
                    aria-label={`Vendor for ${item.description}`}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.vendorName ?? '')) void handleEdit(item, { vendorName: v });
                    }}
                  />
                  <input
                    key={`q-${item.costItemId}-${item.quantity}`}
                    className="ws-cost__num"
                    type="number"
                    min="0"
                    defaultValue={item.quantity}
                    aria-label={`Quantity for ${item.description}`}
                    disabled={busy}
                    onBlur={(e) => void handleNumber(item, 'quantity', e.target.value)}
                  />
                  <input
                    key={`r-${item.costItemId}-${item.unitRate}`}
                    className="ws-cost__num"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={item.unitRate || ''}
                    placeholder="0.00"
                    aria-label={`Unit rate for ${item.description}`}
                    disabled={busy}
                    onBlur={(e) => void handleNumber(item, 'unitRate', e.target.value)}
                  />
                  <span className={`ws-cost__total${item.total ? '' : ' is-zero'}`}>{money(item.total || 0, item.currency || DEFAULT_CURRENCY)}</span>
                  <button type="button" className="ws-cost__remove" aria-label={`Remove ${item.description}`} disabled={busy} onClick={() => void handleDelete(item)}>
                    ✕
                  </button>
                </div>
              );
            })}

            {costItems.length === 0 && <p className="ws-panel__empty">No cost items recorded yet.</p>}

            {costItems.length > 0 && (
              <div className="ws-cost__foot">
                <span className="ws-cost__unpriced">{unpriced ? `${unpriced} ${unpriced === 1 ? 'item still needs' : 'items still need'} a unit rate` : ''}</span>
                <span className="ws-cost__foot-label">Total</span>
                <span className="ws-cost__foot-total">
                  {currencies.length ? currencies.map((c) => money(financials.totalsByCurrency[c], c)).join(' + ') : ''}
                </span>
              </div>
            )}

            <div className="ws-cost__add">
              <input
                list="ws-cost-cats"
                placeholder="Category"
                aria-label="New cost category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              <datalist id="ws-cost-cats">
                {suggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <input placeholder="Description" aria-label="New cost description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <input placeholder="Vendor (optional)" aria-label="New cost vendor" value={draft.vendorName} onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })} />
              <input type="number" min="1" placeholder="Qty" aria-label="New cost quantity" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              <input type="number" min="0" step="0.01" placeholder="Unit rate" aria-label="New cost unit rate" value={draft.unitRate} onChange={(e) => setDraft({ ...draft, unitRate: e.target.value })} />
              <input
                maxLength={3}
                placeholder="USD"
                aria-label="New cost currency"
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
              />
              <button type="button" className="ws-pill ws-pill--solid ws-pill--lg" onClick={() => void handleAdd()} disabled={!canAdd}>
                {adding ? 'Adding…' : '+ Add item'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
