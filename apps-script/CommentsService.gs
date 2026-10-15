var COMMENT_COLS = {
  COMMENT_ID: 'Comment ID',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  AUTHOR_EMAIL: 'Author Email',
  AUTHOR_NAME: 'Author Name',
  BODY: 'Body',
  CREATED_AT: 'Created At',
  VISIBILITY: 'Visibility',
};

function getCommentsSheet_() {
  var sheet = getOrCreateSheet_(CONFIG.COMMENTS_SHEET, Object.values(COMMENT_COLS));
  ensureSheetColumns_(sheet, [COMMENT_COLS.VISIBILITY]);
  return sheet;
}

/** 'internal' notes are admin-only; anything else (including every note written before visibility existed) is 'team'. */
function normalizeVisibility_(v) {
  return String(v || '').trim().toLowerCase() === 'internal' ? 'internal' : 'team';
}

/** includeInternal must only be true for admins — internal notes never leave the server otherwise. */
function listComments_(eventCode, taskId, includeInternal) {
  var sheet = getCommentsSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var comments = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var c = rowToComment_(row, map);
    if (!c) continue;
    if (eventCode && c.eventCode !== eventCode) continue;
    if (taskId && c.taskId !== taskId) continue;
    if (c.visibility === 'internal' && !includeInternal) continue;
    comments.push(c);
  }

  comments.sort(function (a, b) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  return comments;
}

function rowToComment_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var id = cell(COMMENT_COLS.COMMENT_ID);
  if (!id) return null;

  return {
    commentId: id,
    eventCode: cell(COMMENT_COLS.EVENT_CODE),
    taskId: cell(COMMENT_COLS.TASK_ID),
    authorEmail: cell(COMMENT_COLS.AUTHOR_EMAIL),
    authorName: cell(COMMENT_COLS.AUTHOR_NAME),
    body: cell(COMMENT_COLS.BODY),
    createdAt: cell(COMMENT_COLS.CREATED_AT),
    visibility: normalizeVisibility_(cell(COMMENT_COLS.VISIBILITY)),
  };
}

function addComment_(payload) {
  var visibility = normalizeVisibility_(payload.visibility);
  if (visibility === 'internal' && !isAdmin_(payload.authorEmail)) {
    throw new Error('Permission denied: only admins can post internal notes');
  }
  var sheet = getCommentsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var commentId = Utilities.getUuid();
  var now = new Date().toISOString();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(COMMENT_COLS.COMMENT_ID, commentId);
  setCol(COMMENT_COLS.EVENT_CODE, payload.eventCode);
  setCol(COMMENT_COLS.TASK_ID, payload.taskId || '');
  setCol(COMMENT_COLS.AUTHOR_EMAIL, payload.authorEmail || '');
  setCol(COMMENT_COLS.AUTHOR_NAME, payload.authorName || '');
  setCol(COMMENT_COLS.BODY, payload.body);
  setCol(COMMENT_COLS.CREATED_AT, now);
  setCol(COMMENT_COLS.VISIBILITY, visibility);

  var task = payload.taskId && typeof findTask_ === 'function' ? findTask_(payload.taskId) : null;
  var noun = visibility === 'internal' ? 'an internal note' : 'a note';
  logActivity_(
    visibility === 'internal' ? 'note_internal' : 'note_added',
    payload.eventCode,
    payload.taskId || '',
    'added ' + noun + (task ? ' on ' + task.title : ' to the event discussion'),
    payload.authorEmail
  );

  return {
    commentId: commentId,
    eventCode: payload.eventCode,
    taskId: payload.taskId || '',
    authorEmail: payload.authorEmail,
    authorName: payload.authorName,
    body: payload.body,
    createdAt: now,
    visibility: visibility,
  };
}
