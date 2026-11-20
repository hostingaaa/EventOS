/**
 * Generators — pick an event once, then see every document generator for it: the file name it produces,
 * whether it has been exported (or is a draft), and a button straight into the generator with the event set.
 * Design handoff: generators-page.html.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEventActivity, fetchEvents, peekEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import { GENERATORS } from '../components/generators/generatorDefs';
import { GeneratorIcon } from '../components/generators/GeneratorIcon';
import { cityOfLocation } from '../utils/countries';
import { generatorEventLabel, generatorEventOptions } from '../utils/generatorEvents';
import {
  type DocGeneratorId,
  type GeneratorState,
  defaultFileNames,
  eventPhase,
  formatAgo,
  generatorHref,
  generatorStatuses,
} from '../utils/generatorStatus';
import type { ActivityItem, Event } from '../types';
import './GeneratorsPage.css';

const ACTIVITY_FRESH_MS = 30_000;

const DOCS = GENERATORS.filter((g) => !g.tool) as (typeof GENERATORS[number] & { id: DocGeneratorId })[];
const LABEL: Record<GeneratorState | 'tool', string> = { done: 'Exported', draft: 'Draft', none: 'Not started', tool: 'Tool' };
const CTA: Record<GeneratorState | 'tool', string> = { done: 'Re-export', draft: 'Continue', none: 'Start', tool: 'Create' };

// Activity per event, kept for the session so switching back and forth doesn't refetch every time.
const activityCache = new Map<string, { items: ActivityItem[]; at: number }>();

export function GeneratorsPage() {
  const { user } = useUser();
  const actorEmail = user?.email ?? '';
  const [sp, setSp] = useSearchParams();
  const [events, setEvents] = useState<Event[]>(() => peekEvents()?.events ?? []);
  const [loadingEvents, setLoadingEvents] = useState(() => peekEvents() === null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ code: string; items: ActivityItem[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((res) => {
        if (!cancelled) setEvents(res.events ?? []);
      })
      .catch((e) => {
        if (!cancelled) setEventsError(e instanceof Error ? e.message : 'Could not load events');
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const urlCode = sp.get('code');
  const options = useMemo(() => generatorEventOptions(events, urlCode), [events, urlCode]);
  const ev = options.find((e) => e.code === urlCode) ?? options[0] ?? null;
  const code = ev?.code ?? '';

  // Export history for the selected event (from the activity log).
  useEffect(() => {
    if (!code) return;
    const cached = activityCache.get(code);
    if (cached && Date.now() - cached.at < ACTIVITY_FRESH_MS) return;
    let cancelled = false;
    fetchEventActivity(code, actorEmail)
      .then((items) => {
        activityCache.set(code, { items, at: Date.now() });
        if (!cancelled) setActivity({ code, items });
      })
      .catch(() => {
        // Statuses then come from this browser's saved copies only.
      });
    return () => {
      cancelled = true;
    };
  }, [code, actorEmail]);

  const activityItems = activity?.code === code ? activity.items : (activityCache.get(code)?.items ?? null);
  const checking = !!code && activityItems === null;
  const statuses = useMemo(() => (ev ? generatorStatuses(ev, activityItems) : null), [ev, activityItems]);
  const fileNames = useMemo(() => (ev ? defaultFileNames(ev) : null), [ev]);
  const phase = ev ? eventPhase(ev) : null;
  const ready = statuses ? DOCS.filter((g) => statuses[g.id].state === 'done').length : 0;

  function selectEvent(next: string) {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      p.set('code', next);
      return p;
    }, { replace: true });
  }

  async function copyName(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 1600);
  }

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  return (
    <div className="gx">
      <div className="gx-title-row">
        <div className="gx-intro">
          <h1>Generators</h1>
          <p>Build and export event documents. Pick the event once — names and templates fill in.</p>
        </div>

        <section className="gx-event-bar" aria-label="Event context">
          <label htmlFor="gx-event">Event</label>
          <select
            id="gx-event"
            value={code}
            onChange={(e) => selectEvent(e.target.value)}
            disabled={options.length === 0}
          >
            {options.length === 0 && <option value="">{loadingEvents ? 'Loading events…' : 'No events'}</option>}
            {options.map((o) => (
              <option key={o.rowId || o.code} value={o.code}>
                {generatorEventLabel(o)}
              </option>
            ))}
          </select>
          <div className="gx-progress">
            <div className="gx-progress__head">
              <span>
                <strong>{ready}/{DOCS.length}</strong> <span className="gx-muted">exported</span>
              </span>
              <span className="gx-muted">{checking ? 'Checking…' : phase?.label}</span>
            </div>
            <div
              className="gx-segments"
              role="img"
              aria-label={ev ? `${ready} of ${DOCS.length} documents exported for ${ev.code}` : 'No event selected'}
            >
              {DOCS.map((g) => {
                const s = statuses?.[g.id].state ?? 'none';
                return <div key={g.id} className={`gx-seg gx-seg--${s}`} title={`${g.title}: ${LABEL[s]}`} />;
              })}
            </div>
          </div>
        </section>
      </div>

      {eventsError && options.length === 0 && <p className="gx-msg">{eventsError}</p>}

      {ev && statuses && fileNames && (
        <div className="gx-grid">
          {GENERATORS.map((g) => {
            const st = g.tool ? null : statuses[g.id as DocGeneratorId];
            const s: GeneratorState | 'tool' = st ? st.state : 'tool';
            const file = st ? st.fileName : fileNames[g.id];
            const href = generatorHref(g.id, ev);
            const when = formatAgo(st?.at);
            const by = st?.by ? ` · ${st.by}` : '';
            const meta =
              s === 'done' ? `${when}${by}` : s === 'draft' ? `Draft ${when}${by}` : s === 'tool' ? 'Any link' : `Nothing yet for ${ev.code}`;
            const city = cityOfLocation(ev.location ?? '');
            return (
              <article key={g.id} className="gx-card">
                <div className="gx-card__head">
                  <div className="gx-icon" aria-hidden="true" style={{ background: g.tint, borderColor: g.border, color: g.color }}>
                    <GeneratorIcon id={g.id} />
                  </div>
                  <div className="gx-card__title">
                    <h2>{g.title}</h2>
                    <div className="gx-card__meta">
                      <span>{g.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="gx-fmt">{g.format}</span>
                    </div>
                  </div>
                  <span className={`gx-chip gx-chip--${s}`}>{LABEL[s]}</span>
                </div>
                <p className="gx-desc" title={g.description}>{g.description}</p>
                <p className="gx-tags">{g.tags}</p>
                <div className="gx-file">
                  <span title={file}>{file}</span>
                  <button type="button" onClick={() => copyName(g.id, file)} aria-label={`Copy file name ${file}`}>
                    {copied === g.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="gx-card__foot">
                  <span className="gx-status" title={meta}>{meta}</span>
                  {s === 'done' && st?.fileUrl && (
                    <a className="gx-btn gx-btn--secondary" href={st.fileUrl} target="_blank" rel="noreferrer" aria-label={`Download ${file} from Google Drive`}>
                      Download
                    </a>
                  )}
                  {s === 'done' && !st?.fileUrl && ev.driveFolderUrl && g.id !== 'perdiem' && (
                    <a className="gx-btn gx-btn--secondary" href={ev.driveFolderUrl} target="_blank" rel="noreferrer" aria-label={`Open the ${ev.code} Google Drive folder`}>
                      Drive
                    </a>
                  )}
                  <Link className="gx-btn gx-btn--primary" to={href} aria-label={`${CTA[s]}: ${g.title} for ${ev.code} ${city}`}>
                    {CTA[s]} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
