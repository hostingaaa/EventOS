export interface Event {
  rowNumber: number;
  rowId: string;
  code: string;
  location: string;
  dates: string;
  lem: string;
  av: string;
  interpreters: string;
  venue: string;
  psaCldp: string;
  sow: string;
  notes: string;
  monthGroup: string;
  startDate: string;
  endDate: string;
  ownerEmail: string;
  lastReminder: string;
  /** Per diem configurable amounts — used by the per diem form generator template. */
  perDiemRate?: string;
  maxVisaAllowance?: string;
  maxGroundTransport?: string;
  /** Google Drive folder URL created automatically when the event is set up. */
  driveFolderUrl?: string;
  /** "Yes" once an admin marks the event's contract as secured; empty otherwise. */
  awarded?: string;
  /** Total contract/quote value paid by the client. Admin-only to view or edit. */
  revenue?: string;
  /** "Yes" once an admin marks the event complete; empty otherwise. */
  completed?: string;
  /** Set when the Service Report generator saves a report for this event. */
  serviceReportDriveUrl?: string;
  serviceReportDriveFileId?: string;
  serviceReportSavedAt?: string;
  serviceReportSavedBy?: string;
}

export interface CostItem {
  costItemId: string;
  eventCode: string;
  eventRowId: string;
  category: string;
  description: string;
  quantity: number;
  unitRate: number;
  currency: string;
  /** Computed server-side as quantity * unitRate — not stored directly. */
  total: number;
  vendorName?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  rowNumber?: number;
}

export interface EventsResponse {
  months: string[];
  events: Event[];
}

export type EventUpdates = Partial<
  Pick<Event, 'lem' | 'av' | 'interpreters' | 'venue' | 'psaCldp' | 'sow' | 'notes' | 'ownerEmail' | 'perDiemRate' | 'maxVisaAllowance' | 'maxGroundTransport' | 'awarded' | 'revenue' | 'completed' | 'serviceReportDriveUrl' | 'serviceReportDriveFileId' | 'serviceReportSavedAt' | 'serviceReportSavedBy'>
>;

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  taskId: string;
  eventCode: string;
  eventRowId: string;
  title: string;
  category: string;
  status: TaskStatus;
  assigneeEmail: string;
  assigneeName: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  instructions: string;
  /** Admin-only internal notes — never sent to vendors or shown on the vendor portal. */
  internalNotes?: string;
  templateId: string;
  /** 'yes' | 'no' — whether this task appears on vendor portal links. */
  vendorVisible: string;
  /** Email of the person who marked this task done. */
  completedBy?: string;
  /** ISO timestamp when the task was marked done. */
  completedAt?: string;
  rowNumber?: number;
}

export interface Comment {
  commentId: string;
  eventCode: string;
  taskId: string;
  authorEmail: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskFile {
  fileId: string;
  eventCode: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  driveFileId: string;
  driveUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeBytes: number;
}

export interface ActivityItem {
  activityId: string;
  type: string;
  eventCode: string;
  taskId: string;
  summary: string;
  actor: string;
  createdAt: string;
}

export interface VendorLink {
  linkId: string;
  token: string;
  eventCode: string;
  eventRowId: string;
  label: string;
  /** Category this link is scoped to (e.g. "AV", "Catering"). Empty = full event. */
  vendorCategory?: string;
  /** Vendor company/contact name (optional). */
  vendorName?: string;
  /** Permission level for vendor: 'view' | 'collaborate'. */
  permission?: 'view' | 'collaborate';
  createdAt: string;
  createdBy: string;
  active: string;
}

export interface EventHealth {
  /** Completion percentage (0–100). */
  completion: number;
  /** Risk score (0–100, higher = worse). */
  risk: number;
  /** Risk tier label. */
  tier: 'on-track' | 'attention' | 'at-risk' | 'critical';
  /** Total task count. */
  totalTasks: number;
  /** Completed task count. */
  doneTasks: number;
  /** Open task count. */
  openTasks: number;
  /** Overdue task count. */
  overdueTasks: number;
  /** Specific signals that contributed to the risk. */
  signals: string[];
}

export interface WorkspaceData {
  event: Event;
  tasks: Task[];
  comments: Comment[];
  files: TaskFile[];
  activity: ActivityItem[];
  vendorLink?: VendorLink | null;
  costItems: CostItem[];
}

export interface TaskTemplate {
  templateId: string;
  title: string;
  category: string;
  instructions: string;
  defaultAssigneeEmail: string;
  defaultAssigneeName: string;
  sortOrder: string | number;
  active: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Optional offset in days from event start for default due date (negative = before). */
  dueOffsetDays?: number;
}

/**
 * Template variable available for {{interpolation}} when applying a template
 * to an event. New variables added here should also be wired into
 * `renderTemplateString` in `web/src/utils/templateVars.ts`.
 */
export type TemplateVariable =
  | 'event_code'
  | 'event_name'
  | 'city'
  | 'venue'
  | 'dates'
  | 'start_date'
  | 'end_date'
  | 'month'
  | 'owner_email'
  | 'vendor_name'
  | 'vendor_category';

export interface TemplateFile {
  fileId: string;
  templateId: string;
  fileName: string;
  mimeType: string;
  driveFileId: string;
  driveUrl: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface TaskTemplateWithFiles {
  template: TaskTemplate;
  files: TemplateFile[];
}

export interface VendorEvent {
  code: string;
  location: string;
  dates: string;
  venue: string;
  monthGroup: string;
}

export interface VendorTask {
  taskId: string;
  title: string;
  category: string;
  instructions: string;
  status: TaskStatus;
}

export interface VendorFile {
  fileId: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  driveUrl: string;
  sizeBytes: number;
}

export interface VendorWorkspaceData {
  event: VendorEvent;
  tasks: VendorTask[];
  files: VendorFile[];
  costItems: CostItem[];
  linkLabel: string;
  vendorName?: string;
  vendorCategory?: string;
  permission?: 'view' | 'collaborate';
}

export interface TeamMember {
  email: string;
  name: string;
  tasks: Task[];
}

export interface TeamOverview {
  members: TeamMember[];
  totalTasks: number;
  openTasks: number;
}

export interface TeamUser {
  name: string;
  email: string;
  isAdmin?: boolean;
  role?: import('./utils/roleStore').AppRole;
}
