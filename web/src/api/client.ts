import type {
  Comment,
  CostItem,
  Event,
  EventHealth,
  EventsResponse,
  EventUpdates,
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

export async function fetchEvents(): Promise<EventsResponse> {
  if (useMockData()) {
    const { mockEventsResponse } = await import('../data/mockEvents');
    return mockEventsResponse;
  }
  const data = await parseJson<EventsResponse>(await fetch(buildUrl('list')));
  return {
    months: Array.isArray(data.months) ? data.months : [],
    events: Array.isArray(data.events) ? data.events : [],
  };
}

/**
 * Returns per-event health summaries for the dashboard. In mock mode this
 * pulls task/file data from the local store; in real mode it hits a
 * lightweight `dashboardHealth` endpoint on the backend.
 */
export async function fetchDashboardHealth(): Promise<Record<string, EventHealth>> {
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
  try {
    const res = await parseJson<{ health: Record<string, EventHealth> }>(
      await fetch(buildUrl('dashboardHealth')),
    );
    return res.health;
  } catch {
    return {};
  }
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
  return post('eventCreate', { ...input, actorEmail });
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
  return post('update', { rowId, code, updates, actorEmail: actorEmail ?? '' });
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
}

export async function fetchWorkspace(eventCode: string, eventRowId: string): Promise<WorkspaceData> {
  if (useMockData()) {
    const { getMockWorkspace } = await import('../data/mockCollaboration');
    return getMockWorkspace(eventCode, eventRowId);
  }
  return parseJson(
    await fetch(buildUrl('workspace', { eventCode, eventRowId })),
  );
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
    const { getMockWorkspace, updateMockTask } = await import('../data/mockCollaboration');
    const ws = getMockWorkspace(payload.eventCode, payload.eventRowId);
    return updateMockTask(ws.tasks[0].taskId, {
      title: payload.title,
      category: payload.category || 'General',
    });
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
}): Promise<Comment> {
  if (useMockData()) {
    const { addMockComment } = await import('../data/mockCollaboration');
    return addMockComment(payload);
  }
  return post('commentAdd', payload);
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
  const base = window.location.origin;
  return `${base}/vendor/${encodeURIComponent(token)}`;
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
