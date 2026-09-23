function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return {};
}

/** GET ?payload={json} — used by static frontends (GitHub Pages) where POST hits CORS. */
function parseGetPayload_(e) {
  var raw = e && e.parameter && e.parameter.payload;
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (err1) {
    try {
      return JSON.parse(raw);
    } catch (err2) {
      return {};
    }
  }
}

function hasGetPayload_(e) {
  return !!(e && e.parameter && e.parameter.payload);
}

function acceptsWrite_(method, e) {
  return method === 'POST' || hasGetPayload_(e);
}

function getActorEmail_(body, e) {
  if (body && body.actorEmail) return body.actorEmail;
  if (e && e.parameter && e.parameter.actorEmail) return e.parameter.actorEmail;
  return '';
}

function handleRequest_(e, method) {
  try {
    var body = method === 'POST' ? parseBody_(e) : parseGetPayload_(e);
    var action = (e && e.parameter && e.parameter.action) || body.action || '';
    var vendorToken =
      (e && e.parameter && e.parameter.vendorToken) || body.vendorToken || '';

    // ——— Vendor portal (no API token) ———
    if (vendorToken || action === 'vendorWorkspace') {
      return handleVendorRequest_(vendorToken || body.vendorToken, action, body);
    }

    if (!verifyToken_(e)) {
      return jsonResponse_({ error: 'Unauthorized' }, 401);
    }

    var actorEmail = getActorEmail_(body, e);

    // ——— Auth check ———
    if (action === 'whoami') {
      return jsonResponse_({
        isAdmin: isAdmin_(actorEmail),
        email: actorEmail,
      });
    }

    // ——— Events ———
    if (action === 'list' || action === '' || !action) {
      return jsonResponse_(listEvents_());
    }

    if (action === 'get') {
      var code = e.parameter.code || body.code || '';
      var rowId = e.parameter.rowId || body.rowId || '';
      var ev = findEventRow_(rowId, code);
      if (!ev) return jsonResponse_({ error: 'Not found' }, 404);
      return jsonResponse_(ev);
    }

    if (action === 'update' && acceptsWrite_(method, e)) {
      var target = findEventRow_(body.rowId, body.code);
      if (!target) return jsonResponse_({ error: 'Not found' }, 404);
      var updates = body.updates || {};
      if (updates.ownerEmail !== undefined && !canActor_(actorEmail, 'events.assign')) {
        return jsonResponse_(
          { error: 'Permission denied: change assigned member is not enabled for your role' },
          403,
        );
      }
      if (updates.awarded !== undefined && !isAdmin_(actorEmail)) {
        return jsonResponse_(
          { error: 'Permission denied: only admins can change Awarded status' },
          403,
        );
      }
      if (updates.revenue !== undefined && !isAdmin_(actorEmail)) {
        return jsonResponse_(
          { error: 'Permission denied: only admins can change Revenue' },
          403,
        );
      }
      if (updates.completed !== undefined && !isAdmin_(actorEmail)) {
        return jsonResponse_(
          { error: 'Permission denied: only admins can change Completed status' },
          403,
        );
      }
      updateEventFields_(target.rowNumber, updates);
      return jsonResponse_(findEventRow_(target.rowId, target.code));
    }

    if (action === 'eventCreate' && acceptsWrite_(method, e)) {
      body.createdBy = actorEmail || body.createdBy || '';
      return jsonResponse_(createEvent_(body));
    }

    if (action === 'eventDelete' && acceptsWrite_(method, e)) {
      return jsonResponse_(
        deleteEvent_(body.rowId, body.code, actorEmail),
      );
    }

    // Maintenance: re-derive Start/End Date + Month Group from each event's
    // (reliable, plain-text) Dates label. Admin-only; POST {apply:true} to
    // actually write fixes, otherwise it only reports what would change.
    if (action === 'eventDatesRepair' && method === 'POST') {
      requireAdmin_(actorEmail);
      return jsonResponse_(repairEventDates_(body.apply === true));
    }

    if (action === 'workspace') {
      var eventCode = e.parameter.eventCode || body.eventCode || '';
      var eventRowId = e.parameter.eventRowId || body.eventRowId || '';
      var event = findEventRow_(eventRowId, eventCode);
      if (!event) return jsonResponse_({ error: 'Event not found' }, 404);
      return jsonResponse_({
        event: event,
        tasks: listTasks_(event.code, event.rowId),
        comments: listComments_(event.code, null),
        files: listFiles_(event.code, null),
        activity: listActivity_(event.code, 50),
        vendorLink: getActiveVendorLinkForEvent_(event.code),
        costItems: listCostItems_(event.code, event.rowId),
      });
    }

    // ——— Task templates ———
    if (action === 'templatesList') {
      var withFiles = e.parameter.withFiles === 'true' || body.withFiles === true;
      if (withFiles) {
        return jsonResponse_({ templates: listTemplatesWithFiles_(true) });
      }
      return jsonResponse_({ templates: listTemplates_(true) });
    }

    if (action === 'templateGet') {
      var tid = e.parameter.templateId || body.templateId || '';
      var data = getTemplateWithFiles_(tid);
      if (!data) return jsonResponse_({ error: 'Not found' }, 404);
      return jsonResponse_(data);
    }

    if (action === 'templateCreate' && method === 'POST') {
      requireAdmin_(actorEmail);
      return jsonResponse_(createTemplate_(body));
    }

    if (action === 'templateUpdate' && method === 'POST') {
      return jsonResponse_(updateTemplate_(body.templateId, body.updates || {}, actorEmail));
    }

    if (action === 'templateDelete' && method === 'POST') {
      return jsonResponse_(deleteTemplate_(body.templateId, actorEmail));
    }

    if (action === 'templateFileUpload' && method === 'POST') {
      body.uploadedBy = actorEmail;
      body.actorEmail = actorEmail;
      return jsonResponse_(uploadTemplateFile_(body));
    }

    if (action === 'templateFileDelete' && method === 'POST') {
      return jsonResponse_(deleteTemplateFile_(body.fileId, actorEmail));
    }

    if (action === 'applyTemplates' && acceptsWrite_(method, e)) {
      return jsonResponse_(
        applyTemplatesToEvent_(body.eventCode, body.eventRowId, body.templateIds || [], actorEmail)
      );
    }

    // ——— Org templates (shared print/social/forms library) ———
    if (action === 'orgTemplatesList') {
      return jsonResponse_({ templates: listOrgTemplates_() });
    }

    if (action === 'orgTemplateUpload' && acceptsWrite_(method, e)) {
      requireAdmin_(actorEmail);
      body.actorEmail = actorEmail;
      return jsonResponse_(upsertOrgTemplateFile_(body));
    }

    if (action === 'orgTemplateDelete' && method === 'POST') {
      requireAdmin_(actorEmail);
      return jsonResponse_(deleteOrgTemplateEntry_(body.id, actorEmail));
    }

    // ——— Vendor links (team) ———
    if (action === 'vendorLinksList') {
      if (typeof listVendorLinks_ !== 'function') {
        return jsonResponse_({ links: [] });
      }
      var listEc = e.parameter.eventCode || body.eventCode || '';
      var allLinks = listVendorLinks_(listEc).filter(function (l) {
        return String(l.active).toLowerCase() === 'yes';
      });
      return jsonResponse_({ links: allLinks });
    }

    if (action === 'vendorLinkGet') {
      if (typeof getOrCreateVendorLink_ !== 'function') {
        return jsonResponse_({
          error: 'VendorLinksService.gs is missing from this Apps Script project. Copy it from the repo and redeploy.',
        }, 500);
      }
      var ec = e.parameter.eventCode || body.eventCode || '';
      var er = e.parameter.eventRowId || body.eventRowId || '';
      var opts = {
        vendorCategory: e.parameter.vendorCategory || body.vendorCategory || '',
        vendorName: e.parameter.vendorName || body.vendorName || '',
        permission: e.parameter.permission || body.permission || 'view',
        label: e.parameter.label || body.label || '',
      };
      return jsonResponse_({ link: getOrCreateVendorLink_(ec, er, actorEmail, opts) });
    }

    if (action === 'vendorLinkRegenerate' && method === 'POST') {
      return jsonResponse_({
        link: regenerateVendorLink_(body.eventCode, body.eventRowId, actorEmail, {
          vendorCategory: body.vendorCategory || '',
          vendorName: body.vendorName || '',
          permission: body.permission || 'view',
          label: body.label || '',
        }),
      });
    }

    if (action === 'vendorLinkRevoke' && method === 'POST') {
      return jsonResponse_(revokeVendorLink_(body.linkId, actorEmail));
    }

    // ——— Tasks ———
    if (action === 'tasksList') {
      return jsonResponse_({
        tasks: listTasks_(e.parameter.eventCode || body.eventCode, e.parameter.eventRowId || body.eventRowId),
      });
    }

    if (action === 'taskCreate' && method === 'POST') {
      return jsonResponse_(createTask_(body));
    }

    if (action === 'taskUpdate' && acceptsWrite_(method, e)) {
      return jsonResponse_(updateTask_(body.taskId, body.updates || {}, actorEmail));
    }

    // ——— Cost items (event financials) ———
    if (action === 'costItemsList') {
      return jsonResponse_({
        costItems: listCostItems_(e.parameter.eventCode || body.eventCode, e.parameter.eventRowId || body.eventRowId),
      });
    }

    if (action === 'costItemCreate' && acceptsWrite_(method, e)) {
      return jsonResponse_(createCostItem_(body));
    }

    if (action === 'costItemUpdate' && acceptsWrite_(method, e)) {
      return jsonResponse_(updateCostItem_(body.costItemId, body.updates || {}, actorEmail));
    }

    if (action === 'costItemDelete' && method === 'POST') {
      return jsonResponse_(deleteCostItem_(body.costItemId, actorEmail));
    }

    // ——— Comments ———
    if (action === 'commentsList') {
      return jsonResponse_({
        comments: listComments_(e.parameter.eventCode || body.eventCode, e.parameter.taskId || body.taskId || null),
      });
    }

    if (action === 'commentAdd' && method === 'POST') {
      return jsonResponse_(addComment_(body));
    }

    // ——— Files ———
    if (action === 'filesList') {
      return jsonResponse_({
        files: listFiles_(e.parameter.eventCode || body.eventCode, e.parameter.taskId || body.taskId || null),
      });
    }

    if (action === 'fileUpload' && acceptsWrite_(method, e)) {
      return jsonResponse_(uploadFile_(body));
    }

    if (action === 'fileDelete' && method === 'POST') {
      return jsonResponse_(deleteFile_(body.fileId, actorEmail));
    }

    if (action === 'transferListSave' && acceptsWrite_(method, e)) {
      body.uploadedBy = actorEmail || body.uploadedBy || '';
      body.actorEmail = actorEmail;
      return jsonResponse_(uploadTransferList_(body));
    }

    if (action === 'avEquipmentSave' && acceptsWrite_(method, e)) {
      body.uploadedBy = actorEmail || body.uploadedBy || '';
      body.actorEmail = actorEmail;
      return jsonResponse_(uploadAVEquipment_(body));
    }

    if (action === 'serviceReportSave' && acceptsWrite_(method, e)) {
      body.uploadedBy = actorEmail || body.uploadedBy || '';
      body.actorEmail = actorEmail;
      return jsonResponse_(uploadServiceReport_(body));
    }

    // ——— Team ———
    if (action === 'activity') {
      return jsonResponse_({
        activity: listActivity_(e.parameter.eventCode || body.eventCode || null, Number(e.parameter.limit) || 30),
      });
    }

    if (action === 'team') {
      return jsonResponse_(getTeamOverview_());
    }

    if (action === 'digest') {
      return jsonResponse_(generateWeeklyDigest_());
    }

    if (action === 'health') {
      return jsonResponse_({ ok: true, time: new Date().toISOString() });
    }

    if (action === 'dashboardHealth') {
      var allTasks = listTasks_(null, null);
      var tasksByEvent = {};
      allTasks.forEach(function (t) {
        var code = t.eventCode || '';
        if (!tasksByEvent[code]) tasksByEvent[code] = [];
        tasksByEvent[code].push({ status: t.status, dueDate: t.dueDate });
      });

      var allFiles = listFiles_(null, null);
      var fileCountByEvent = {};
      allFiles.forEach(function (f) {
        var code = f.eventCode || '';
        fileCountByEvent[code] = (fileCountByEvent[code] || 0) + 1;
      });

      return jsonResponse_({ tasksByEvent: tasksByEvent, fileCountByEvent: fileCountByEvent });
    }

    // ——— Accounts ———
    if (action === 'authList') {
      return jsonResponse_({ accounts: listAccounts_() });
    }

    if (action === 'authCheckEmail') {
      var checkEmail = (e.parameter && e.parameter.email) || body.email || '';
      var found = findAccountRow_(checkEmail);
      return jsonResponse_({ exists: !!found });
    }

    if (action === 'authRegister' && acceptsWrite_(method, e)) {
      return jsonResponse_(registerAccount_(body.name, body.email, body.passwordHash));
    }

    if (action === 'authLogin' && method === 'POST') {
      var loginResult = verifyAccount_(body.email, body.passwordHash);
      return jsonResponse_({ account: loginResult });
    }

    if (action === 'authChangePassword' && method === 'POST') {
      changeAccountPassword_(body.email, body.newHash);
      return jsonResponse_({ ok: true });
    }

    // ——— Org members ———
    if (action === 'membersList') {
      return jsonResponse_({ members: listMembers_() });
    }

    if (action === 'membersUpsert' && acceptsWrite_(method, e)) {
      requireAdmin_(actorEmail);
      return jsonResponse_(upsertMember_(body.member));
    }

    if (action === 'membersDeactivate' && method === 'POST') {
      requireAdmin_(actorEmail);
      deactivateMember_(body.id);
      return jsonResponse_({ ok: true });
    }

    // ——— Role capabilities ———
    // Intentionally NOT admin-gated: every signed-in user's client (web's
    // initAuthStore, iOS's AdminPanelViewModel) fetches this matrix to
    // evaluate their OWN can(role, cap) checks, not just to view the Admin
    // Panel. The matrix data itself isn't sensitive; only writing it
    // (capsSave, below) is admin-only.
    if (action === 'capsList') {
      return jsonResponse_({ matrix: getCapMatrixFromSheet_() });
    }

    if (action === 'capsSave' && acceptsWrite_(method, e)) {
      requireAdmin_(actorEmail);
      saveCapMatrixToSheet_(body.matrix);
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, 500);
  }
}

