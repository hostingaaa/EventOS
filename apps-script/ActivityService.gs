var ACTIVITY_COLS = {
  ACTIVITY_ID: 'Activity ID',
  TYPE: 'Type',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  SUMMARY: 'Summary',
  ACTOR: 'Actor',
  CREATED_AT: 'Created At',
};

function getActivitySheet_() {
  return getOrCreateSheet_(CONFIG.ACTIVITY_SHEET, Object.values(ACTIVITY_COLS));
}

// logActivity_ is defined in SheetService.gs

/** Activity types only admins may see (they reveal that an internal note exists). */
var INTERNAL_ACTIVITY_TYPES_ = { note_internal: true };

/** includeInternal must only be true for admins. */
function listActivity_(eventCode, limit, includeInternal) {
  var sheet = getActivitySheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var items = [];

  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    function cell(name) {
      var c = colIndex_(map, name);
      if (!c) return '';
      return row[c - 1] != null ? String(row[c - 1]) : '';
    }

    var id = cell(ACTIVITY_COLS.ACTIVITY_ID);
    if (!id) continue;
    var code = cell(ACTIVITY_COLS.EVENT_CODE);
    if (eventCode && code !== eventCode) continue;
    if (!includeInternal && INTERNAL_ACTIVITY_TYPES_[cell(ACTIVITY_COLS.TYPE)]) continue;

    items.push({
      activityId: id,
      type: cell(ACTIVITY_COLS.TYPE),
      eventCode: code,
      taskId: cell(ACTIVITY_COLS.TASK_ID),
      summary: cell(ACTIVITY_COLS.SUMMARY),
      actor: cell(ACTIVITY_COLS.ACTOR),
      createdAt: cell(ACTIVITY_COLS.CREATED_AT),
    });

    if (limit && items.length >= limit) break;
  }
  return items;
}

function getTeamOverview_() {
  var tasks = listTasksFromSheet_(getTasksSheet_(), getHeaderMap_(getTasksSheet_()), null, null);
  var byAssignee = {};

  tasks.forEach(function (t) {
    var key = t.assigneeEmail || t.assigneeName || 'Unassigned';
    if (!byAssignee[key]) {
      byAssignee[key] = { email: t.assigneeEmail, name: t.assigneeName || 'Unassigned', tasks: [] };
    }
    byAssignee[key].tasks.push(t);
  });

  return {
    members: Object.keys(byAssignee).map(function (k) {
      return byAssignee[k];
    }),
    totalTasks: tasks.length,
    openTasks: tasks.filter(function (t) {
      return t.status !== 'done';
    }).length,
  };
}
