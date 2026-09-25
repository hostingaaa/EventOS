var TASK_COLS = {
  TASK_ID: 'Task ID',
  EVENT_CODE: 'Event Code',
  EVENT_ROW_ID: 'Event Row ID',
  TITLE: 'Title',
  CATEGORY: 'Category',
  STATUS: 'Status',
  ASSIGNEE_EMAIL: 'Assignee Email',
  ASSIGNEE_NAME: 'Assignee Name',
  DUE_DATE: 'Due Date',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
  CREATED_BY: 'Created By',
  INSTRUCTIONS: 'Instructions',
  INTERNAL_NOTES: 'Internal Notes',
  TEMPLATE_ID: 'Template ID',
  VENDOR_VISIBLE: 'Vendor Visible',
  COMPLETED_BY: 'Completed By',
  COMPLETED_AT: 'Completed At',
};

/** Default LEM operational tasks seeded when creating a new event without templates. */
var DEFAULT_TASKS = [
  { title: 'SOW review & sign-off', category: 'SOW' },
  { title: 'Venue coordination', category: 'Venue' },
  { title: 'AV & technical setup', category: 'AV' },
  { title: 'Interpretation setup', category: 'Interpretation' },
  { title: 'Airport transportation', category: 'Transportation' },
  { title: 'Registration desk setup', category: 'Registration' },
  { title: 'Name badges & printing', category: 'Printing' },
  { title: 'Catering coordination', category: 'Catering' },
  { title: 'Photography & video', category: 'Photography' },
  { title: 'LEM on-site coordination', category: 'LEM' },
];

function getTasksSheet_() {
  return getOrCreateSheet_(CONFIG.TASKS_SHEET, Object.values(TASK_COLS));
}

function getOrCreateSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function listTasks_(eventCode, eventRowId) {
  var sheet = getTasksSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  return listTasksFromSheet_(sheet, map, eventCode, eventRowId);
}

function listTasksFromSheet_(sheet, map, eventCode, eventRowId) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var tasks = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var task = rowToTask_(row, map, i + 2);
    if (!task) continue;
    if (eventCode && task.eventCode !== eventCode) continue;
    if (eventRowId && task.eventRowId && task.eventRowId !== eventRowId) continue;
    tasks.push(task);
  }
  return tasks;
}

function rowToTask_(row, map, rowNum) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var taskId = cell(TASK_COLS.TASK_ID);
  if (!taskId) return null;

  return {
    taskId: taskId,
    eventCode: cell(TASK_COLS.EVENT_CODE),
    eventRowId: cell(TASK_COLS.EVENT_ROW_ID),
    title: cell(TASK_COLS.TITLE),
    category: cell(TASK_COLS.CATEGORY),
    status: cell(TASK_COLS.STATUS) || 'todo',
    assigneeEmail: cell(TASK_COLS.ASSIGNEE_EMAIL),
    assigneeName: cell(TASK_COLS.ASSIGNEE_NAME),
    dueDate: cell(TASK_COLS.DUE_DATE),
    createdAt: cell(TASK_COLS.CREATED_AT),
    updatedAt: cell(TASK_COLS.UPDATED_AT),
    createdBy: cell(TASK_COLS.CREATED_BY),
    instructions: cell(TASK_COLS.INSTRUCTIONS),
    internalNotes: cell(TASK_COLS.INTERNAL_NOTES),
    templateId: cell(TASK_COLS.TEMPLATE_ID),
    vendorVisible: cell(TASK_COLS.VENDOR_VISIBLE) || 'yes',
    completedBy: cell(TASK_COLS.COMPLETED_BY),
    completedAt: cell(TASK_COLS.COMPLETED_AT),
    rowNumber: rowNum,
  };
}

function seedDefaultTasks_(eventCode, eventRowId) {
  DEFAULT_TASKS.forEach(function (t) {
    createTask_({
      eventCode: eventCode,
      eventRowId: eventRowId || '',
      title: t.title,
      category: t.category,
      status: 'todo',
      createdBy: 'system',
    });
  });
}

