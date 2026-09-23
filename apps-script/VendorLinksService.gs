var VENDOR_LINK_COLS = {
  LINK_ID: 'Link ID',
  TOKEN: 'Token',
  EVENT_CODE: 'Event Code',
  EVENT_ROW_ID: 'Event Row ID',
  LABEL: 'Label',
  VENDOR_CATEGORY: 'Vendor Category',
  VENDOR_NAME: 'Vendor Name',
  PERMISSION: 'Permission',
  CREATED_AT: 'Created At',
  CREATED_BY: 'Created By',
  ACTIVE: 'Active',
};

function getVendorLinksSheet_() {
  return getOrCreateSheet_(CONFIG.VENDOR_LINKS_SHEET, Object.values(VENDOR_LINK_COLS));
}

function listVendorLinks_(eventCode) {
  var sheet = getVendorLinksSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var links = [];
  for (var i = 0; i < data.length; i++) {
    var link = rowToVendorLink_(data[i], map);
    if (!link) continue;
    if (eventCode && link.eventCode !== eventCode) continue;
    links.push(link);
  }
  return links;
}

function rowToVendorLink_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }
  var id = cell(VENDOR_LINK_COLS.LINK_ID);
  if (!id) return null;
  return {
    linkId: id,
    token: cell(VENDOR_LINK_COLS.TOKEN),
    eventCode: cell(VENDOR_LINK_COLS.EVENT_CODE),
    eventRowId: cell(VENDOR_LINK_COLS.EVENT_ROW_ID),
    label: cell(VENDOR_LINK_COLS.LABEL),
    vendorCategory: cell(VENDOR_LINK_COLS.VENDOR_CATEGORY),
    vendorName: cell(VENDOR_LINK_COLS.VENDOR_NAME),
    permission: cell(VENDOR_LINK_COLS.PERMISSION) || 'view',
    createdAt: cell(VENDOR_LINK_COLS.CREATED_AT),
    createdBy: cell(VENDOR_LINK_COLS.CREATED_BY),
    active: cell(VENDOR_LINK_COLS.ACTIVE) || 'yes',
  };
}

function findVendorLinkByToken_(token) {
  if (!token) return null;
  var all = listVendorLinks_(null);
  for (var i = 0; i < all.length; i++) {
    if (all[i].token === token && String(all[i].active).toLowerCase() !== 'no') {
      return all[i];
    }
  }
  return null;
}

function getOrCreateVendorLink_(eventCode, eventRowId, actorEmail, options) {
  options = options || {};
  var category = String(options.vendorCategory || '').trim();
  var vendorName = String(options.vendorName || '').trim();
  var permission = String(options.permission || 'view').toLowerCase();
  if (permission !== 'collaborate') permission = 'view';

  var existing = listVendorLinks_(eventCode);
  for (var i = 0; i < existing.length; i++) {
    if (
      String(existing[i].active).toLowerCase() === 'yes' &&
      String(existing[i].vendorCategory || '') === category
    ) {
      return existing[i];
    }
  }

  var event = findEventRow_(eventRowId, eventCode);
  if (!event) throw new Error('Event not found');

  var sheet = getVendorLinksSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var linkId = Utilities.getUuid();
  var token = Utilities.getUuid().replace(/-/g, '');
  var now = new Date().toISOString();
  var label = options.label
    || (vendorName ? vendorName + ' portal'
      : (category ? category + ' portal' : 'Vendor portal'));

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(VENDOR_LINK_COLS.LINK_ID, linkId);
  setCol(VENDOR_LINK_COLS.TOKEN, token);
  setCol(VENDOR_LINK_COLS.EVENT_CODE, event.code);
  setCol(VENDOR_LINK_COLS.EVENT_ROW_ID, event.rowId);
  setCol(VENDOR_LINK_COLS.LABEL, label);
  setCol(VENDOR_LINK_COLS.VENDOR_CATEGORY, category);
  setCol(VENDOR_LINK_COLS.VENDOR_NAME, vendorName);
  setCol(VENDOR_LINK_COLS.PERMISSION, permission);
  setCol(VENDOR_LINK_COLS.CREATED_AT, now);
  setCol(VENDOR_LINK_COLS.CREATED_BY, actorEmail || '');
  setCol(VENDOR_LINK_COLS.ACTIVE, 'yes');

  var summary = category
    ? category + ' link created'
    : (vendorName ? vendorName + ' link created' : 'Vendor link created');
  logActivity_('vendor_link_created', event.code, '', summary, actorEmail || '');
  return findVendorLinkByToken_(token);
}

function regenerateVendorLink_(eventCode, eventRowId, actorEmail, options) {
  options = options || {};
  var category = String(options.vendorCategory || '').trim();

  var sheet = getVendorLinksSheet_();
  var map = getHeaderMap_(sheet);
  var activeCol = colIndex_(map, VENDOR_LINK_COLS.ACTIVE);
  var catCol = colIndex_(map, VENDOR_LINK_COLS.VENDOR_CATEGORY);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1 && activeCol) {
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    var codeCol = colIndex_(map, VENDOR_LINK_COLS.EVENT_CODE);
    for (var r = 0; r < data.length; r++) {
      if (codeCol && String(data[r][codeCol - 1]) === eventCode) {
        var rowCat = catCol ? String(data[r][catCol - 1] || '') : '';
        if (rowCat === category) {
          sheet.getRange(r + 2, activeCol).setValue('no');
        }
      }
    }
  }
  return getOrCreateVendorLink_(eventCode, eventRowId, actorEmail, options);
}

