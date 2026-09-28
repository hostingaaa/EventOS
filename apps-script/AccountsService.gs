/**
 * AccountsService — persists auth accounts in the "AuthAccounts" sheet.
 *
 * Columns: id | name | email | passwordHash | createdAt
 *
 * Password hashes are computed on the client (SHA-256 with a shared salt)
 * before being sent, so raw passwords never leave the browser.
 */

var AUTH_ACCOUNTS_SHEET_ = 'AuthAccounts';
var AUTH_ACCOUNT_COLS_   = ['id', 'name', 'email', 'passwordHash', 'createdAt'];

// ── Sheet access ──────────────────────────────────────────────────────────

function getAuthAccountsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(AUTH_ACCOUNTS_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(AUTH_ACCOUNTS_SHEET_);
    sheet.appendRow(AUTH_ACCOUNT_COLS_);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function listAccounts_() {
  var sheet = getAuthAccountsSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = String(row[i] != null ? row[i] : ''); });
    return obj;
  });
}

function findAccountRow_(email) {
  var lower   = email.toLowerCase().trim();
  var sheet   = getAuthAccountsSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailCol = headers.indexOf('email');
  var hashCol  = headers.indexOf('passwordHash');
  if (emailCol < 0) return null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).toLowerCase().trim() === lower) {
      return { rowIndex: i + 1, hashColIndex: hashCol + 1, data: data[i], headers: headers };
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────

function registerAccount_(name, email, passwordHash) {
  var lower = email.toLowerCase().trim();
  if (findAccountRow_(lower)) {
    throw new Error('An account with this email already exists.');
  }
  var id        = 'auth-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  var createdAt = new Date().toISOString().slice(0, 10);
  getAuthAccountsSheet_().appendRow([id, name.trim(), lower, passwordHash, createdAt]);

  // Registration is fully self-serve (any email can sign up) — this is the
  // one authoritative place that creates or activates the matching
  // OrgMembers row, so an admin's pre-added "invited" record actually
  // transitions to "active" once the person registers, instead of staying
  // stuck as Invited forever. Never let this block account creation.
  try {
    if (typeof findMemberByEmail_ === 'function' && typeof upsertMember_ === 'function') {
      var existingMember = findMemberByEmail_(lower);
      if (existingMember) {
        if (existingMember.status === 'invited') {
          upsertMember_({
            id: existingMember.id,
            name: name.trim(),
            email: lower,
            role: existingMember.role,
            status: 'active',
            createdAt: existingMember.createdAt,
            invitedBy: existingMember.invitedBy,
          });
        }
      } else {
        upsertMember_({
          id: 'member-' + Date.now(),
          name: name.trim(),
          email: lower,
          role: 'project_lead',
          status: 'active',
          createdAt: createdAt,
          invitedBy: '',
        });
      }
    }
  } catch (e) {
    Logger.log('registerAccount_ member sync failed for ' + lower + ': ' + e);
  }

  return { id: id, name: name.trim(), email: lower, passwordHash: passwordHash, createdAt: createdAt };
}

function verifyAccount_(email, passwordHash) {
  var found = findAccountRow_(email);
  if (!found) return null;
  var headers = found.headers;
  var row     = found.data;
  var obj     = {};
  headers.forEach(function (h, i) { obj[h] = String(row[i] != null ? row[i] : ''); });
  if (obj.passwordHash !== passwordHash) return null;
  return obj;
}

function changeAccountPassword_(email, newHash) {
  var found = findAccountRow_(email);
  if (!found) throw new Error('Account not found');
  getAuthAccountsSheet_()
    .getRange(found.rowIndex, found.hashColIndex)
    .setValue(newHash);
}
