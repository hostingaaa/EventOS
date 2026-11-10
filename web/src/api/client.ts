import type {
  CityLive,
  Comment,
  CostItem,
  Event,
  EventHealth,
  EventsResponse,
  EventUpdates,
  ReportData,
  Task,
  TaskFile,
  TaskStatus,
  TaskTemplate,
  TaskTemplateWithFiles,
  TeamOverview,
  TemplateFile,
  VendorLink,
  VendorWorkspaceData,
  WorkspaceData,
} from '../types';
import type { AuthAccount } from '../utils/authStore';
import type { CapMatrix, OrgMember } from '../utils/roleStore';
import { computeEventHealth } from '../utils/health';
import { clearPersisted, readPersisted, writePersisted, type Stamped } from './cache';

const API_URL = import.meta.env.VITE_API_URL || '';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';
const USE_PROXY = import.meta.env.VITE_USE_PROXY === 'true';

export function useMockData(): boolean {
  return !API_URL || import.meta.env.VITE_USE_MOCK === 'true';
}

function apiBase(): string {
  if (USE_PROXY) return '/api/proxy';
  return API_URL;
}

function buildUrl(action: string, params?: Record<string, string>) {
  if (USE_PROXY) {
    const q = new URLSearchParams({ action, ...params });
    return `${apiBase()}?${q.toString()}`;
  }
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('token', API_TOKEN);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

function throwIfApiError(data: unknown): void {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: string }).error;
    if (msg) throw new Error(msg);
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!res.ok) throw new Error(data.error || res.statusText);
    throwIfApiError(data);
    return data;
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
    if (text.includes('doGet') || text.includes('doPost')) {
      throw new Error(
        'Apps Script web app is not deployed correctly. In the script editor: Deploy → Manage deployments → EventOS API → New version → Deploy.',
      );
    }
    throw new Error(`API returned non-JSON (${res.status}). ${snippet}`);
  }
}

const PAYLOAD_GET_LIMIT = 6000;

function networkErrorMessage(err: unknown): string {
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('networkerror')) {
      return (
        'Could not reach the Google Apps Script API. Reading events works over GET, but creating events ' +
        'requires a backend update: redeploy Apps Script (Api.gs) from this repo, then hard-refresh the site. ' +
        'For local dev, use npm run dev with VITE_USE_PROXY=true in .env.local.'
      );
    }
  }
  return err instanceof Error ? err.message : 'Request failed';
}

