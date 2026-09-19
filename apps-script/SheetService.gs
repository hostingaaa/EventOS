/**
 * Creates the Drive folder structure for a new event (used by createEvent_).
 * Full file-upload helpers live in FilesService.gs when that file is deployed.
 */
var ACTIVITY_LOG_COLS_ = {
  ACTIVITY_ID: 'Activity ID',
  TYPE: 'Type',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  SUMMARY: 'Summary',
  ACTOR: 'Actor',
  CREATED_AT: 'Created At',
};

function getActivityLogSheet_() {
  var ss = getSpreadsheet_();
  var name = CONFIG.ACTIVITY_SHEET;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow([
      ACTIVITY_LOG_COLS_.ACTIVITY_ID,
      ACTIVITY_LOG_COLS_.TYPE,
      ACTIVITY_LOG_COLS_.EVENT_CODE,
      ACTIVITY_LOG_COLS_.TASK_ID,
      ACTIVITY_LOG_COLS_.SUMMARY,
      ACTIVITY_LOG_COLS_.ACTOR,
      ACTIVITY_LOG_COLS_.CREATED_AT,
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Append one row to the Activity sheet (full feed in ActivityService.gs). */
function logActivity_(type, eventCode, taskId, summary, actor) {
  try {
    var sheet = getActivityLogSheet_();
    var map = getHeaderMap_(sheet);
    var row = sheet.getLastRow() + 1;
    var now = new Date().toISOString();

    function setCol(name, val) {
      var c = colIndex_(map, name);
      if (c) sheet.getRange(row, c).setValue(val);
    }

    setCol(ACTIVITY_LOG_COLS_.ACTIVITY_ID, Utilities.getUuid());
    setCol(ACTIVITY_LOG_COLS_.TYPE, type);
    setCol(ACTIVITY_LOG_COLS_.EVENT_CODE, eventCode || '');
    setCol(ACTIVITY_LOG_COLS_.TASK_ID, taskId || '');
    setCol(ACTIVITY_LOG_COLS_.SUMMARY, summary || '');
    setCol(ACTIVITY_LOG_COLS_.ACTOR, actor || '');
    setCol(ACTIVITY_LOG_COLS_.CREATED_AT, now);
  } catch (e) {
    Logger.log('logActivity_ skipped: ' + e);
  }
}

function createEventDriveFolders_(eventCode, location) {
  try {
    var folderId = getScriptProperty_('DRIVE_ROOT_FOLDER_ID', true) || DEFAULT_DRIVE_ROOT_FOLDER_ID;
    var root = DriveApp.getFolderById(folderId);
    var folderName = location ? (eventCode + ' - ' + location) : eventCode;
    var iter = root.getFoldersByName(folderName);
    if (iter.hasNext()) return iter.next().getUrl();
    var iterCode = root.getFoldersByName(eventCode);
    if (iterCode.hasNext()) return iterCode.next().getUrl();
    var eventFolder = root.createFolder(folderName);
    setOrgSharing_(eventFolder);
    EVENT_SUBFOLDERS.forEach(function (name) {
      var sub = eventFolder.createFolder(name);
      setOrgSharing_(sub);
    });
    return eventFolder.getUrl();
  } catch (e) {
    Logger.log('createEventDriveFolders_ error: ' + e);
    return '';
  }
}

function getEventsSheet_() {
  var name = getScriptProperty_('SHEET_NAME', true) || CONFIG.SHEET_NAME;
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = [
      CONFIG.COLS.CODE,
      CONFIG.COLS.LOCATION,
      CONFIG.COLS.DATES,
      CONFIG.COLS.LEM,
      CONFIG.COLS.AV,
      CONFIG.COLS.INTERPRETERS,
      CONFIG.COLS.VENUE,
      CONFIG.COLS.PSA_CLDP,
      CONFIG.COLS.SOW,
      CONFIG.COLS.NOTES,
      CONFIG.COLS.MONTH_GROUP,
      CONFIG.COLS.START_DATE,
      CONFIG.COLS.END_DATE,
      CONFIG.COLS.OWNER_EMAIL,
      CONFIG.COLS.LAST_REMINDER,
      CONFIG.COLS.ROW_ID,
      CONFIG.COLS.DRIVE_FOLDER_URL,
      CONFIG.COLS.AWARDED,
      CONFIG.COLS.REVENUE,
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim();
    if (h) map[h] = i + 1;
  }
  return map;
}

function colIndex_(map, colName) {
  var idx = map[colName];
  if (!idx) return null;
  return idx;
}

/**
 * The spreadsheet's own "File → Settings → Time zone" — NOT
 * Session.getScriptTimeZone(), which reflects this (standalone,
 * openById-connected) script project's manifest timezone instead and can
 * silently differ from the sheet's. Sheets auto-converts plain date-like
 * strings ("2026-09-20", "September 2026") into real Date-typed cells using
 * its own timezone; reading those cells back must use that SAME timezone
 * or the calendar day drifts by one (see setCol_/setDateCol_ below, which
 * avoid this entirely for new writes by keeping these columns plain text).
 */
function getSheetTz_() {
  return getSpreadsheet_().getSpreadsheetTimeZone() || 'UTC';
}

/** Columns that must never be auto-converted to a Date-typed cell — see
 * getSheetTz_ for why that conversion is what causes the day to drift. */
var DATE_TEXT_COLS_ = {};
DATE_TEXT_COLS_[CONFIG.COLS.DATES] = true;
DATE_TEXT_COLS_[CONFIG.COLS.MONTH_GROUP] = true;
DATE_TEXT_COLS_[CONFIG.COLS.START_DATE] = true;
DATE_TEXT_COLS_[CONFIG.COLS.END_DATE] = true;

/** Writes a cell, forcing plain-text format first for date-label columns so
 * Sheets never silently reinterprets "2026-09-20" or "September 2026" as a
 * real Date (which is what introduces the timezone-dependent day drift). */
function setDateSafeCell_(range, colName, val) {
  if (DATE_TEXT_COLS_[colName]) range.setNumberFormat('@');
  range.setValue(val);
}

function rowToEvent_(row, rowNum, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    var v = row[c - 1];
    if (v == null || v === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      var d = v;
      if (isNaN(d.getTime())) return '';
      if (name === CONFIG.COLS.MONTH_GROUP) {
        return monthGroupFromDate_(d);
      }
      if (name === CONFIG.COLS.START_DATE || name === CONFIG.COLS.END_DATE) {
        return Utilities.formatDate(d, getSheetTz_(), 'yyyy-MM-dd');
      }
      return Utilities.formatDate(d, getSheetTz_(), 'yyyy-MM-dd');
    }
    return String(v);
  }

  var code = cell(CONFIG.COLS.CODE);
  if (!code || code === 'Code') return null;

  // Skip month separator rows (no code, or month header pattern)
  if (/^\s*$/.test(code)) return null;

  return {
    rowNumber: rowNum,
    rowId: cell(CONFIG.COLS.ROW_ID) || 'row-' + rowNum,
    code: code,
    location: cell(CONFIG.COLS.LOCATION),
    dates: cell(CONFIG.COLS.DATES),
    lem: cell(CONFIG.COLS.LEM),
    av: cell(CONFIG.COLS.AV),
    interpreters: cell(CONFIG.COLS.INTERPRETERS),
    venue: cell(CONFIG.COLS.VENUE),
    psaCldp: cell(CONFIG.COLS.PSA_CLDP),
    sow: cell(CONFIG.COLS.SOW),
    notes: cell(CONFIG.COLS.NOTES),
    monthGroup: cell(CONFIG.COLS.MONTH_GROUP),
    startDate: cell(CONFIG.COLS.START_DATE),
    endDate: cell(CONFIG.COLS.END_DATE),
    ownerEmail: cell(CONFIG.COLS.OWNER_EMAIL),
    lastReminder: cell(CONFIG.COLS.LAST_REMINDER),
    driveFolderUrl: cell(CONFIG.COLS.DRIVE_FOLDER_URL),
    awarded: cell(CONFIG.COLS.AWARDED),
    revenue: cell(CONFIG.COLS.REVENUE),
    serviceReportDriveUrl: cell(CONFIG.COLS.SERVICE_REPORT_DRIVE_URL),
    serviceReportDriveFileId: cell(CONFIG.COLS.SERVICE_REPORT_DRIVE_FILE_ID),
    serviceReportSavedAt: cell(CONFIG.COLS.SERVICE_REPORT_SAVED_AT),
    serviceReportSavedBy: cell(CONFIG.COLS.SERVICE_REPORT_SAVED_BY),
  };
}

function listEvents_() {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) {
    return { months: [], events: [] };
  }

  var data = sheet.getRange(CONFIG.HEADER_ROW + 1, 1, lastRow - CONFIG.HEADER_ROW, sheet.getLastColumn()).getValues();
  var events = [];
  var currentMonth = '';

  for (var i = 0; i < data.length; i++) {
    var rowNum = CONFIG.HEADER_ROW + 1 + i;
    var row = data[i];
    var mapCols = getHeaderMap_(sheet);

    // Detect month header row: Code empty but first col or Month Group has month label
    var codeCol = colIndex_(mapCols, CONFIG.COLS.CODE);
    var codeVal = codeCol ? String(row[codeCol - 1] || '').trim() : '';
    var monthCol = colIndex_(mapCols, CONFIG.COLS.MONTH_GROUP);
    var monthVal = monthCol ? String(row[monthCol - 1] || '').trim() : '';

    if (!codeVal && monthVal) {
      currentMonth = monthVal;
      continue;
    }

    // Month separator in column A style (only location/month text in row)
    if (!codeVal && !monthVal) {
      var firstCell = String(row[0] || '').trim();
      if (firstCell && /20\d{2}/.test(firstCell)) {
        currentMonth = firstCell;
        continue;
      }
    }

    var ev = rowToEvent_(row, rowNum, mapCols);
    if (!ev) continue;

    if (!ev.monthGroup && currentMonth) {
      ev.monthGroup = currentMonth;
    }
    events.push(ev);
  }

  var monthSet = {};
  events.forEach(function (e) {
    if (e.monthGroup) monthSet[e.monthGroup] = true;
  });
  var months = Object.keys(monthSet).sort();

  return { months: months, events: events };
}

function findEventRow_(rowId, code) {
  var result = listEvents_();
  for (var i = 0; i < result.events.length; i++) {
    var e = result.events[i];
    if (rowId && e.rowId === rowId) return e;
    if (code && e.code === code) return e;
  }
  return null;
}

function updateEventFields_(rowNumber, updates) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var fieldMap = {
    lem: CONFIG.COLS.LEM,
    av: CONFIG.COLS.AV,
    interpreters: CONFIG.COLS.INTERPRETERS,
    venue: CONFIG.COLS.VENUE,
    psaCldp: CONFIG.COLS.PSA_CLDP,
    sow: CONFIG.COLS.SOW,
    notes: CONFIG.COLS.NOTES,
    ownerEmail: CONFIG.COLS.OWNER_EMAIL,
    startDate: CONFIG.COLS.START_DATE,
    endDate: CONFIG.COLS.END_DATE,
    monthGroup: CONFIG.COLS.MONTH_GROUP,
    dates: CONFIG.COLS.DATES,
    driveFolderUrl: CONFIG.COLS.DRIVE_FOLDER_URL,
    awarded: CONFIG.COLS.AWARDED,
    revenue: CONFIG.COLS.REVENUE,
    serviceReportDriveUrl: CONFIG.COLS.SERVICE_REPORT_DRIVE_URL,
    serviceReportDriveFileId: CONFIG.COLS.SERVICE_REPORT_DRIVE_FILE_ID,
    serviceReportSavedAt: CONFIG.COLS.SERVICE_REPORT_SAVED_AT,
    serviceReportSavedBy: CONFIG.COLS.SERVICE_REPORT_SAVED_BY,
  };

  Object.keys(updates).forEach(function (key) {
    var colName = fieldMap[key];
    if (!colName) return;
    var col = colIndex_(map, colName);
    if (!col) return;
    setDateSafeCell_(sheet.getRange(rowNumber, col), colName, updates[key]);
  });

  var refreshed = listEvents_().events.filter(function (e) {
    return e.rowNumber === rowNumber;
  })[0];
  return refreshed || null;
}

