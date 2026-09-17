var COST_ITEM_COLS = {
  COST_ITEM_ID: 'Cost Item ID',
  EVENT_CODE: 'Event Code',
  EVENT_ROW_ID: 'Event Row ID',
  CATEGORY: 'Category',
  DESCRIPTION: 'Description',
  QUANTITY: 'Quantity',
  UNIT_RATE: 'Unit Rate',
  CURRENCY: 'Currency',
  VENDOR_NAME: 'Vendor Name',
  NOTES: 'Notes',
  CREATED_BY: 'Created By',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
};

var DEFAULT_COST_ITEM_CURRENCY = 'USD';

function getCostItemsSheet_() {
  return getOrCreateSheet_(CONFIG.COST_ITEMS_SHEET, Object.values(COST_ITEM_COLS));
}

function listCostItems_(eventCode, eventRowId) {
  var sheet = getCostItemsSheet_();
  var map = getHeaderMap_(sheet);
  return listCostItemsFromSheet_(sheet, map, eventCode, eventRowId);
}

function listCostItemsFromSheet_(sheet, map, eventCode, eventRowId) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var items = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var item = rowToCostItem_(row, map, i + 2);
    if (!item) continue;
    if (eventCode && item.eventCode !== eventCode) continue;
    if (eventRowId && item.eventRowId && item.eventRowId !== eventRowId) continue;
    items.push(item);
  }
  return items;
}

function rowToCostItem_(row, map, rowNum) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var costItemId = cell(COST_ITEM_COLS.COST_ITEM_ID);
  if (!costItemId) return null;

  var quantity = parseFloat(cell(COST_ITEM_COLS.QUANTITY)) || 0;
  var unitRate = parseFloat(cell(COST_ITEM_COLS.UNIT_RATE)) || 0;

  return {
    costItemId: costItemId,
    eventCode: cell(COST_ITEM_COLS.EVENT_CODE),
    eventRowId: cell(COST_ITEM_COLS.EVENT_ROW_ID),
    category: cell(COST_ITEM_COLS.CATEGORY),
    description: cell(COST_ITEM_COLS.DESCRIPTION),
    quantity: quantity,
    unitRate: unitRate,
    currency: cell(COST_ITEM_COLS.CURRENCY) || DEFAULT_COST_ITEM_CURRENCY,
    total: quantity * unitRate,
    vendorName: cell(COST_ITEM_COLS.VENDOR_NAME),
    notes: cell(COST_ITEM_COLS.NOTES),
    createdBy: cell(COST_ITEM_COLS.CREATED_BY),
    createdAt: cell(COST_ITEM_COLS.CREATED_AT),
    updatedAt: cell(COST_ITEM_COLS.UPDATED_AT),
    rowNumber: rowNum,
  };
}

function createCostItem_(payload) {
  var sheet = getCostItemsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var now = new Date().toISOString();
  var costItemId = Utilities.getUuid();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(COST_ITEM_COLS.COST_ITEM_ID, costItemId);
  setCol(COST_ITEM_COLS.EVENT_CODE, payload.eventCode);
  setCol(COST_ITEM_COLS.EVENT_ROW_ID, payload.eventRowId || '');
  setCol(COST_ITEM_COLS.CATEGORY, payload.category || 'General');
  setCol(COST_ITEM_COLS.DESCRIPTION, payload.description || '');
  setCol(COST_ITEM_COLS.QUANTITY, payload.quantity != null ? payload.quantity : 1);
  setCol(COST_ITEM_COLS.UNIT_RATE, payload.unitRate != null ? payload.unitRate : 0);
  setCol(COST_ITEM_COLS.CURRENCY, payload.currency || DEFAULT_COST_ITEM_CURRENCY);
  setCol(COST_ITEM_COLS.VENDOR_NAME, payload.vendorName || '');
  setCol(COST_ITEM_COLS.NOTES, payload.notes || '');
  setCol(COST_ITEM_COLS.CREATED_BY, payload.createdBy || '');
  setCol(COST_ITEM_COLS.CREATED_AT, now);
  setCol(COST_ITEM_COLS.UPDATED_AT, now);

  logActivity_('cost_item_created', payload.eventCode, costItemId, payload.description || payload.category, payload.createdBy);
  return findCostItem_(costItemId);
}

function findCostItem_(costItemId) {
  var sheet = getCostItemsSheet_();
  var items = listCostItemsFromSheet_(sheet, getHeaderMap_(sheet), null, null);
  for (var i = 0; i < items.length; i++) {
    if (items[i].costItemId === costItemId) return items[i];
  }
  return null;
}

function updateCostItem_(costItemId, updates, actorEmail) {
  var item = findCostItem_(costItemId);
  if (!item) throw new Error('Cost item not found');

  var sheet = getCostItemsSheet_();
  var map = getHeaderMap_(sheet);
  var fieldMap = {
    category: COST_ITEM_COLS.CATEGORY,
    description: COST_ITEM_COLS.DESCRIPTION,
    quantity: COST_ITEM_COLS.QUANTITY,
    unitRate: COST_ITEM_COLS.UNIT_RATE,
    currency: COST_ITEM_COLS.CURRENCY,
    vendorName: COST_ITEM_COLS.VENDOR_NAME,
    notes: COST_ITEM_COLS.NOTES,
  };

  Object.keys(updates).forEach(function (key) {
    var colName = fieldMap[key];
    if (!colName) return;
    var col = colIndex_(map, colName);
    if (col) sheet.getRange(item.rowNumber, col).setValue(updates[key]);
  });

  var updatedCol = colIndex_(map, COST_ITEM_COLS.UPDATED_AT);
  if (updatedCol) sheet.getRange(item.rowNumber, updatedCol).setValue(new Date().toISOString());

  logActivity_('cost_item_updated', item.eventCode, costItemId, item.description || item.category, actorEmail || '');
  return findCostItem_(costItemId);
}

/** Permanently removes a single cost item row. Admin-only (checked by caller). */
function deleteCostItem_(costItemId, actorEmail) {
  var item = findCostItem_(costItemId);
  if (!item) throw new Error('Cost item not found');

  getCostItemsSheet_().deleteRow(item.rowNumber);
  logActivity_('cost_item_deleted', item.eventCode, costItemId, item.description || item.category, actorEmail || '');
  return { ok: true };
}
