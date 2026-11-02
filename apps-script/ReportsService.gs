/**
 * Reports — per-event financials for the Reports page, joined and converted on the server.
 *
 * Only actors with the `reports.view` capability (admins always; other roles when an admin enables it in
 * Admin Panel → Permissions) can read it, so contract values, costs and margins never leave the server for
 * anyone else. The page does its own period / country filtering on the rows returned, so clicking around is
 * instant instead of a round trip to Apps Script per click.
 */

var REPORT_TARGET_PROP_ = 'REPORT_MONTHLY_TARGET';

/** Only secured work counts: a Proposed (not yet won) quote must not show up as revenue. */
var REPORT_STATUSES_ = { Awarded: true, Completed: true };

/** An event's lifecycle status, falling back to the legacy Awarded flag the same way the web app does. */
function reportEventStatus_(ev) {
  var s = String(ev.status || '').trim();
  if (s) return s;
  return String(ev.awarded || '').trim().toLowerCase() === 'yes' ? 'Awarded' : 'Proposed';
}

/** Converts an amount to USD at the cached rate (rates are units of currency per 1 USD); null if no rate. */
function reportToUsd_(amount, currency, rates) {
  var cur = String(currency || 'USD').toUpperCase();
  if (cur === 'USD') return amount;
  var rate = rates ? Number(rates[cur]) : 0;
  return rate > 0 ? amount / rate : null;
}

function reportYearOf_(ev) {
  var d = String(ev.endDate || ev.startDate || '');
  var y = parseInt(d.slice(0, 4), 10);
  return isNaN(y) ? null : y;
}

function getReportMonthlyTarget_() {
  var n = Number(getScriptProperty_(REPORT_TARGET_PROP_, true));
  return n > 0 ? n : 0;
}

/**
 * @param {string} actorEmail
 * @param {string|number} year  Calendar year of the events' end dates (default: this year).
 */
function getReportData_(actorEmail, year) {
  if (!canActor_(actorEmail, 'reports.view')) {
    throw new Error('Permission denied: Reports is not enabled for your role');
  }
  var wanted = parseInt(year, 10) || new Date().getFullYear();

  var rates = null;
  try {
    var fx = typeof fetchUsdRates_ === 'function' ? fetchUsdRates_() : null;
    rates = fx ? fx.rates : null;
  } catch (e) {
    rates = null;
  }

  var costsByEvent = {};
  listCostItems_('', '').forEach(function (c) {
    (costsByEvent[c.eventCode] = costsByEvent[c.eventCode] || []).push(c);
  });

  var unconverted = {};
  var yearsSeen = {};
  var rows = [];

  listEvents_().events.forEach(function (ev) {
    if (!REPORT_STATUSES_[reportEventStatus_(ev)]) return;
    var y = reportYearOf_(ev);
    if (y === null) return;
    yearsSeen[y] = true;
    if (y !== wanted) return;

    var cost = 0;
    var byCategory = {};
    (costsByEvent[ev.code] || []).forEach(function (c) {
      var usd = reportToUsd_(c.total, c.currency, rates);
      if (usd === null) {
        unconverted[String(c.currency).toUpperCase()] = true;
        usd = c.total;
      }
      cost += usd;
      var cat = c.category || 'General';
      byCategory[cat] = (byCategory[cat] || 0) + usd;
    });

    var revenue = parseFloat(ev.revenue);
    rows.push({
      code: ev.code,
      location: ev.location,
      startDate: ev.startDate,
      endDate: ev.endDate || ev.startDate,
      ownerEmail: ev.ownerEmail,
      status: reportEventStatus_(ev),
      revenue: isNaN(revenue) ? 0 : revenue,
      cost: cost,
      costByCategory: byCategory,
      paid: String(ev.paymentStatus || '').trim().toLowerCase() === 'paid',
    });
  });

  var years = Object.keys(yearsSeen)
    .map(Number)
    .sort(function (a, b) {
      return b - a;
    });
  return {
    year: wanted,
    years: years,
    rows: rows,
    monthlyTarget: getReportMonthlyTarget_(),
    unconvertedCurrencies: Object.keys(unconverted),
  };
}

/** Admin-only. Currently just the monthly revenue target (0 clears it and hides the target line). */
function saveReportSettings_(actorEmail, settings) {
  requireAdmin_(actorEmail);
  var target = Number(settings.monthlyTarget);
  if (isNaN(target) || target < 0) throw new Error('Monthly target must be a number of 0 or more');
  PropertiesService.getScriptProperties().setProperty(REPORT_TARGET_PROP_, String(Math.round(target)));
  return { monthlyTarget: getReportMonthlyTarget_() };
}