function createEvent_(payload) {
  if (!payload || !payload.code) {
    throw new Error('Event code required');
  }
  if (findEventRow_(null, payload.code)) {
    throw new Error('An event with code "' + payload.code + '" already exists');
  }

  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var rowId = Utilities.getUuid();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c && val !== undefined && val !== null && val !== '') {
      setDateSafeCell_(sheet.getRange(row, c), name, val);
    }
  }

  setCol(CONFIG.COLS.CODE, payload.code);
  setCol(CONFIG.COLS.LOCATION, payload.location || '');
  setCol(CONFIG.COLS.DATES, payload.dates || '');
  setCol(CONFIG.COLS.LEM, payload.lem || 'Open');
  setCol(CONFIG.COLS.AV, payload.av || '');
  setCol(CONFIG.COLS.INTERPRETERS, payload.interpreters || '');
  setCol(CONFIG.COLS.VENUE, payload.venue || '');
  setCol(CONFIG.COLS.PSA_CLDP, payload.psaCldp || '');
  setCol(CONFIG.COLS.SOW, payload.sow || '');
  setCol(CONFIG.COLS.NOTES, payload.notes || '');
  setCol(CONFIG.COLS.MONTH_GROUP, payload.monthGroup || monthGroupFromDate_(payload.startDate));
  setCol(CONFIG.COLS.START_DATE, payload.startDate || '');
  setCol(CONFIG.COLS.END_DATE, payload.endDate || payload.startDate || '');
  setCol(CONFIG.COLS.OWNER_EMAIL, payload.ownerEmail || '');
  setCol(CONFIG.COLS.ROW_ID, rowId);

  // Create Google Drive folder structure for this event
  var driveFolderUrl = createEventDriveFolders_(payload.code, payload.location || '');
  if (driveFolderUrl) {
    setCol(CONFIG.COLS.DRIVE_FOLDER_URL, driveFolderUrl);
  }

  logActivity_('event_created', payload.code, '', payload.location || '', payload.createdBy || '');

  var templateIds = payload.templateIds || [];
  var createdTasks = [];
  if (templateIds.length) {
    if (typeof applyTemplatesToEvent_ !== 'function') {
      throw new Error(
        'Task templates need TemplatesService.gs and TasksService.gs in this Apps Script project. ' +
        'Copy them from the repo (or clasp push), redeploy, or create the event without selecting templates.'
      );
    }
    var applied = applyTemplatesToEvent_(payload.code, rowId, templateIds, payload.createdBy || '');
    createdTasks = applied.tasks || [];
  } else if (typeof seedDefaultTasks_ === 'function') {
    seedDefaultTasks_(payload.code, rowId);
  }

  return {
    event: findEventRow_(rowId, payload.code),
    tasks: createdTasks,
  };
}