function revokeVendorLink_(linkId, actorEmail) {
  var sheet = getVendorLinksSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: false };
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var idCol = colIndex_(map, VENDOR_LINK_COLS.LINK_ID);
  var activeCol = colIndex_(map, VENDOR_LINK_COLS.ACTIVE);
  var codeCol = colIndex_(map, VENDOR_LINK_COLS.EVENT_CODE);
  if (!idCol || !activeCol) return { ok: false };
  for (var r = 0; r < data.length; r++) {
    if (String(data[r][idCol - 1]) === linkId) {
      sheet.getRange(r + 2, activeCol).setValue('no');
      var ev = codeCol ? String(data[r][codeCol - 1] || '') : '';
      logActivity_('vendor_link_revoked', ev, '', 'Vendor link revoked', actorEmail || '');
      return { ok: true };
    }
  }
  return { ok: false };
}

function isVendorVisibleTask_(task) {
  var v = String(task.vendorVisible || 'yes').toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

function getVendorWorkspace_(token) {
  var link = findVendorLinkByToken_(token);
  if (!link) {
    throw new Error('This vendor link is invalid or has expired.');
  }

  // Strict resolution: ALWAYS use the eventCode/eventRowId from the link itself.
  // Never fall back to another event.
  var event = findEventRow_(link.eventRowId, link.eventCode);
  if (!event) {
    throw new Error('Vendor link points to event ' + link.eventCode + ', which no longer exists.');
  }

  // Defence in depth: if the resolved event somehow doesn't match the link,
  // refuse rather than silently leak data from another event.
  if (link.eventCode && event.code !== link.eventCode) {
    throw new Error('Vendor link integrity error: event mismatch.');
  }

  // Only this event's vendor-visible tasks.
  var allTasks = listTasks_(event.code, event.rowId);
  var category = String(link.vendorCategory || '').toLowerCase();
  var tasks = allTasks
    .filter(function (t) {
      if (t.eventCode !== event.code) return false;
      if (!isVendorVisibleTask_(t)) return false;
      if (category && String(t.category || '').toLowerCase() !== category) return false;
      return true;
    })
    .map(function (t) {
      return {
        taskId: t.taskId,
        title: t.title,
        category: t.category,
        instructions: t.instructions || '',
        status: t.status,
      };
    });

  var taskIds = {};
  tasks.forEach(function (t) {
    taskIds[t.taskId] = true;
  });

  // Files filtered by both event code (primary) and task ID (secondary).
  var allFiles = listFiles_(event.code, null);
  var files = allFiles
    .filter(function (f) {
      return f.eventCode === event.code && taskIds[f.taskId];
    })
    .map(function (f) {
      return {
        fileId: f.fileId,
        taskId: f.taskId,
        fileName: f.fileName,
        mimeType: f.mimeType,
        driveUrl: f.driveUrl,
        sizeBytes: f.sizeBytes,
      };
    });

  // Cost items scoped by vendor category, when set — but unlike tasks (whose
  // category is the exact free-text label the vendor link was scoped from),
  // a generator (e.g. AV Equipment) tags its synced cost items with its own
  // fixed category strings ("AV Equipment", "AV Supplies"), not whatever the
  // team happens to call the matching task category ("AV"). Match by prefix
  // so a link scoped to "AV" still sees/quotes those lines.
  var allCostItems = listCostItems_(event.code, event.rowId);
  var costItems = allCostItems.filter(function (c) {
    return costItemCategoryInVendorScope_(c.category, link.vendorCategory);
  });

  return {
    event: {
      code: event.code,
      location: event.location,
      dates: event.dates,
      venue: event.venue,
      monthGroup: event.monthGroup,
    },
    tasks: tasks,
    files: files,
    costItems: costItems,
    linkLabel: link.label,
    vendorCategory: link.vendorCategory || '',
    vendorName: link.vendorName || '',
    permission: link.permission || 'view',
  };
}

/** True when a cost item's category is in scope for a vendor link's category.
 * Prefix match (either way, case-insensitive) rather than exact — see the
 * comment in getVendorWorkspace_ for why cost item categories don't always
 * equal the vendor link's category string verbatim. An empty link category
 * (full-event link) is unrestricted, matching every other scope check here. */
function costItemCategoryInVendorScope_(itemCategory, linkCategory) {
  var link = String(linkCategory || '').trim().toLowerCase();
  if (!link) return true;
  var item = String(itemCategory || '').trim().toLowerCase();
  return item === link || item.indexOf(link) === 0 || link.indexOf(item) === 0;
}

/** True for a task in this vendor link's visible-task set (same rule getVendorWorkspace_ uses). */
function isTaskVisibleToVendorLink_(task, link) {
  if (!task || task.eventCode !== link.eventCode) return false;
  if (!isVendorVisibleTask_(task)) return false;
  var category = String(link.vendorCategory || '').toLowerCase();
  if (category && String(task.category || '').toLowerCase() !== category) return false;
  return true;
}

/** Identifying label written to Created By / Uploaded By for anything a vendor submits. */
function vendorActorLabel_(link) {
  return 'vendor:' + (link.vendorName || link.vendorCategory || 'unknown');
}
