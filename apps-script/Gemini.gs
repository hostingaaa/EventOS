/**
 * Weekly digest + optional AI draft emails via Gemini API.
 * Set GEMINI_API_KEY in Script properties.
 */

function generateWeeklyDigest_() {
  var data = listEvents_();
  var issues = [];

  data.events.forEach(function (ev) {
    var start = parseDate_(ev.startDate);
    var days = start ? daysUntil_(start) : null;
    var flags = [];

    if (isMissingSow_(ev.sow)) flags.push('missing SOW');
    if (isMissingVenue_(ev.venue)) flags.push('missing venue');
    if (isLemOpen_(ev.lem)) flags.push('LEM open');
    if (days !== null && days >= 0 && days <= 14) flags.push('in ' + days + ' days');

    if (flags.length) {
      issues.push({
        code: ev.code,
        location: ev.location,
        dates: ev.dates,
        flags: flags,
      });
    }
  });

  var summary = {
    totalEvents: data.events.length,
    needsAttention: issues.length,
    issues: issues,
    generatedAt: new Date().toISOString(),
  };

  var aiText = '';
  var key = getGeminiKey_();
  if (key && issues.length > 0) {
    aiText = callGemini_(buildDigestPrompt_(summary));
    summary.aiSummary = aiText;
  }

  return summary;
}

function sendWeeklyDigestEmail() {
  var digest = generateWeeklyDigest_();
  var body =
    '<h2>Weekly Event Ops Digest</h2>' +
    '<p><strong>' +
    digest.totalEvents +
    '</strong> events tracked; <strong>' +
    digest.needsAttention +
    '</strong> need attention.</p>';

  if (digest.aiSummary) {
    body += '<h3>AI summary</h3><p>' + escapeHtml_(digest.aiSummary).replace(/\n/g, '<br>') + '</p>';
  }

  if (digest.issues.length) {
    body += '<ul>';
    digest.issues.forEach(function (i) {
      body +=
        '<li><strong>' +
        escapeHtml_(i.code) +
        '</strong> (' +
        escapeHtml_(i.location) +
        ', ' +
        escapeHtml_(i.dates) +
        '): ' +
        escapeHtml_(i.flags.join(', ')) +
        '</li>';
    });
    body += '</ul>';
  }

  sendAppEmail_({
    to: getEventManagerEmail_(),
    subject: '[Event Ops] Weekly digest — ' + digest.needsAttention + ' items need attention',
    htmlBody: wrapEmailHtml_(body),
  });
}

function setupWeeklyDigestTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'sendWeeklyDigestEmail') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('sendWeeklyDigestEmail')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
}

function buildDigestPrompt_(summary) {
  return (
    'You are an event operations assistant. Summarize this weekly digest in 3-5 bullet points for a team lead. Be concise and actionable.\n\n' +
    JSON.stringify(summary, null, 2)
  );
}

function callGemini_(prompt) {
  var key = getGeminiKey_();
  if (!key) return '';

  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    encodeURIComponent(key);

  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    Logger.log('Gemini error: ' + res.getContentText());
    return '';
  }

  var json = JSON.parse(res.getContentText());
  try {
    return json.candidates[0].content.parts[0].text;
  } catch (e) {
    return '';
  }
}

function draftChaseEmailForEvent(code) {
  var ev = findEventRow_(null, code);
  if (!ev) throw new Error('Event not found: ' + code);

  var context =
    'Event: ' +
    ev.code +
    '\nLocation: ' +
    ev.location +
    '\nDates: ' +
    ev.dates +
    '\nLEM: ' +
    ev.lem +
    '\nAV: ' +
    ev.av +
    '\nInterpreters: ' +
    ev.interpreters +
    '\nVenue: ' +
    ev.venue +
    '\nSOW: ' +
    ev.sow +
    '\nNotes: ' +
    ev.notes;

  var prompt =
    'Draft a short, professional reminder email to a colleague about outstanding event logistics. Friendly tone, under 120 words. Do not include subject line.\n\n' +
    context;

  return callGemini_(prompt);
}
