/**
 * Per Diem Form Generator
 *
 * Fills in the three variable amounts (M&IE daily rate, max visa allowance,
 * max ground transport) and renders a print-ready PSA Cash Disbursement form.
 *
 * Accessible at /per-diem-form  (optionally pre-filled via query params)
 */
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './PerDiemFormPage.css';

interface Amounts {
  perDiemRate: string;   // USD per day
  days: string;          // number of travel days
  maxVisa: string;       // USD cap
  maxGround: string;     // USD cap
  currency: string;      // payment currency code, e.g. EUR
  travelerName: string;
  eventName: string;
  eventCode: string;
  location: string;
  dates: string;
}

const DEFAULTS: Amounts = {
  perDiemRate: '35',
  days: '1',
  maxVisa: '250',
  maxGround: '60',
  currency: 'EUR',
  travelerName: '',
  eventName: '',
  eventCode: '',
  location: '',
  dates: '',
};

function usd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function PerDiemFormPage() {
  const [params] = useSearchParams();
  const [a, setA] = useState<Amounts>({
    perDiemRate: params.get('rate')     ?? DEFAULTS.perDiemRate,
    days:        params.get('days')     ?? DEFAULTS.days,
    maxVisa:     params.get('visa')     ?? DEFAULTS.maxVisa,
    maxGround:   params.get('ground')   ?? DEFAULTS.maxGround,
    currency:    params.get('currency') ?? DEFAULTS.currency,
    travelerName:params.get('traveler') ?? DEFAULTS.travelerName,
    eventName:   params.get('event')    ?? DEFAULTS.eventName,
    eventCode:   params.get('code')     ?? DEFAULTS.eventCode,
    location:    params.get('location') ?? DEFAULTS.location,
    dates:       params.get('dates')    ?? DEFAULTS.dates,
  });
  const [generated, setGenerated] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  function set(field: keyof Amounts) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setA((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerated(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function handlePrint() {
    window.print();
  }

  const mieTotal = (parseFloat(a.perDiemRate) || 0) * (parseInt(a.days) || 1);

  return (
    <div className="pdform-page">
      {/* ── Back link (hidden on print) ── */}
      <nav className="pdform-nav no-print">
        <Link to="/generators" className="pdform-nav__back">← Generators</Link>
        <span className="pdform-nav__title">Per Diem Form Generator</span>
      </nav>

      {/* ── Inputs panel (hidden on print) ── */}
      <aside className="pdform-inputs no-print">
        <h1>Per Diem Form Generator</h1>
        <p className="pdform-inputs__sub">
          Enter the event-specific amounts below. The PSA cash disbursement form
          will be generated and formatted for printing.
        </p>

        <form onSubmit={handleGenerate} className="pdform-inputs__form">

          <fieldset>
            <legend>Event details</legend>
            <div className="pdform-row">
              <label>
                Event code
                <input value={a.eventCode} onChange={set('eventCode')} placeholder="J000" />
              </label>
              <label>
                Event name
                <input value={a.eventName} onChange={set('eventName')} placeholder="Global Symposium" />
              </label>
            </div>
            <div className="pdform-row">
              <label>
                Location
                <input value={a.location} onChange={set('location')} placeholder="Istanbul, Turkey" />
              </label>
              <label>
                Dates
                <input value={a.dates} onChange={set('dates')} placeholder="May 4–8, 2026" />
              </label>
            </div>
            <label>
              Traveler name
              <input value={a.travelerName} onChange={set('travelerName')} placeholder="Name Surname" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Amounts &amp; allowances</legend>

            <div className="pdform-row">
              <label>
                M&amp;IE daily rate (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={a.perDiemRate}
                  onChange={set('perDiemRate')}
                  required
                />
              </label>
              <label>
                Number of days
                <input
                  type="number"
                  min="1"
                  value={a.days}
                  onChange={set('days')}
                  required
                />
              </label>
            </div>

            <div className="pdform-inputs__calc">
              M&amp;IE total: <strong>{usd(mieTotal)}</strong>
              &nbsp;·&nbsp;Paid in <strong>{a.currency || '—'}</strong>
            </div>

            <div className="pdform-row">
              <label>
                Max visa reimbursement (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={a.maxVisa}
                  onChange={set('maxVisa')}
                  required
                />
              </label>
              <label>
                Max ground transport (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={a.maxGround}
                  onChange={set('maxGround')}
                  required
                />
              </label>
            </div>

            <label>
              Payment currency
              <input
                value={a.currency}
                onChange={set('currency')}
                placeholder="EUR"
                list="currency-list"
              />
              <datalist id="currency-list">
                {['EUR', 'USD', 'GBP', 'TRY', 'MAD', 'TND', 'LKR', 'KES', 'JOD'].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </fieldset>

          <div className="pdform-inputs__actions">
            <button type="submit" className="btn-primary pdform-generate-btn">
              Generate form
            </button>
          </div>
        </form>
      </aside>

      {/* ── Generated form ── */}
      {generated && (
        <div className="pdform-output" ref={formRef}>

          {/* Print button (hidden on print) */}
          <div className="pdform-output__toolbar no-print">
            <span className="pdform-output__ready">✓ Form ready</span>
            <button type="button" className="pdform-print-btn" onClick={handlePrint}>
              🖨 Print / Save as PDF
            </button>
            <button type="button" className="pdform-edit-btn" onClick={() => setGenerated(false)}>
              ← Edit amounts
            </button>
          </div>

          {/* ── The printable form ── */}
          <div className="pdform-doc">

            <header className="pdform-doc__header">
              <h2>Cash Disbursement</h2>
              <p>
                <strong>For:</strong> {a.travelerName || 'Name Surname'}
              </p>
              <p>
                {a.eventCode && <><strong>{a.eventCode}</strong> · </>}
                {a.eventName || '[Event Name]'}
              </p>
              <p>
                {a.location || '[Location]'}: {a.dates || '[Dates]'}
              </p>
            </header>

            {/* ── M&IE ── */}
            <section className="pdform-section pdform-section--mie">
              <div className="pdfs-title">
                <strong>Meals &amp; Incidental Expenses (M&amp;IE)</strong>
              </div>
              <div className="pdfs-body">
                <p>
                  PSA Inc. shall pay M&amp;IE at the USG rate based on the traveler's itinerary.
                  If breakfast is included in the lodging rate but not complimentary, PSA shall
                  make the appropriate M&amp;IE deductions in accordance with the FTR. Reductions
                  for meals provided on all workshop days shall also be made. PSA must provide
                  M&amp;IE on the day of arrival in the country of the event.
                  Currency in which M&amp;IE shall be paid: <strong>{a.currency || 'EUR'}</strong>.
                </p>
                <p className="pdfs-calc">
                  M&amp;IE calculation according to the FTR:{' '}
                  <strong>
                    ${a.perDiemRate} USD/day × {a.days} day{parseInt(a.days) !== 1 ? 's' : ''} = {usd(mieTotal)}
                  </strong>
                </p>
                <p>M&amp;IE Total Paid in USD: <strong>{usd(mieTotal)}</strong></p>
              </div>
              <div className="pdfs-sig-row pdfs-sig-row--traveler">
                <div className="pdfs-sig-block">
                  <div className="pdfs-sig-line" />
                  <span>Received by traveler: {a.travelerName || 'Name Surname'}</span>
                  <div className="pdfs-sig-subrow">
                    <span>Signature:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                    <span>Date:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                  </div>
                </div>
                <div className="pdfs-note pdfs-note--green">
                  Signature and Date only. Do not write anything else here.
                </div>
              </div>
            </section>

            {/* ── Visa ── */}
            <section className="pdform-section pdform-section--visa">
              <div className="pdfs-title">
                <strong>VISA</strong>
              </div>
              <div className="pdfs-body">
                <p>
                  PSA Inc. shall provide reimbursement for Visa expenses with receipts,
                  up to a total of <strong>{usd(parseFloat(a.maxVisa) || 0)}</strong>.
                </p>
                <div className="pdfs-fields">
                  <div className="pdfs-field-row">
                    <span>Amount reimbursed in local currency:</span>
                    <div className="pdfs-fill-line" />
                  </div>
                  <div className="pdfs-field-row">
                    <span>Exchange rate used:</span>
                    <div className="pdfs-fill-line" />
                  </div>
                  <div className="pdfs-field-row">
                    <span>Amount reimbursed in USD: $</span>
                    <div className="pdfs-fill-line" />
                  </div>
                </div>
              </div>
              <div className="pdfs-sig-row pdfs-sig-row--lem">
                <div className="pdfs-note pdfs-note--blue">
                  Write exact amount + currency code. Sign only if amount is given to traveler.
                  {parseFloat(a.maxVisa) < 250 && (
                    <> IPS approval needed if reimbursement exceeds {usd(parseFloat(a.maxVisa) || 0)}.</>
                  )}
                  {parseFloat(a.maxVisa) >= 250 && (
                    <> IPS approval needed if any reimbursement exceeds {usd(parseFloat(a.maxVisa) || 0)}.</>
                  )}
                </div>
                <div className="pdfs-sig-block">
                  <div className="pdfs-sig-subrow">
                    <span>LEM Signature:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                    <span>Date:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Ground transport ── */}
            <section className="pdform-section pdform-section--ground">
              <div className="pdfs-title">
                <strong>Ground Transportation</strong>
              </div>
              <div className="pdfs-body">
                <p>
                  PSA Inc. shall provide reimbursement for ground transportation expenses with
                  receipts to/from the airport of the traveler's home city, up to a total of{' '}
                  <strong>{usd(parseFloat(a.maxGround) || 0)}</strong>.
                </p>
                <div className="pdfs-fields">
                  <div className="pdfs-field-row">
                    <span>Amount reimbursed in local currency:</span>
                    <div className="pdfs-fill-line" />
                  </div>
                  <div className="pdfs-field-row">
                    <span>Exchange rate used:</span>
                    <div className="pdfs-fill-line" />
                  </div>
                  <div className="pdfs-field-row">
                    <span>Amount reimbursed in USD: $</span>
                    <div className="pdfs-fill-line" />
                  </div>
                </div>
              </div>
              <div className="pdfs-sig-row pdfs-sig-row--lem">
                <div className="pdfs-note pdfs-note--blue">
                  Write exact amount + currency code. Sign only if amount is given to traveler.
                  IPS approval needed if reimbursement exceeds {usd(parseFloat(a.maxGround) || 0)}.
                </div>
                <div className="pdfs-sig-block">
                  <div className="pdfs-sig-subrow">
                    <span>LEM Signature:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                    <span>Date:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Totals & final LEM sig ── */}
            <section className="pdform-section pdform-section--total">
              <div className="pdfs-field-row pdfs-total-row">
                <strong>Total Amount Disbursed in USD:</strong>
                <span>$</span>
                <div className="pdfs-fill-line pdfs-fill-line--total" />
              </div>
              <div className="pdfs-sig-row pdfs-sig-row--lem">
                <div className="pdfs-sig-block">
                  <p>Distributed by LEM: <strong>{/* intentionally blank */}</strong></p>
                  <div className="pdfs-sig-subrow">
                    <span>Signature:</span>
                    <div className="pdfs-sig-line" />
                    <span>Date:</span>
                    <div className="pdfs-sig-line pdfs-sig-line--short" />
                  </div>
                </div>
                <div className="pdfs-note pdfs-note--blue">
                  Signature and Date only. Do not write anything else in this section.
                </div>
              </div>
            </section>

            {/* ── Colour legend ── */}
            <footer className="pdform-doc__legend">
              <span className="pdfl pdfl--green">Green = Traveler only</span>
              <span className="pdfl pdfl--blue">Blue = LEM (fund distributor)</span>
              <span className="pdfl pdfl--grey">Approval box = IPS only</span>
            </footer>
          </div>
          {/* end .pdform-doc */}
        </div>
      )}
    </div>
  );
}
