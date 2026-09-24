/**
 * UsefulLinksService — a short, admin-curated list of external websites the
 * team finds useful (venue directories, vendor portals, reference tools,
 * etc.). Unlike Org Templates, there's no file/Drive involvement at all —
 * just a title + URL any admin can add, edit, or remove; every signed-in
 * team member can see and open them.
 *
 * Useful Links sheet columns: ID | Title | URL | Notes | Added By | Added At
 */

var USEFUL_LINKS_SHEET_ = 'Useful Links';
var USEFUL_LINK_COLS_ = {
  ID: 'ID',
  TITLE: 'Title',
  URL: 'URL',
  NOTES: 'Notes',
  ADDED_BY: 'Added By',
  ADDED_AT: 'Added At',
};

function getUsefulLinksSheet_() {
  return getOrCreateSheet_(USEFUL_LINKS_SHEET_, Object.values(USEFUL_LINK_COLS_));
}

function rowToUsefulLink_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }
  var id = cell(USEFUL_LINK_COLS_.ID);
  if (!id) return null;
  return {
    id: id,
    title: cell(USEFUL_LINK_COLS_.TITLE),
    url: cell(USEFUL_LINK_COLS_.URL),
    notes: cell(USEFUL_LINK_COLS_.NOTES),
    addedBy: cell(USEFUL_LINK_COLS_.ADDED_BY),
    addedAt: cell(USEFUL_LINK_COLS_.ADDED_AT),
  };
}

function listUsefulLinks_() {
  var sheet = getUsefulLinksSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var map = getHeaderMap_(sheet);
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var links = [];
  for (var i = 0; i < data.length; i++) {
    var l = rowToUsefulLink_(data[i], map);
    if (l) links.push(l);
  }
  return links;
}

/** Find the sheet row number for a given link ID (2-indexed row), or 0. */
function findUsefulLinkRow_(sheet, map, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var idCol = colIndex_(map, USEFUL_LINK_COLS_.ID);
  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

/** Creates a new link, or edits an existing one when payload.id matches a row. */
function upsertUsefulLink_(payload) {
  var title = String(payload.title || '').trim();
  var url = String(payload.url || '').trim();
  if (!title || !url) throw new Error('title and url required');

  var sheet = getUsefulLinksSheet_();
  var map = getHeaderMap_(sheet);
  var rowNum = payload.id ? findUsefulLinkRow_(sheet, map, payload.id) : 0;
  var now = new Date().toISOString();

  if (rowNum) {
    sheet.getRange(rowNum, colIndex_(map, USEFUL_LINK_COLS_.TITLE)).setValue(title);
    sheet.getRange(rowNum, colIndex_(map, USEFUL_LINK_COLS_.URL)).setValue(url);
    sheet.getRange(rowNum, colIndex_(map, USEFUL_LINK_COLS_.NOTES)).setValue(payload.notes || '');
    sheet.getRange(rowNum, colIndex_(map, USEFUL_LINK_COLS_.ADDED_BY)).setValue(payload.actorEmail || '');
    sheet.getRange(rowNum, colIndex_(map, USEFUL_LINK_COLS_.ADDED_AT)).setValue(now);
    logActivity_('useful_link_updated', '', '', title, payload.actorEmail || '');
  } else {
    var id = 'link-' + Utilities.getUuid().slice(0, 8);
    sheet.appendRow([id, title, url, payload.notes || '', payload.actorEmail || '', now]);
    rowNum = sheet.getLastRow();
    logActivity_('useful_link_added', '', '', title, payload.actorEmail || '');
  }

  map = getHeaderMap_(sheet);
  return rowToUsefulLink_(sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0], map);
}

function deleteUsefulLink_(id, actorEmail) {
  var sheet = getUsefulLinksSheet_();
  var map = getHeaderMap_(sheet);
  var rowNum = findUsefulLinkRow_(sheet, map, id);
  if (!rowNum) throw new Error('Not found');
  sheet.deleteRow(rowNum);
  logActivity_('useful_link_deleted', '', '', id, actorEmail || '');
  return { ok: true };
}