function deleteEvent_(rowId, code, actorEmail) {
  if (!canActor_(actorEmail, 'events.delete')) {
    throw new Error(
      'Permission denied: delete events is not enabled for your role. ' +
      'Ask an admin to enable “Delete events permanently” in Admin Panel → Permissions.',
    );
  }
  var ev = findEventRow_(rowId, code);
  if (!ev) throw new Error('Event not found');

  deleteTasksForEvent_(ev.code);

  var sheet = getEventsSheet_();
  sheet.deleteRow(ev.rowNumber);
  logActivity_('event_deleted', ev.code, '', ev.location || '', actorEmail || '');
  return { ok: true, code: ev.code };
}

var MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

function monthGroupFromDate_(startDate) {
  // Plain "yyyy-MM-dd..." string (the normal case — what the web/iOS clients
  // always send): read the calendar month directly off the text. Avoids
  // ever routing a date-only string through a Date object, whose timezone
  // handling is exactly what causes the day/month to drift (see getSheetTz_).
  var m = String(startDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return MONTH_NAMES_[Number(m[2]) - 1] + ' ' + m[1];

  // Fallback: an actual Date object (e.g. a legacy Sheets-auto-converted cell).
  var d = parseDate_(startDate);
  if (!d) return '';
  return Utilities.formatDate(d, getSheetTz_(), 'MMMM yyyy');
}

function setLastReminder_(rowNumber, value) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var col = colIndex_(map, CONFIG.COLS.LAST_REMINDER);
  if (col) {
    sheet.getRange(rowNumber, col).setValue(value);
  }
}

function parseDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }
  var s = String(value).trim();
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function daysUntil_(date) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function isMissingSow_(sow) {
  var s = String(sow || '').trim().toLowerCase();
  return !s || s === '??' || s === 'n/a' || s === '-';
}

function isMissingVenue_(venue) {
  return !String(venue || '').trim();
}

function isLemOpen_(lem) {
  var s = String(lem || '').trim().toLowerCase();
  return s !== 'closed';
}

var MONTH_INDEX_ = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parses the human "Dates" label (e.g. "15-09-2026 – 16-09-2026" or
 * "Jun 10–11, 2026") back into ISO start/end — the same formats the web
 * client's calendarDates.ts::parseDatesLabel understands. This text column
 * is never auto-converted to a Date by Sheets (it doesn't look like one),
 * so it's the reliable ground truth used by repairEventDates_ to fix rows
 * whose Start Date/End Date/Month Group drifted from the old Date-cell bug.
 */
function parseDatesLabel_(dates, monthGroup) {
  var cleaned = String(dates || '').replace(/[–—]/g, '-').trim();
  if (!cleaned) return null;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var displayRange = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (displayRange) {
    return {
      start: displayRange[3] + '-' + pad2(Number(displayRange[2])) + '-' + pad2(Number(displayRange[1])),
      end: displayRange[6] + '-' + pad2(Number(displayRange[5])) + '-' + pad2(Number(displayRange[4])),
    };
  }

  var displaySingle = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (displaySingle) {
    var iso = displaySingle[3] + '-' + pad2(Number(displaySingle[2])) + '-' + pad2(Number(displaySingle[1]));
    return { start: iso, end: iso };
  }

  var yearFromGroup = (function () {
    var m = String(monthGroup || '').match(/\b(20\d{2})\b/);
    return m ? Number(m[1]) : null;
  })();

  var rangeMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})(?:,\s*(20\d{2}))?$/);
  if (rangeMatch) {
    var mi = MONTH_INDEX_[rangeMatch[1].trim().toLowerCase()];
    if (mi == null) return null;
    var year = rangeMatch[4] ? Number(rangeMatch[4]) : yearFromGroup;
    if (!year) return null;
    return {
      start: year + '-' + pad2(mi + 1) + '-' + pad2(Number(rangeMatch[2])),
      end: year + '-' + pad2(mi + 1) + '-' + pad2(Number(rangeMatch[3])),
    };
  }

  var singleMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(20\d{2}))?$/);
  if (singleMatch) {
    var mi2 = MONTH_INDEX_[singleMatch[1].trim().toLowerCase()];
    if (mi2 == null) return null;
    var year2 = singleMatch[3] ? Number(singleMatch[3]) : yearFromGroup;
    if (!year2) return null;
    var iso2 = year2 + '-' + pad2(mi2 + 1) + '-' + pad2(Number(singleMatch[2]));
    return { start: iso2, end: iso2 };
  }

  return null;
}