async function post<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const fullBody = { action, token: API_TOKEN, ...body };
  const payloadJson = JSON.stringify(fullBody);

  try {
    if (USE_PROXY) {
      const url = `/api/proxy?action=${action}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadJson,
      });
      return parseJson<T>(res);
    }

    // Static hosts (GitHub Pages): browser POST to script.google.com fails CORS/redirect.
    // Send small writes as GET ?payload=… when Apps Script accepts it.
    if (payloadJson.length <= PAYLOAD_GET_LIMIT) {
      const url = buildUrl(action, { payload: payloadJson });
      return parseJson<T>(await fetch(url));
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payloadJson,
    });
    return parseJson<T>(res);
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

// ——— Events ———

// ——— Read caching ———
// Every Apps Script call costs seconds, so reads are shared and remembered: the events list is reused
// for a minute across pages (and across reloads, as a stale-while-revalidate copy), and the dashboard
// fetches its two datasets side by side instead of one after the other.

const EVENTS_FRESH_MS = 60_000;
const WORKSPACE_FRESH_MS = 30_000;

let eventsMem: Stamped<EventsResponse> | null = null;
let eventsInflight: Promise<EventsResponse> | null = null;
/** Bumped by every write so a read that started before it can't repopulate the cache with old data. */
let eventsGen = 0;

/** The last events list we know about (memory, then localStorage) — possibly stale. Never hits the network. */
export function peekEvents(): EventsResponse | null {
  if (useMockData()) return null;
  if (!eventsMem) eventsMem = readPersisted<EventsResponse>('events');
  return eventsMem?.value ?? null;
}

/** Marks the cached events list stale after a write, so the next read goes to the server. */
export function invalidateEvents(): void {
  eventsGen += 1;
  eventsInflight = null;
  if (eventsMem) eventsMem = { ...eventsMem, at: 0 };
}

/** Forgets everything cached from the server (called on sign-out / account switch). */
export function clearApiCaches(): void {
  eventsGen += 1;
  eventsMem = null;
  eventsInflight = null;
  healthMem = null;
  healthInflight = null;
  workspaceMem.clear();
  workspaceInflight.clear();
  clearPersisted();
}

/**
 * The events list. Served from memory when it was fetched in the last minute; concurrent callers share
 * one request. Pass `force` for an explicit refresh.
 */
export async function fetchEvents(opts?: { force?: boolean }): Promise<EventsResponse> {
  if (useMockData()) {
    const { mockEventsResponse } = await import('../data/mockEvents');
    return mockEventsResponse;
  }
  if (!opts?.force) {
    if (!eventsMem) eventsMem = readPersisted<EventsResponse>('events');
    if (eventsMem && Date.now() - eventsMem.at < EVENTS_FRESH_MS) return eventsMem.value;
    if (eventsInflight) return eventsInflight;
  }
  const gen = eventsGen;
  const request: Promise<EventsResponse> = (async () => {
    const data = await parseJson<EventsResponse>(await fetch(buildUrl('list')));
    const result: EventsResponse = {
      months: Array.isArray(data.months) ? data.months : [],
      events: Array.isArray(data.events) ? data.events : [],
    };
    if (gen === eventsGen) {
      eventsMem = { value: result, at: Date.now() };
      writePersisted('events', eventsMem);
    }
    return result;
  })().finally(() => {
    if (eventsInflight === request) eventsInflight = null;
  });
  eventsInflight = request;
  return request;
}

/** Raw bulk data behind the dashboard's per-event health. */
export interface DashboardHealthData {
  tasksByEvent: Record<string, Pick<Task, 'status' | 'dueDate'>[]>;
  fileCountByEvent: Record<string, number>;
}

let healthMem: Stamped<DashboardHealthData> | null = null;
let healthInflight: Promise<DashboardHealthData | null> | null = null;

function buildHealthMap(events: Event[], raw: DashboardHealthData): Record<string, EventHealth> {
  const map: Record<string, EventHealth> = {};
  events.forEach((ev) => {
    const tasks = (raw.tasksByEvent?.[ev.code] || []) as unknown as Task[];
    const fileCount = raw.fileCountByEvent?.[ev.code] || 0;
    map[ev.code] = computeEventHealth(ev, tasks, new Array(fileCount) as TaskFile[]);
  });
  return map;
}

/** Last-known dashboard health for these events (stale is fine — it is refreshed right after). */
export function peekDashboardHealth(events: Event[]): Record<string, EventHealth> {
  if (useMockData()) return {};
  if (!healthMem) healthMem = readPersisted<DashboardHealthData>('dashboardHealth');
  return healthMem ? buildHealthMap(events, healthMem.value) : {};
}

/**
 * Starts the bulk health request without waiting for the events list, so the two run side by side.
 * Resolves to null when the request fails (health is decoration; the dashboard still works without it).
 */
export function startDashboardHealth(): Promise<DashboardHealthData | null> {
  if (useMockData()) return Promise.resolve(null);
  if (healthInflight) return healthInflight;
  const request: Promise<DashboardHealthData | null> = fetch(buildUrl('dashboardHealth'))
    .then((res) => parseJson<DashboardHealthData>(res))
    .then((raw) => {
      const value: DashboardHealthData = {
        tasksByEvent: raw.tasksByEvent ?? {},
        fileCountByEvent: raw.fileCountByEvent ?? {},
      };
      healthMem = { value, at: Date.now() };
      writePersisted('dashboardHealth', healthMem);
      return value;
    })
    .catch(() => null)
    .finally(() => {
      if (healthInflight === request) healthInflight = null;
    });
  healthInflight = request;
  return request;
}

/**
 * Returns per-event health summaries for the dashboard. In mock mode this
 * pulls task/file data from the local store; in real mode it uses the
 * `dashboardHealth` endpoint (pass `prefetched` from `startDashboardHealth()`
 * to avoid waiting for the events list first) and computes health client-side.
 */
export async function fetchDashboardHealth(
  events: Event[],
  prefetched?: Promise<DashboardHealthData | null>,
): Promise<Record<string, EventHealth>> {
  if (useMockData()) {
    const [{ mockEventsResponse }, { getMockState }] = await Promise.all([
      import('../data/mockEvents'),
      import('../data/mockStore'),
    ]);
    const state = getMockState();
    const map: Record<string, EventHealth> = {};
    mockEventsResponse.events.forEach((ev: Event) => {
      const tasks = state.tasksByEvent[ev.code] || [];
      const files = Object.values(state.filesByTask)
        .flat()
        .filter((f) => f.eventCode === ev.code);
      map[ev.code] = computeEventHealth(ev, tasks, files);
    });
    return map;
  }
  const raw = await (prefetched ?? startDashboardHealth());
  return raw ? buildHealthMap(events, raw) : {};
}

/** Every cost item across every event, for the admin reporting dashboard. */
export async function fetchAllCostItems(): Promise<CostItem[]> {
  if (useMockData()) return [];
  const res = await parseJson<{ costItems: CostItem[] }>(await fetch(buildUrl('costItemsList')));
  return Array.isArray(res.costItems) ? res.costItems : [];
}

export interface CreateEventInput {
  code: string;
  location?: string;
  dates?: string;
  startDate?: string;
  endDate?: string;
  monthGroup?: string;
  venue?: string;
  ownerEmail?: string;
  notes?: string;
  supportLevel?: string;
  templateIds?: string[];
}

export interface CreateEventResult {
  event: Event;
  tasks: Task[];
}

export async function createEvent(
  input: CreateEventInput,
  actorEmail: string,
): Promise<CreateEventResult> {
  if (useMockData()) {
    const { createMockEvent } = await import('../data/mockEvents');
    const event = createMockEvent(input);
    let tasks: Task[] = [];
    if (input.templateIds && input.templateIds.length) {
      const { applyMockTemplates } = await import('../data/mockCollaboration');
      tasks = applyMockTemplates(event.code, event.rowId, input.templateIds);
    }
    return { event, tasks };
  }
  invalidateEvents();
  const created = await post<CreateEventResult>('eventCreate', { ...input, actorEmail });
  invalidateEvents();
  return created;
}

export async function updateEvent(
  rowId: string,
  code: string,
  updates: EventUpdates,
  actorEmail?: string,
): Promise<Event> {
  if (useMockData()) {
    const { updateMockEvent } = await import('../data/mockEvents');
    return updateMockEvent(rowId, updates);
  }
  invalidateEvents();
  const updated = await post<Event>('update', { rowId, code, updates, actorEmail: actorEmail ?? '' });
  invalidateEvents();
  return updated;
}

export async function deleteEvent(
  rowId: string,
  code: string,
  actorEmail: string,
): Promise<void> {
  if (useMockData()) {
    const { deleteMockEvent } = await import('../data/mockEvents');
    await deleteMockEvent(rowId, code);
    return;
  }
  await post('eventDelete', { rowId, code, actorEmail });
  invalidateEvents();
  dropWorkspace(code);
}

const workspaceMem = new Map<string, Stamped<WorkspaceData>>();
const workspaceInflight = new Map<string, Promise<WorkspaceData>>();

function workspaceKey(eventCode: string, actorEmail: string): string {
  return `${actorEmail.trim().toLowerCase()}|${eventCode}`;
}

/** The last workspace we loaded for this event (this session only) — possibly stale. */
export function peekWorkspace(eventCode: string, actorEmail: string): WorkspaceData | null {
  if (useMockData()) return null;
  return workspaceMem.get(workspaceKey(eventCode, actorEmail))?.value ?? null;
}

/** Keeps the cached copy in step with edits made on the page, so coming back never shows old values. */
export function rememberWorkspace(eventCode: string, actorEmail: string, ws: WorkspaceData): void {
  if (useMockData()) return;
  workspaceMem.set(workspaceKey(eventCode, actorEmail), { value: ws, at: Date.now() });
}

function dropWorkspace(eventCode: string): void {
  const suffix = `|${eventCode}`;
  for (const k of [...workspaceMem.keys()]) if (k.endsWith(suffix)) workspaceMem.delete(k);
  for (const k of [...workspaceInflight.keys()]) if (k.endsWith(suffix)) workspaceInflight.delete(k);
}

/**
 * Starts loading an event's workspace ahead of time (e.g. when the pointer rests on its row). The page's
 * own load then picks up this request instead of starting another one.
 */
export function prefetchWorkspace(eventCode: string, actorEmail: string): void {
  if (useMockData() || !eventCode) return;
  const key = workspaceKey(eventCode, actorEmail);
  if (workspaceInflight.has(key)) return;
  const cached = workspaceMem.get(key);
  if (cached && Date.now() - cached.at < WORKSPACE_FRESH_MS) return;
  fetchWorkspaceRaw(eventCode, '', actorEmail, true).catch(() => {
    /* a failed prefetch is silent; the page load reports real errors */
  });
}

function fetchWorkspaceRaw(
  eventCode: string,
  eventRowId: string,
  actorEmail: string,
  shareable: boolean,
): Promise<WorkspaceData> {
  const key = workspaceKey(eventCode, actorEmail);
  const request: Promise<WorkspaceData> = fetch(buildUrl('workspace', { eventCode, eventRowId, actorEmail }))
    .then((res) => parseJson<WorkspaceData>(res))
    .then((ws) => {
      workspaceMem.set(key, { value: ws, at: Date.now() });
      return ws;
    });
  if (shareable) {
    workspaceInflight.set(key, request);
    const clear = () => {
      if (workspaceInflight.get(key) === request) workspaceInflight.delete(key);
    };
    request.then(clear, clear);
  }
  return request;
}

/** `actorEmail` lets the backend decide whether to include admin-only internal notes. */
export async function fetchWorkspace(eventCode: string, eventRowId: string, actorEmail = ''): Promise<WorkspaceData> {
  if (useMockData()) {
    const { getMockWorkspace } = await import('../data/mockCollaboration');
    return getMockWorkspace(eventCode, eventRowId);
  }
  return fetchWorkspaceRaw(eventCode, eventRowId, actorEmail, false);
}

/**
 * Same as `fetchWorkspace` but joins a prefetch that is already under way for this event, if any.
 * Use for opening a page; use `fetchWorkspace` when you need a read that starts now (e.g. after a write).
 */
export async function loadWorkspace(eventCode: string, actorEmail = ''): Promise<WorkspaceData> {
  if (!useMockData()) {
    const pending = workspaceInflight.get(workspaceKey(eventCode, actorEmail));
    if (pending) return pending;
  }
  return fetchWorkspace(eventCode, '', actorEmail);
}

/** Per-event financials for the Reports page. The backend refuses anyone without the Reports permission. */
export async function fetchReportData(year: number, actorEmail: string): Promise<ReportData> {
  if (useMockData()) {
    const { getMockReportData } = await import('../data/mockReports');
    return getMockReportData(year);
  }
  return parseJson(await fetch(buildUrl('reportData', { year: String(year), actorEmail })));
}

/** Saves the Reports settings (admin only). A monthly target of 0 clears it. */
export async function saveReportSettings(settings: { monthlyTarget: number }, actorEmail: string): Promise<{ monthlyTarget: number }> {
  if (useMockData()) {
    const { saveMockReportTarget } = await import('../data/mockReports');
    return { monthlyTarget: saveMockReportTarget(settings.monthlyTarget) };
  }
  return post('reportSettingsSave', { settings, actorEmail });
}

/** Weather, local time zone and USD exchange rate for an event's city — cached server-side. */
const CITY_FRESH_MS = 9 * 60 * 1000; // the backend itself caches weather for 10 minutes
const cityMem = new Map<string, Stamped<CityLive>>();
const cityInflight = new Map<string, Promise<CityLive>>();

/** The last weather / FX we fetched for this city this session (may be a few minutes old). */
export function peekCityLive(location: string): CityLive | null {
  return cityMem.get(location)?.value ?? null;
}

export async function fetchCityLive(location: string): Promise<CityLive> {
  if (useMockData()) throw new Error('Live city data needs the real backend');
  const cached = cityMem.get(location);
  if (cached && Date.now() - cached.at < CITY_FRESH_MS) return cached.value;
  const pending = cityInflight.get(location);
  if (pending) return pending;
  const request: Promise<CityLive> = fetch(buildUrl('cityLive', { location }))
    .then((res) => parseJson<CityLive>(res))
    .then((data) => {
      cityMem.set(location, { value: data, at: Date.now() });
      return data;
    })
    .finally(() => {
      if (cityInflight.get(location) === request) cityInflight.delete(location);
    });
  cityInflight.set(location, request);
  return request;
}

/** Copies an event (details + task list) under a new code. */
export async function duplicateEvent(
  rowId: string,
  code: string,
  newCode: string,
  actorEmail: string,
): Promise<CreateEventResult> {
  if (useMockData()) {
    const { findMockEvent, createMockEvent } = await import('../data/mockEvents');
    const src = findMockEvent({ code, rowId });
    if (!src) throw new Error('Event not found');
    return { event: createMockEvent({ ...src, code: newCode, status: '', awarded: '', revenue: '' }), tasks: [] };
  }
  const copy = await post<CreateEventResult>('eventDuplicate', { rowId, code, newCode, actorEmail });
  invalidateEvents();
  return copy;
}

// ——— Tasks ———

export async function fetchWhoami(actorEmail: string): Promise<{ isAdmin: boolean; email: string }> {
  if (useMockData()) {
    const admins = (import.meta.env.VITE_ADMIN_EMAILS || '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase());
    const isAdmin =
      admins.length === 0
        ? actorEmail.includes('admin') || actorEmail.includes('lead')
        : admins.includes(actorEmail.toLowerCase());
    return { isAdmin, email: actorEmail };
  }
  return post('whoami', { actorEmail });
}

export async function updateTask(
  taskId: string,
  updates: Partial<
    Pick<Task, 'title' | 'status' | 'assigneeEmail' | 'assigneeName' | 'dueDate' | 'instructions' | 'internalNotes' | 'vendorVisible' | 'completedBy' | 'completedAt'>
  >,
  actorEmail: string,
): Promise<Task> {
  if (useMockData()) {
    const { updateMockTask } = await import('../data/mockCollaboration');
    return updateMockTask(taskId, updates as Partial<Task>, actorEmail);
  }
  return post('taskUpdate', { taskId, updates, actorEmail });
}

export async function createTask(payload: {
  eventCode: string;
  eventRowId: string;
  title: string;
  category?: string;
  createdBy: string;
}): Promise<Task> {
  if (useMockData()) {
    const { createMockTask } = await import('../data/mockCollaboration');
    return createMockTask(payload);
  }
  return post('taskCreate', payload);
}

// ——— Cost items (event financials) ———

export async function createCostItem(payload: {
  eventCode: string;
  eventRowId: string;
  category: string;
  description: string;
  quantity: number;
  unitRate: number;
  currency?: string;
  vendorName?: string;
  notes?: string;
  createdBy: string;
}): Promise<CostItem> {
  return post('costItemCreate', payload);
}

export async function updateCostItem(
  costItemId: string,
  updates: Partial<Pick<CostItem, 'category' | 'description' | 'quantity' | 'unitRate' | 'currency' | 'vendorName' | 'notes'>>,
  actorEmail: string,
): Promise<CostItem> {
  return post('costItemUpdate', { costItemId, updates, actorEmail });
}

export async function deleteCostItem(costItemId: string, actorEmail: string): Promise<void> {
  await post('costItemDelete', { costItemId, actorEmail });
}

// ——— Comments ———

export async function addComment(payload: {
  eventCode: string;
  taskId?: string;
  authorEmail: string;
  authorName: string;
  body: string;
  /** 'internal' notes are admin-only; the backend rejects them from anyone else. */
  visibility?: 'team' | 'internal';
}): Promise<Comment> {
  if (useMockData()) {
    const { addMockComment } = await import('../data/mockCollaboration');
    return addMockComment(payload);
  }
  return post('commentAdd', { ...payload, actorEmail: payload.authorEmail });
}

// ——— Files ———

export async function uploadTaskFile(
  taskId: string,
  eventCode: string,
  file: File,
  uploadedBy: string,
): Promise<TaskFile> {
  if (useMockData()) {
    const { addMockFile } = await import('../data/mockCollaboration');
    return addMockFile(taskId, eventCode, file, uploadedBy);
  }

  const dataBase64 = await fileToBase64(file);
  return post('fileUpload', {
    taskId,
    eventCode,
    fileName: file.name,
    mimeType: file.type,
    dataBase64,
    uploadedBy,
  });
}

export async function deleteTaskFile(fileId: string, actorEmail: string): Promise<void> {
  if (useMockData()) {
    const { deleteMockFile } = await import('../data/mockCollaboration');
    deleteMockFile(fileId);
    return;
  }
  await post('fileDelete', { fileId, actorEmail });
}

export interface TransferListSaveResult {
  driveFileId: string;
  driveUrl: string;
  fileName: string;
}

export async function saveTransferListToDrive(payload: {
  eventCode: string;
  fileName: string;
  dataBase64: string;
  uploadedBy: string;
  actorEmail: string;
  eventLocation?: string;
  driveFileId?: string;
}): Promise<TransferListSaveResult> {
  if (useMockData()) {
    const id = payload.driveFileId || 'mock-transfer-' + payload.eventCode;
    return {
      driveFileId: id,
      driveUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      fileName: payload.fileName,
    };
  }
  return post<TransferListSaveResult>('transferListSave', {
    ...payload,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function saveAVEquipmentToDrive(payload: {
  eventCode: string;
  fileName: string;
  dataBase64: string;
  uploadedBy: string;
  actorEmail: string;
  eventLocation?: string;
  driveFileId?: string;
}): Promise<TransferListSaveResult> {
  if (useMockData()) {
    const id = payload.driveFileId || 'mock-av-' + payload.eventCode;
    return {
      driveFileId: id,
      driveUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      fileName: payload.fileName,
    };
  }
  return post<TransferListSaveResult>('avEquipmentSave', {
    ...payload,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function saveServiceReportToDrive(payload: {
  eventCode: string;
  fileName: string;
  dataBase64: string;
  uploadedBy: string;
  actorEmail: string;
  eventLocation?: string;
  driveFileId?: string;
}): Promise<TransferListSaveResult> {
  if (useMockData()) {
    const id = payload.driveFileId || 'mock-service-report-' + payload.eventCode;
    return {
      driveFileId: id,
      driveUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      fileName: payload.fileName,
    };
  }
  return post<TransferListSaveResult>('serviceReportSave', {
    ...payload,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ——— Team ———

export async function fetchTeamOverview(): Promise<TeamOverview> {
  if (useMockData()) {
    const { getMockTeamOverview } = await import('../data/mockCollaboration');
    return getMockTeamOverview();
  }
  return parseJson(await fetch(buildUrl('team')));
}

export async function healthCheck(): Promise<boolean> {
  if (useMockData()) return true;
  try {
    const data = await parseJson<{ ok: boolean }>(await fetch(buildUrl('health')));
    return data.ok;
  } catch {
    return false;
  }
}

// ——— Templates ———

export async function fetchTemplatesWithFiles(): Promise<TaskTemplateWithFiles[]> {
  if (useMockData()) {
    const { listMockTemplatesWithFiles } = await import('../data/mockTemplates');
    return listMockTemplatesWithFiles();
  }
  const res = await parseJson<{ templates: TaskTemplateWithFiles[] }>(
    await fetch(buildUrl('templatesList', { withFiles: 'true' })),
  );
  return res.templates;
}

export async function createTemplate(
  payload: Partial<TaskTemplate> & { actorEmail: string },
): Promise<TaskTemplate> {
  if (useMockData()) {
    const { createMockTemplate } = await import('../data/mockTemplates');
    return createMockTemplate(payload);
  }
  return post('templateCreate', payload);
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<TaskTemplate>,
  actorEmail: string,
): Promise<TaskTemplate> {
  if (useMockData()) {
    const { updateMockTemplate } = await import('../data/mockTemplates');
    return updateMockTemplate(templateId, updates);
  }
  return post('templateUpdate', { templateId, updates, actorEmail });
}

export async function deleteTemplate(templateId: string, actorEmail: string): Promise<void> {
  if (useMockData()) {
    const { deleteMockTemplate } = await import('../data/mockTemplates');
    deleteMockTemplate(templateId);
    return;
  }
  await post('templateDelete', { templateId, actorEmail });
}

export async function uploadTemplateFile(
  templateId: string,
  file: File,
  actorEmail: string,
): Promise<TemplateFile> {
  if (useMockData()) {
    const { addMockTemplateFile } = await import('../data/mockTemplates');
    return addMockTemplateFile(templateId, file);
  }
  const dataBase64 = await fileToBase64(file);
  return post('templateFileUpload', {
    templateId,
    fileName: file.name,
    mimeType: file.type,
    dataBase64,
    actorEmail,
  });
}

export async function applyTemplates(
  eventCode: string,
  eventRowId: string,
  templateIds: string[],
  actorEmail: string,
): Promise<Task[]> {
  if (useMockData()) {
    const { applyMockTemplates } = await import('../data/mockCollaboration');
    return applyMockTemplates(eventCode, eventRowId, templateIds);
  }
  const res = await post<{ tasks: Task[] }>('applyTemplates', {
    eventCode,
    eventRowId,
    templateIds,
    actorEmail,
  });
  return res.tasks;
}

// ——— Vendor ———

export function vendorPortalUrl(token: string): string {
  // BASE_URL is '/EventOS/' on GitHub Pages, '/' for a custom domain or
  // local dev — both already end in '/', so this never double- or
  // zero-slashes the join. Omitting it 404s on GH Pages, since the app
  // (and this route) only ever exists under /EventOS/, not the bare origin.
  const base = window.location.origin;
  const basePath = import.meta.env.BASE_URL ?? '/';
  return `${base}${basePath}vendor/${encodeURIComponent(token)}`;
}

export interface VendorLinkOptions {
  vendorCategory?: string;
  vendorName?: string;
  label?: string;
  permission?: 'view' | 'collaborate';
}

export async function listVendorLinks(eventCode: string): Promise<VendorLink[]> {
  if (useMockData()) {
    const { listMockVendorLinks } = await import('../data/mockCollaboration');
    return listMockVendorLinks(eventCode);
  }
  const res = await parseJson<{ links: VendorLink[] }>(
    await fetch(buildUrl('vendorLinksList', { eventCode })),
  );
  return res.links;
}

export async function getVendorLink(
  eventCode: string,
  eventRowId: string,
  actorEmail: string,
  options: VendorLinkOptions = {},
): Promise<VendorLink> {
  if (useMockData()) {
    const { getOrCreateMockVendorLink } = await import('../data/mockCollaboration');
    return getOrCreateMockVendorLink(eventCode, eventRowId, options);
  }
  const res = await parseJson<{ link: VendorLink }>(
    await fetch(
      buildUrl('vendorLinkGet', {
        eventCode,
        eventRowId,
        actorEmail,
        vendorCategory: options.vendorCategory || '',
        vendorName: options.vendorName || '',
        label: options.label || '',
        permission: options.permission || 'view',
      }),
    ),
  );
  return res.link;
}

export async function regenerateVendorLink(
  eventCode: string,
  eventRowId: string,
  actorEmail: string,
  options: VendorLinkOptions = {},
): Promise<VendorLink> {
  if (useMockData()) {
    const { regenerateMockVendorLink } = await import('../data/mockCollaboration');
    return regenerateMockVendorLink(eventCode, eventRowId, options);
  }
  const res = await post<{ link: VendorLink }>('vendorLinkRegenerate', {
    eventCode,
    eventRowId,
    actorEmail,
    ...options,
  });
  return res.link;
}

export async function revokeVendorLink(linkId: string, actorEmail: string): Promise<void> {
  if (useMockData()) {
    const { revokeMockVendorLink } = await import('../data/mockCollaboration');
    revokeMockVendorLink(linkId);
    return;
  }
  await post('vendorLinkRevoke', { linkId, actorEmail });
}

export async function fetchVendorWorkspace(vendorToken: string): Promise<VendorWorkspaceData> {
  if (useMockData()) {
    const { getMockVendorWorkspace } = await import('../data/mockCollaboration');
    return getMockVendorWorkspace(vendorToken);
  }
  return parseJson(
    await fetch(
      API_URL +
        '?action=vendorWorkspace&vendorToken=' +
        encodeURIComponent(vendorToken),
    ),
  );
}

/**
 * Write helper for the public vendor portal — deliberately separate from
 * post()/buildUrl(), which always inject the real API_TOKEN. This page is
 * unauthenticated and public, so the admin token must never appear in its
 * network requests; only vendorToken is ever sent.
 */
async function vendorPost<T>(vendorToken: string, action: string, body: Record<string, unknown>): Promise<T> {
  const fullBody = { action, vendorToken, ...body };
  const payloadJson = JSON.stringify(fullBody);

  if (payloadJson.length <= PAYLOAD_GET_LIMIT) {
    const url = `${API_URL}?action=${encodeURIComponent(action)}&vendorToken=${encodeURIComponent(vendorToken)}&payload=${encodeURIComponent(payloadJson)}`;
    return parseJson<T>(await fetch(url));
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payloadJson,
  });
  return parseJson<T>(res);
}

export async function vendorCreateCostItem(
  vendorToken: string,
  payload: { description: string; quantity: number; unitRate: number; currency?: string; notes?: string },
): Promise<CostItem> {
  return vendorPost(vendorToken, 'vendorCostItemCreate', payload);
}

export async function vendorUpdateCostItem(
  vendorToken: string,
  costItemId: string,
  updates: Partial<Pick<CostItem, 'description' | 'quantity' | 'unitRate' | 'currency' | 'notes'>>,
): Promise<CostItem> {
  return vendorPost(vendorToken, 'vendorCostItemUpdate', { costItemId, updates });
}

export async function vendorUploadFile(vendorToken: string, taskId: string, file: File): Promise<TaskFile> {
  const dataBase64 = await fileToBase64(file);
  return vendorPost(vendorToken, 'vendorFileUpload', {
    taskId,
    fileName: file.name,
    mimeType: file.type,
    dataBase64,
  });
}

export async function vendorUpdateTaskStatus(vendorToken: string, taskId: string, status: TaskStatus): Promise<Task> {
  return vendorPost(vendorToken, 'vendorTaskStatusUpdate', { taskId, status });
}

export async function vendorSubmitRates(vendorToken: string): Promise<{ ok: boolean; ratesSubmittedAt?: string }> {
  return vendorPost(vendorToken, 'vendorRatesSubmit', {});
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

// ——— Auth accounts ———

export async function apiAuthRegister(
  name: string,
  email: string,
  passwordHash: string,
): Promise<AuthAccount> {
  return post('authRegister', { name, email, passwordHash });
}

export async function apiAuthLogin(
  email: string,
  passwordHash: string,
): Promise<AuthAccount | null> {
  const res = await post<{ account: AuthAccount | null }>('authLogin', { email, passwordHash });
  return res.account;
}

export async function apiAuthChangePassword(email: string, newHash: string): Promise<void> {
  await post('authChangePassword', { email, newHash });
}

export async function apiAuthList(): Promise<AuthAccount[]> {
  const res = await parseJson<{ accounts?: AuthAccount[] }>(await fetch(buildUrl('authList')));
  return res.accounts ?? [];
}

export async function apiAuthCheckEmail(email: string): Promise<boolean> {
  const res = await parseJson<{ exists: boolean }>(
    await fetch(buildUrl('authCheckEmail', { email: email.toLowerCase().trim() })),
  );
  return res.exists;
}

// ——— Org members ———

export async function apiMembersList(): Promise<OrgMember[]> {
  const res = await parseJson<{ members: OrgMember[] }>(await fetch(buildUrl('membersList')));
  return res.members;
}

export async function apiMembersUpsert(member: OrgMember, actorEmail: string): Promise<void> {
  await post('membersUpsert', { member, actorEmail });
}

export async function apiMembersDeactivate(id: string, actorEmail: string): Promise<void> {
  await post('membersDeactivate', { id, actorEmail });
}

export async function apiMembersDelete(id: string, actorEmail: string): Promise<void> {
  await post('membersDelete', { id, actorEmail });
}

// ——— Role capabilities ———

export async function apiCapsList(): Promise<CapMatrix | null> {
  const res = await parseJson<{ matrix: CapMatrix | null }>(await fetch(buildUrl('capsList')));
  return res.matrix;
}

export async function apiCapsSave(matrix: CapMatrix, actorEmail: string): Promise<void> {
  await post('capsSave', { matrix, actorEmail });
}

// ——— Org templates (shared print/social/forms library) ———

export interface OrgTemplateFile {
  id: string;
  name: string;
  category: string;
  fileType: string;
  /** Drive share link — real mode only. */
  driveUrl?: string;
  /** Drive file ID — real mode only; used to build embeddable preview/download URLs. */
  driveFileId?: string;
  sizeBytes?: number;
  addedBy: string;
  addedAt: string;
}

export async function fetchOrgTemplates(): Promise<OrgTemplateFile[]> {
  if (useMockData()) {
    const { getOrgTemplates } = await import('../utils/orgTemplatesStore');
    return getOrgTemplates().map((f) => ({ ...f, driveUrl: f.dataUrl }));
  }
  const res = await parseJson<{ templates: OrgTemplateFile[] }>(await fetch(buildUrl('orgTemplatesList')));
  return res.templates;
}

/** Attaches/replaces the file on an existing slot (pass `id`), or creates a
 * brand-new one (omit `id`, pass `name` + `category`). Admin-only. */
export async function saveOrgTemplateFile(payload: {
  id?: string;
  name?: string;
  category?: string;
  file: File;
  actorEmail: string;
}): Promise<OrgTemplateFile> {
  if (useMockData()) {
    const { addOrgTemplate, uploadToOrgTemplate } = await import('../utils/orgTemplatesStore');
    const entry = payload.id
      ? await uploadToOrgTemplate(payload.id, payload.file)
      : await addOrgTemplate(payload.file, payload.category || 'Other', payload.actorEmail);
    return { ...entry, driveUrl: entry.dataUrl };
  }
  const dataBase64 = await fileToBase64(payload.file);
  return post('orgTemplateUpload', {
    id: payload.id,
    name: payload.name,
    category: payload.category,
    fileName: payload.file.name,
    mimeType: payload.file.type,
    dataBase64,
    actorEmail: payload.actorEmail,
  });
}

export async function deleteOrgTemplateFile(id: string, actorEmail: string): Promise<void> {
  if (useMockData()) {
    const { deleteOrgTemplate } = await import('../utils/orgTemplatesStore');
    deleteOrgTemplate(id);
    return;
  }
  await post('orgTemplateDelete', { id, actorEmail });
}

// ——— Useful links (admin-curated list of external sites) ———

export interface UsefulLink {
  id: string;
  title: string;
  url: string;
  notes?: string;
  addedBy: string;
  addedAt: string;
}

export async function fetchUsefulLinks(): Promise<UsefulLink[]> {
  if (useMockData()) {
    const { getUsefulLinks } = await import('../utils/usefulLinksStore');
    return getUsefulLinks();
  }
  const res = await parseJson<{ links: UsefulLink[] }>(await fetch(buildUrl('usefulLinksList')));
  return res.links;
}

/** Creates a new link (omit `id`) or edits an existing one (pass `id`). Admin-only. */
export async function saveUsefulLink(payload: {
  id?: string;
  title: string;
  url: string;
  notes?: string;
  actorEmail: string;
}): Promise<UsefulLink> {
  if (useMockData()) {
    const { upsertUsefulLink } = await import('../utils/usefulLinksStore');
    return upsertUsefulLink(payload, payload.actorEmail);
  }
  return post('usefulLinkUpsert', payload);
}

export async function deleteUsefulLink(id: string, actorEmail: string): Promise<void> {
  if (useMockData()) {
    const { deleteUsefulLinkEntry } = await import('../utils/usefulLinksStore');
    deleteUsefulLinkEntry(id);
    return;
  }
  await post('usefulLinkDelete', { id, actorEmail });
}
