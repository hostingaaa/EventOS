/**
 * Install daily trigger: Run setupRemindersTrigger once from the editor.
 */
function setupRemindersTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'runDailyReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('runDailyReminders')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function runDailyReminders() {
  var result = listEvents_();
  var sent = 0;

  result.events.forEach(function (ev) {
    var start = parseDate_(ev.startDate);
    if (!start) return;

    var days = daysUntil_(start);
    var recipients = getRecipients_(ev);
    if (!recipients.length) return;

    CONFIG.REMINDER_DAYS.forEach(function (d) {
      if (days === d) {
        if (sendReminderIfNew_(ev, 'EVENT_T' + d, recipients, buildEventApproachingEmail_(ev, d))) {
          sent++;
        }
      }
    });

    if (isMissingSow_(ev.sow) && days <= CONFIG.MISSING_SOW_DAYS && days >= 0) {
      if (days === CONFIG.MISSING_SOW_DAYS || days === 14 || days === 7) {
        if (sendReminderIfNew_(ev, 'MISSING_SOW_' + days, recipients, buildMissingFieldEmail_(ev, 'SOW', 'Statement of Work'))) {
          sent++;
        }
      }
    }

    if (isMissingVenue_(ev.venue) && days <= CONFIG.MISSING_VENUE_DAYS && days >= 0) {
      if (days === CONFIG.MISSING_VENUE_DAYS || days === 7) {
        if (sendReminderIfNew_(ev, 'MISSING_VENUE_' + days, recipients, buildMissingFieldEmail_(ev, 'VENUE', 'Venue'))) {
          sent++;
        }
      }
    }

    if (isLemOpen_(ev.lem) && days === 7) {
      if (sendReminderIfNew_(ev, 'LEM_OPEN_T7', recipients, buildLemOpenEmail_(ev))) {
        sent++;
      }
    }
  });

  Logger.log('Reminders sent: ' + sent);
  return sent;
}

function getRecipients_(ev) {
  var list = [];
  if (ev.ownerEmail && ev.ownerEmail.indexOf('@') > 0) {
    list.push(ev.ownerEmail.trim());
  }
  var mgr = getEventManagerEmail_();
  if (mgr && list.indexOf(mgr) < 0) {
    list.push(mgr);
  }
  return list;
}

function reminderKey_(ev, type) {
  return ev.rowId + '|' + type;
}

function alreadySent_(ev, type) {
  var last = String(ev.lastReminder || '');
  var key = reminderKey_(ev, type);
  return last.indexOf(key) >= 0;
}

function sendReminderIfNew_(ev, type, recipients, htmlBody) {
  if (alreadySent_(ev, type)) return false;

  var subject = '[Event Ops] ' + ev.code + ' — ' + type.replace(/_/g, ' ');
  recipients.forEach(function (to) {
    sendAppEmail_({
      to: to,
      subject: subject,
      htmlBody: htmlBody,
    });
  });

  var key = reminderKey_(ev, type);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var newVal = (ev.lastReminder ? ev.lastReminder + '; ' : '') + key + '@' + stamp;
  setLastReminder_(ev.rowNumber, newVal);
  ev.lastReminder = newVal;
  return true;
}

function buildEventApproachingEmail_(ev, days) {
  return wrapEmailHtml_(
    '<h2>Event in ' + days + ' day' + (days === 1 ? '' : 's') + '</h2>' +
      eventSummaryHtml_(ev) +
      '<p>Please confirm LEM, AV, interpreters, and venue status in Event Ops.</p>'
  );
}

function buildMissingFieldEmail_(ev, field, label) {
  return wrapEmailHtml_(
    '<h2>Missing ' + label + '</h2>' + eventSummaryHtml_(ev) + '<p>Please update <strong>' + field + '</strong> in the tracker.</p>'
  );
}

function buildLemOpenEmail_(ev) {
  return wrapEmailHtml_(
    '<h2>LEM still open (7 days to event)</h2>' + eventSummaryHtml_(ev) + '<p>Current LEM status: <strong>' + ev.lem + '</strong></p>'
  );
}

function eventSummaryHtml_(ev) {
  return (
    '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">' +
    '<tr><td><strong>Code</strong></td><td>' +
    escapeHtml_(ev.code) +
    '</td></tr>' +
    '<tr><td><strong>Location</strong></td><td>' +
    escapeHtml_(ev.location) +
    '</td></tr>' +
    '<tr><td><strong>Dates</strong></td><td>' +
    escapeHtml_(ev.dates) +
    '</td></tr>' +
    '<tr><td><strong>Notes</strong></td><td>' +
    escapeHtml_(ev.notes) +
    '</td></tr></table>'
  );
}

function wrapEmailHtml_(inner) {
  return (
    '<div style="font-family:system-ui,sans-serif;color:#7c677f;max-width:560px">' +
    '<div style="background:#8076a3;color:white;padding:12px 16px;border-radius:8px 8px 0 0"><strong>Event Ops</strong></div>' +
    '<div style="background:#f9c5bd;padding:16px;border-radius:0 0 8px 8px">' +
    inner +
    '</div></div>'
  );
}

function escapeHtml_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