function createTask_(payload) {
  var sheet = getTasksSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var now = new Date().toISOString();
  var taskId = Utilities.getUuid();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(TASK_COLS.TASK_ID, taskId);
  setCol(TASK_COLS.EVENT_CODE, payload.eventCode);
  setCol(TASK_COLS.EVENT_ROW_ID, payload.eventRowId || '');
  setCol(TASK_COLS.TITLE, payload.title);
  setCol(TASK_COLS.CATEGORY, payload.category || 'General');
  setCol(TASK_COLS.STATUS, payload.status || 'todo');
  setCol(TASK_COLS.ASSIGNEE_EMAIL, payload.assigneeEmail || '');
  setCol(TASK_COLS.ASSIGNEE_NAME, payload.assigneeName || '');
  setCol(TASK_COLS.DUE_DATE, payload.dueDate || '');
  setCol(TASK_COLS.CREATED_AT, now);
  setCol(TASK_COLS.UPDATED_AT, now);
  setCol(TASK_COLS.CREATED_BY, payload.createdBy || '');
  setCol(TASK_COLS.INSTRUCTIONS, payload.instructions || '');
  setCol(TASK_COLS.INTERNAL_NOTES, payload.internalNotes || '');
  setCol(TASK_COLS.TEMPLATE_ID, payload.templateId || '');
  setCol(TASK_COLS.COMPLETED_BY, payload.completedBy || '');
  setCol(TASK_COLS.COMPLETED_AT, payload.completedAt || '');
  setCol(TASK_COLS.VENDOR_VISIBLE, payload.vendorVisible != null ? payload.vendorVisible : 'yes');

  logActivity_('task_created', payload.eventCode, taskId, payload.title, payload.createdBy);
  return findTask_(taskId);
}

function findTask_(taskId) {
  var tasks = listTasksFromSheet_(getTasksSheet_(), getHeaderMap_(getTasksSheet_()), null, null);
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].taskId === taskId) return tasks[i];
  }
  return null;
}

function updateTask_(taskId, updates, actorEmail) {
  var task = findTask_(taskId);
  if (!task) throw new Error('Task not found');

  var sheet = getTasksSheet_();
  var map = getHeaderMap_(sheet);
  var fieldMap = {
    title: TASK_COLS.TITLE,
    category: TASK_COLS.CATEGORY,
    status: TASK_COLS.STATUS,
    assigneeEmail: TASK_COLS.ASSIGNEE_EMAIL,
    assigneeName: TASK_COLS.ASSIGNEE_NAME,
    dueDate: TASK_COLS.DUE_DATE,
    instructions: TASK_COLS.INSTRUCTIONS,
    internalNotes: TASK_COLS.INTERNAL_NOTES,
    vendorVisible: TASK_COLS.VENDOR_VISIBLE,
    completedBy: TASK_COLS.COMPLETED_BY,
    completedAt: TASK_COLS.COMPLETED_AT,
  };

  // Auto-manage completion fields when status changes
  if (updates.status === 'done' && task.status !== 'done') {
    updates.completedBy = actorEmail || '';
    updates.completedAt = new Date().toISOString();
  } else if (updates.status && updates.status !== 'done' && task.status === 'done') {
    updates.completedBy = '';
    updates.completedAt = '';
  }

  Object.keys(updates).forEach(function (key) {
    var colName = fieldMap[key];
    if (!colName) return;
    var col = colIndex_(map, colName);
    if (col) sheet.getRange(task.rowNumber, col).setValue(updates[key]);
  });

  var updatedCol = colIndex_(map, TASK_COLS.UPDATED_AT);
  if (updatedCol) sheet.getRange(task.rowNumber, updatedCol).setValue(new Date().toISOString());

  logActivity_('task_updated', task.eventCode, taskId, updates.status || task.title, actorEmail || '');
  return findTask_(taskId);
}

/** Permanently removes a single task row. Admin-only (checked by caller). */
function deleteTask_(taskId, actorEmail) {
  var task = findTask_(taskId);
  if (!task) throw new Error('Task not found');

  getTasksSheet_().deleteRow(task.rowNumber);
  logActivity_('task_deleted', task.eventCode, taskId, task.title, actorEmail || '');
  return { ok: true };
}

/** Remove all task rows for an event (bottom-up to keep row indices stable). */
function deleteTasksForEvent_(eventCode) {
  if (!eventCode) return;
  var sheet = getTasksSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var codeCol = colIndex_(map, TASK_COLS.EVENT_CODE);
  if (!codeCol) return;

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var rowsToDelete = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][codeCol - 1] || '') === eventCode) {
      rowsToDelete.push(i + 2);
    }
  }
  rowsToDelete.sort(function (a, b) {
    return b - a;
  });
  rowsToDelete.forEach(function (rowNum) {
    sheet.deleteRow(rowNum);
  });
}
