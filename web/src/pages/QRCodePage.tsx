/**
 * QR Code Generator
 *
 * Turns any link — typically a registration form URL — into a scannable QR
 * code participants can point their phone camera at to open it. Purely
 * client-side (the `qrcode` library encodes locally; nothing is sent to a
 * third party), matching this app's other generators.
 *
 * Route: /qr-code
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { fetchEvents } from '../api/client';
import type { Event } from '../types';
import './QRCodePage.css';

const SIZES = [
  { label: 'Small (400px)', value: 400 },
  { label: 'Medium (600px)', value: 600 },
  { label: 'Large (1000px)', value: 1000 },
];

/** Adds a scheme if the admin typed a bare domain, so the QR always encodes
 * a real openable URL instead of something that resolves relative to
 * whatever page happens to scan it. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function filenameSlug(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'qr-code';
}

export function QRCodePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventCode, setEventCode] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [size, setSize] = useState(600);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchEvents()
      .then((res) => setEvents(res.events))
      .catch(() => {});
  }, []);

  function pickEvent(code: string) {
    setEventCode(code);
    if (code) setLabel(`${code} — Registration`);
  }

  const normalized = normalizeUrl(url);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    if (!normalized || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, normalized, { width: size, margin: 2, errorCorrectionLevel: 'M' })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to generate QR code');
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, size]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${filenameSlug(label || eventCode || 'qr-code')}.png`;
    a.click();
  }

  async function downloadSvg() {
    if (!normalized || !ready) return;
    try {
      const svg = await QRCode.toString(normalized, { type: 'svg', width: size, margin: 2, errorCorrectionLevel: 'M' });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${filenameSlug(label || eventCode || 'qr-code')}.svg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate SVG');
    }
  }

  return (
    <div className="qr-page">
      <nav className="qr-nav">
        <Link to="/generators" className="qr-nav__back">← Generators</Link>
        <span className="qr-nav__title">QR Code Generator</span>
      </nav>

      <div className="qr-body">
        <aside className="qr-panel qr-panel--left">
          <section className="qr-section">
            <h3 className="qr-section__title">Link</h3>

            {events.length > 0 && (
              <label className="qr-label">
                Event (optional — fills in a label)
                <select className="qr-select" value={eventCode} onChange={(e) => pickEvent(e.target.value)}>
                  <option value="">— none —</option>
                  {events.map((ev) => (
                    <option key={ev.code} value={ev.code}>
                      {ev.code} — {ev.location}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="qr-label">
              Registration link
              <input
                className="qr-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://forms.gle/..."
                autoFocus
              />
            </label>

            <label className="qr-label">
              Label (optional, shown under the preview)
              <input
                className="qr-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. J334 — Registration"
              />
            </label>

            <label className="qr-label">
              Size
              <select className="qr-select" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                {SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </section>

          {error && <p className="qr-error">{error}</p>}

          <section className="qr-section qr-section--actions">
            <button type="button" className="qr-btn qr-btn--primary" onClick={downloadPng} disabled={!ready}>
              ↓ Download PNG
            </button>
            <button type="button" className="qr-btn qr-btn--secondary" onClick={downloadSvg} disabled={!ready}>
              ↓ Download SVG
            </button>
          </section>
        </aside>

        <div className="qr-panel qr-panel--preview">
          {!normalized ? (
            <p className="qr-preview__empty">Enter a link to generate a QR code.</p>
          ) : (
            <div className="qr-preview__frame">
              <canvas ref={canvasRef} className="qr-preview__canvas" />
              {label && <p className="qr-preview__label">{label}</p>}
              <p className="qr-preview__url">{normalized}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