/**
 * Repairs Start Date/End Date/Month Group for events whose value drifted
 * from the old Sheets-auto-Date-conversion timezone bug (fixed above by
 * setDateSafeCell_/getSheetTz_) — re-derives them from the event's Dates
 * text label, which is stored as plain text and was never affected.
 * Pass apply=true to actually write fixes; otherwise this only reports
 * what it would change.
 */
function repairEventDates_(apply) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var changed = [];
  var checked = 0;

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      var ev = rowToEvent_(data[i], i + 2, map);
      if (!ev) continue;
      checked++;

      var correct = parseDatesLabel_(ev.dates, ev.monthGroup);
      if (!correct) continue; // can't determine ground truth — leave alone

      var correctMonthGroup = monthGroupFromDate_(correct.start);
      var needsFix =
        correct.start !== ev.startDate ||
        correct.end !== ev.endDate ||
        (correctMonthGroup && correctMonthGroup !== ev.monthGroup);
      if (!needsFix) continue;

      changed.push({
        code: ev.code,
        before: { startDate: ev.startDate, endDate: ev.endDate, monthGroup: ev.monthGroup },
        after: { startDate: correct.start, endDate: correct.end, monthGroup: correctMonthGroup },
      });

      if (apply) {
        updateEventFields_(ev.rowNumber, {
          startDate: correct.start,
          endDate: correct.end,
          monthGroup: correctMonthGroup,
        });
      }
    }
  }

  return { checked: checked, changed: changed, applied: !!apply, sheetTimeZone: getSheetTz_() };
}