function handleVendorRequest_(vendorToken, action, body) {
  var token = vendorToken || (body && body.vendorToken) || '';
  if (!token) {
    return jsonResponse_({ error: 'vendorToken required' }, 401);
  }

  if (action === 'vendorWorkspace' || action === '' || !action) {
    return jsonResponse_(getVendorWorkspace_(token));
  }

  // Every write action below requires a 'collaborate' link, re-resolved from
  // the token itself — never trust eventCode/category values the client sends.
  var writeActions = {
    vendorCostItemCreate: 1,
    vendorCostItemUpdate: 1,
    vendorFileUpload: 1,
    vendorTaskStatusUpdate: 1,
  };
  if (writeActions[action]) {
    var link = findVendorLinkByToken_(token);
    if (!link) {
      return jsonResponse_({ error: 'This vendor link is invalid or has expired.' }, 401);
    }
    if (link.permission !== 'collaborate') {
      return jsonResponse_({ error: 'This vendor link is view-only.' }, 403);
    }

    if (action === 'vendorCostItemCreate') {
      var createPayload = {
        eventCode: link.eventCode,
        eventRowId: link.eventRowId,
        category: link.vendorCategory || body.category || 'General',
        description: body.description || '',
        quantity: body.quantity,
        unitRate: body.unitRate,
        currency: body.currency,
        vendorName: link.vendorName || body.vendorName || '',
        notes: body.notes || '',
        createdBy: vendorActorLabel_(link),
      };
      return jsonResponse_(createCostItem_(createPayload));
    }

    if (action === 'vendorCostItemUpdate') {
      var item = findCostItem_(body.costItemId);
      if (!item) return jsonResponse_({ error: 'Cost item not found' }, 404);
      var itemCategory = String(item.category || '').toLowerCase();
      var linkCategory = String(link.vendorCategory || '').toLowerCase();
      var isOwnSubmission = String(item.createdBy || '').indexOf('vendor:') === 0;
      if (item.eventCode !== link.eventCode || (linkCategory && itemCategory !== linkCategory) || !isOwnSubmission) {
        return jsonResponse_({ error: 'You can only edit cost items you submitted yourself.' }, 403);
      }
      return jsonResponse_(updateCostItem_(body.costItemId, body.updates || {}, vendorActorLabel_(link)));
    }

    if (action === 'vendorFileUpload') {
      var uploadTask = findTask_(body.taskId);
      if (!uploadTask || !isTaskVisibleToVendorLink_(uploadTask, link)) {
        return jsonResponse_({ error: 'Task not found or not visible to this vendor link.' }, 403);
      }
      return jsonResponse_(uploadFile_({
        eventCode: link.eventCode,
        taskId: body.taskId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        dataBase64: body.dataBase64,
        uploadedBy: vendorActorLabel_(link),
      }));
    }

    if (action === 'vendorTaskStatusUpdate') {
      var statusTask = findTask_(body.taskId);
      if (!statusTask || !isTaskVisibleToVendorLink_(statusTask, link)) {
        return jsonResponse_({ error: 'Task not found or not visible to this vendor link.' }, 403);
      }
      return jsonResponse_(updateTask_(body.taskId, { status: body.status }, vendorActorLabel_(link)));
    }
  }

  return jsonResponse_({ error: 'Unknown vendor action' }, 400);
}

function getActiveVendorLinkForEvent_(eventCode) {
  if (typeof listVendorLinks_ !== 'function') return null;
  try {
    var links = listVendorLinks_(eventCode);
    for (var i = 0; i < links.length; i++) {
      if (String(links[i].active).toLowerCase() === 'yes') {
        return links[i];
      }
    }
  } catch (err) {
    Logger.log('getActiveVendorLinkForEvent_: ' + err);
  }
  return null;
}

function verifyToken_(e) {
  var expected = getApiToken_();
  var token = '';
  if (e && e.parameter && e.parameter.token) {
    token = e.parameter.token;
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var b = JSON.parse(e.postData.contents);
      if (b.token) token = b.token;
    } catch (ignore) {}
  }
  return token && token === expected;
}

function jsonResponse_(obj, status) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
