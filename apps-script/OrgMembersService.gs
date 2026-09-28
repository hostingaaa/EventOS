/**
 * OrgMembersService — persists org members and the role-capability matrix
 * in dedicated sheets.
 *
 * OrgMembers sheet columns: id | name | email | role | status | createdAt | invitedBy
 * RoleCapabilities sheet  : single data row, column A holds the JSON blob.
 */

var ORG_MEMBERS_SHEET_  = 'OrgMembers';
var ROLE_CAPS_SHEET_    = 'RoleCapabilities';
var ORG_MEMBER_COLS_    = ['id', 'name', 'email', 'role', 'status', 'createdAt', 'invitedBy'];

// ── Sheet access ──────────────────────────────────────────────────────────

function getOrgMembersSheet_() {
  var ss    = getSpreadsheet_();
  var sheet = ss.getSheetByName(ORG_MEMBERS_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(ORG_MEMBERS_SHEET_);
    sheet.appendRow(ORG_MEMBER_COLS_);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRoleCapabilitiesSheet_() {
  var ss    = getSpreadsheet_();
  var sheet = ss.getSheetByName(ROLE_CAPS_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(ROLE_CAPS_SHEET_);
    sheet.appendRow(['matrix']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Members helpers ───────────────────────────────────────────────────────

function listMembers_() {
  var sheet   = getOrgMembersSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = String(row[i] != null ? row[i] : ''); });
    return obj;
  });
}

function findMemberRow_(id) {
  var sheet   = getOrgMembersSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol   = headers.indexOf('id');
  if (idCol < 0) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

// ── Members public API ────────────────────────────────────────────────────

function upsertMember_(member) {
  var row = [
    member.id,
    member.name,
    (member.email || '').toLowerCase().trim(),
    member.role,
    member.status,
    member.createdAt || new Date().toISOString().slice(0, 10),
    member.invitedBy || '',
  ];

  var found = findMemberRow_(member.id);
  if (found) {
    getOrgMembersSheet_()
      .getRange(found.rowIndex, 1, 1, row.length)
      .setValues([row]);
  } else {
    getOrgMembersSheet_().appendRow(row);
  }
  return member;
}

/** Emails a newly invited member the site link + their assigned role.
 * Failure here must never block adding the member — email delivery is a
 * courtesy notification, not a requirement for the record to exist. */
function sendInvitationEmail_(member, invitedByEmail) {
  try {
    var siteUrl = getScriptProperty_('APP_URL', true) || 'https://hostingaaa.github.io/EventOS/';
    // Pre-fills the email step and jumps straight to the registration form
    // (skipping the manual "type your email" + "No account found" steps) —
    // see the ?email= handling in JoinTeamModal.tsx.
    var inviteLink = siteUrl + (siteUrl.indexOf('?') >= 0 ? '&' : '?') + 'email=' + encodeURIComponent(member.email);
    var roleLabel = String(member.role || '').replace(/_/g, ' ');
    var inviter = typeof findMemberByEmail_ === 'function' ? findMemberByEmail_(invitedByEmail) : null;
    var invitedByLabel = (inviter && inviter.name) || invitedByEmail || 'An admin';

    var subject = "You're invited to join EventOS";
    var htmlBody = buildInvitationEmailHtml_(
      escapeHtml_(member.name),
      escapeHtml_(member.email),
      escapeHtml_(roleLabel),
      escapeHtml_(invitedByLabel),
      inviteLink,
    );
    MailApp.sendEmail({ to: member.email, subject: subject, htmlBody: htmlBody });
  } catch (e) {
    Logger.log('sendInvitationEmail_ failed for ' + member.email + ': ' + e);
  }
}

/**
 * Adapted from the team-supplied "Team Invitation Email.html" design
 * (high-fidelity — colors/spacing/dark-mode preserved as given). Dropped
 * from the original: the token-based "invite/accept" link and expiry date
 * (this app's registration is a plain self-serve email+password flow with
 * no invite tokens or expiry — see JoinTeamModal.tsx), the "Team" row (no
 * per-invite team/department concept here), and the physical mailing
 * address / support mailbox (neither exists for this internal tool).
 * Brand swapped from the design's placeholder "JADE/OPS" to the app's real
 * "EventOS" wordmark (Event in ink, OS in accent — see EventOSWordmark.tsx).
 */
function buildInvitationEmailHtml_(name, email, role, invitedBy, link) {
  return '<!DOCTYPE html>' +
'<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1">' +
'<meta name="x-apple-disable-message-reformatting">' +
'<meta name="color-scheme" content="light dark">' +
'<meta name="supported-color-schemes" content="light dark">' +
'<title>You\'re invited to join EventOS</title>' +
'<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->' +
'<style>' +
'  a { color: #0b6a5b; }' +
'  @media (max-width: 620px) {' +
'    .px { padding-left: 24px !important; padding-right: 24px !important; }' +
'    .h1 { font-size: 28px !important; line-height: 34px !important; }' +
'  }' +
'  @media (prefers-color-scheme: dark) {' +
'    .bg { background: #10181e !important; }' +
'    .card { background: #1a252d !important; }' +
'    .ink { color: #e8eef1 !important; }' +
'    .muted { color: #9fb0b8 !important; }' +
'    .tint { background: #0f2e2a !important; }' +
'    .rule { border-color: #2a3740 !important; }' +
'  }' +
'</style>' +
'</head>' +
'<body style="margin:0;padding:0;background:#f1f4f7;" class="bg">' +
'<span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' + invitedBy + ' added you to EventOS. Create your account to get started.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</span>' +

'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f4f7;" class="bg">' +
'<tr><td align="center" style="padding:40px 16px;">' +

'  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' +

'    <tr><td class="px" style="padding:0 8px 20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;letter-spacing:-0.2px;color:#14212b;" align="left">' +
'      <span class="ink" style="color:#14212b;">Event</span><span style="color:#0f7d69;">OS</span>' +
'    </td></tr>' +

'    <tr><td class="card" style="background:#ffffff;border-radius:16px;border:1px solid #e3e9ee;">' +
'      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +

'        <tr><td class="px" style="padding:44px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:1.2px;text-transform:uppercase;color:#0b6a5b;">' +
'          Team invitation' +
'        </td></tr>' +

'        <tr><td class="px h1 ink" style="padding:12px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:-0.6px;color:#14212b;">' +
'          Welcome aboard, ' + name + '.' +
'        </td></tr>' +

'        <tr><td class="px ink" style="padding:16px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;mso-line-height-rule:exactly;color:#14212b;">' +
'          <strong>' + invitedBy + '</strong> added you to <strong>EventOS</strong>. Create your account to see the events you\'re assigned to, your calendar and your team.' +
'        </td></tr>' +

'        <tr><td class="px" style="padding:28px 48px 0 48px;">' +
'          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tint" style="background:#e6f4f1;border-radius:12px;">' +
'            <tr><td style="padding:18px 20px 6px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:1px;text-transform:uppercase;color:#0a5046;" class="muted">Your account</td></tr>' +
'            <tr><td style="padding:0 20px 18px 20px;">' +
'              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
'                <tr>' +
'                  <td width="96" class="muted" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#3d5a55;">Email</td>' +
'                  <td class="ink" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;color:#14212b;">' + email + '</td>' +
'                </tr>' +
'                <tr>' +
'                  <td width="96" class="muted" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#3d5a55;">Role</td>' +
'                  <td class="ink" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;color:#14212b;">' + role + '</td>' +
'                </tr>' +
'              </table>' +
'            </td></tr>' +
'          </table>' +
'        </td></tr>' +

'        <tr><td class="px" style="padding:32px 48px 0 48px;" align="left">' +
'          <table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
'            <tr><td bgcolor="#0f7d69" style="background:#0f7d69;border-radius:999px;mso-padding-alt:14px 28px;">' +
'              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="' + link + '" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="50%" stroke="f" fillcolor="#0f7d69"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Create your account</center></v:roundrect><![endif]-->' +
'              <!--[if !mso]><!--><a href="' + link + '" style="display:block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Create your account &rarr;</a><!--<![endif]-->' +
'            </td></tr>' +
'          </table>' +
'        </td></tr>' +

'        <tr><td class="px" style="padding:36px 48px 0 48px;">' +
'          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid #e3e9ee;font-size:0;line-height:0;">&nbsp;</td></tr></table>' +
'        </td></tr>' +

'        <tr><td class="px ink" style="padding:24px 48px 8px 48px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;color:#14212b;">What happens next</td></tr>' +

'        <tr><td class="px" style="padding:0 48px;">' +
'          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
'            <tr>' +
'              <td width="36" valign="top" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:bold;color:#0f7d69;">01</td>' +
'              <td class="ink" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#14212b;">Create your account using this email address and a password of your choice.</td>' +
'            </tr>' +
'            <tr>' +
'              <td width="36" valign="top" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:bold;color:#0f7d69;">02</td>' +
'              <td class="ink" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#14212b;">Check your Calendar for the events you\'re assigned to.</td>' +
'            </tr>' +
'            <tr>' +
'              <td width="36" valign="top" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:bold;color:#0f7d69;">03</td>' +
'              <td class="ink" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#14212b;">Reach out to ' + invitedBy + ' if you have any questions.</td>' +
'            </tr>' +
'          </table>' +
'        </td></tr>' +

'        <tr><td class="px muted" style="padding:28px 48px 44px 48px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5f6e76;">' +
'          Button not working? Paste this link into your browser:<br>' +
'          <a href="' + link + '" style="color:#0b6a5b;word-break:break-all;">' + link + '</a>' +
'        </td></tr>' +

'      </table>' +
'    </td></tr>' +

'    <tr><td class="px muted" style="padding:24px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5f6e76;">' +
'      You\'re receiving this because your email was added to EventOS by your team admin. Weren\'t expecting it? You can safely ignore this email.' +
'    </td></tr>' +

'  </table>' +
'</td></tr>' +
'</table>' +
'</body>' +
'</html>';
}

function deactivateMember_(id) {
  var found = findMemberRow_(id);
  if (!found) throw new Error('Member not found: ' + id);
  // status is the 5th column (index 4, 1-based = 5)
  var statusColIndex = found.headers.indexOf('status') + 1;
  getOrgMembersSheet_()
    .getRange(found.rowIndex, statusColIndex)
    .setValue('inactive');
}

/** Permanently removes the row — unlike deactivateMember_, this can't be
 * undone from the Admin Panel. Meant for cleaning up unused accounts
 * (stale invites, test rows) rather than for removing someone who was
 * genuinely part of the team; the UI only offers this for non-active
 * members, as a guard against deleting someone still in active use. */
function deleteMember_(id) {
  var found = findMemberRow_(id);
  if (!found) throw new Error('Member not found: ' + id);
  getOrgMembersSheet_().deleteRow(found.rowIndex);
}

// ── Capability matrix ─────────────────────────────────────────────────────

function getCapMatrixFromSheet_() {
  var sheet = getRoleCapabilitiesSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var json = String(data[1][0] || '').trim();
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}

function saveCapMatrixToSheet_(matrix) {
  var sheet = getRoleCapabilitiesSheet_();
  var json  = JSON.stringify(matrix);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([json]);
  } else {
    sheet.getRange(2, 1).setValue(json);
  }
}
