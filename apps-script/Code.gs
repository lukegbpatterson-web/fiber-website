/**
 * bayzl waitlist backend (Google Apps Script web app).
 *
 * The landing pages POST JSON (as text/plain, so the browser sends no CORS preflight). This script:
 *   1. saves the row to the bound Google Sheet (or recognises a duplicate email),
 *   2. sends a Lead event to the Meta Conversions API (new emails only),
 *   3. returns JSON { ok, duplicate, event_id } which the page reads before showing success.
 * Later, optional survey answers update the same row (looked up by event_id).
 *
 * Secrets live in Script Properties (Project Settings > Script Properties), never in this file:
 *   META_PIXEL_ID         the dataset / Pixel ID
 *   META_CAPI_TOKEN       Conversions API access token
 *   META_TEST_EVENT_CODE  optional; only while using Events Manager > Test Events
 *
 * See apps-script/README.md for deploy steps.
 */

var GRAPH_VERSION = "v26.0";

// Existing sheet order is kept: Timestamp, Email, Source. New columns are appended to the right.
var HEADERS = [
  "Timestamp", "Email", "Source",
  "variant", "utm_source", "utm_campaign", "utm_content", "fbclid",
  "event_id", "capi_status", "q_fiber_now", "q_price", "q_channel"
];
var COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

var FIBER_OPTIONS = ["Nothing", "Powder", "Gummies", "Other"];
var PRICE_OPTIONS = ["$8", "$12", "$16", "$20+"];
var CHANNEL_OPTIONS = ["Amazon", "Direct"];
var EMAIL_RE = /^[^\s@=][^\s@]*@[^\s@]+\.[^\s@]{2,}$/;

function doPost(e) {
  try {
    var body = parseBody_(e);
    if (body.action === "survey") return json_(saveSurvey_(body));
    return json_(join_(body));
  } catch (err) {
    console.error("doPost failed: " + err);
    return json_({ ok: false, error: "server error" });
  }
}

// Run this ONCE from the editor (select "authorize" in the function dropdown, click Run) so Google asks you
// to approve the "connect to an external service" permission that the Meta call needs. Without that approval
// the web app fails with: "You do not have permission to call UrlFetchApp.fetch".
function authorize() {
  var r = UrlFetchApp.fetch("https://graph.facebook.com/", { muteHttpExceptions: true });
  console.log("External requests authorized (HTTP " + r.getResponseCode() + ").");
}

// Visiting the /exec URL in a browser: a harmless health check.
function doGet() {
  return json_({ ok: true, service: "bayzl waitlist" });
}

/* ------------------------------------------------------------------ join */

function join_(b) {
  var email = str_(b.email, 254).trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid email" };

  var eventId = str_(b.event_id, 64) || Utilities.getUuid();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var row, duplicate = false;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureHeaders_(sheet);
    var found = findRow_(sheet, COL.Email, email.toLowerCase());
    if (found) {
      var existingId = String(sheet.getRange(found, COL.event_id).getValue() || "");
      if (!existingId) {
        // Row from before event ids existed: adopt this id so survey answers can attach to it.
        // It is still a duplicate (no Lead, no CAPI event).
        sheet.getRange(found, COL.event_id).setNumberFormat("@").setValue(eventId);
        return { ok: true, duplicate: true, event_id: eventId };
      }
      if (existingId === eventId) {
        // Same submission retried (e.g. first response was lost): treat as the original success.
        return { ok: true, duplicate: false, event_id: existingId, retry: true };
      }
      return { ok: true, duplicate: true, event_id: existingId };
    }

    row = sheet.getLastRow() + 1;
    var values = [
      new Date(), email, str_(b.page_url, 500),
      str_(b.variant, 4), str_(b.utm_source, 200), str_(b.utm_campaign, 200),
      str_(b.utm_content, 200), str_(b.fbclid, 300),
      eventId, "pending", "", ""
    ];
    // Plain-text format (except the timestamp) so nothing is parsed as a formula or a number.
    sheet.getRange(row, 2, 1, HEADERS.length - 1).setNumberFormat("@");
    sheet.getRange(row, 1, 1, HEADERS.length).setValues([values]);
  } finally {
    lock.releaseLock();
  }

  // Outside the lock: the Meta call can be slow. A failure here never loses the saved row.
  var status = sendLead_(b, email, eventId);
  sheet.getRange(row, COL.capi_status).setNumberFormat("@").setValue(status);
  return { ok: true, duplicate: false, event_id: eventId };
}

/* ---------------------------------------------------------------- survey */

function saveSurvey_(b) {
  var eventId = str_(b.event_id, 64);
  if (!eventId) return { ok: false, error: "missing event_id" };

  var updates = [];
  if (b.q_fiber_now !== undefined) {
    if (FIBER_OPTIONS.indexOf(b.q_fiber_now) < 0) return { ok: false, error: "bad answer" };
    updates.push([COL.q_fiber_now, b.q_fiber_now]);
  }
  if (b.q_price !== undefined) {
    if (PRICE_OPTIONS.indexOf(b.q_price) < 0) return { ok: false, error: "bad answer" };
    updates.push([COL.q_price, b.q_price]);
  }
  if (b.q_channel !== undefined) {
    if (CHANNEL_OPTIONS.indexOf(b.q_channel) < 0) return { ok: false, error: "bad answer" };
    updates.push([COL.q_channel, b.q_channel]);
  }
  if (!updates.length) return { ok: false, error: "nothing to save" };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var row = findRow_(sheet, COL.event_id, eventId);
    if (!row) return { ok: false, error: "unknown event_id" };
    updates.forEach(function (u) { sheet.getRange(row, u[0]).setNumberFormat("@").setValue(u[1]); });
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/* ------------------------------------------------- Meta Conversions API */

// Returns the HTTP status code as a string ("200"), or a short "error: ..." / "skipped: ..." note.
function sendLead_(b, email, eventId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var pixelId = prop_(props, "META_PIXEL_ID");
    var token = prop_(props, "META_CAPI_TOKEN");
    var testCode = prop_(props, "META_TEST_EVENT_CODE");
    if (!pixelId || !token) return "skipped: META_PIXEL_ID / META_CAPI_TOKEN not set";

    var fbclid = str_(b.fbclid, 300);
    var fbc = str_(b.fbc, 300) || (fbclid ? "fb.1." + Date.now() + "." + fbclid : "");

    var userData = { em: [sha256_(email.trim().toLowerCase())] };
    var ua = str_(b.user_agent, 500), fbp = str_(b.fbp, 200);
    if (ua) userData.client_user_agent = ua;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    // client_ip_address is not available to Apps Script; the browser Pixel event carries it and
    // Meta merges the two events through the shared event_id.

    var payload = {
      data: [{
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: str_(b.page_url, 500),
        user_data: userData,
        custom_data: { content_name: str_(b.variant, 4) }
      }],
      access_token: token
    };
    if (testCode) payload.test_event_code = testCode;

    var resp = UrlFetchApp.fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + pixelId + "/events", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code !== 200) {
      console.error("CAPI " + code + ": " + resp.getContentText().slice(0, 500));
      return String(code) + ": " + shortError_(resp.getContentText());
    }
    return "200";
  } catch (err) {
    console.error("CAPI exception: " + err);
    return ("error: " + err).slice(0, 200);
  }
}

/* --------------------------------------------------------------- helpers */

// Script Property value with stray whitespace, line breaks and wrapping quotes removed (common paste slips).
function prop_(props, name) {
  var v = props.getProperty(name);
  return v ? String(v).replace(/\s+/g, "").replace(/^["'`]+|["'`]+$/g, "") : "";
}

function parseBody_(e) {
  var raw = (e && e.postData && e.postData.contents) || "";
  try {
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (err) { /* fall through */ }
  // Back-compat with the old form-encoded pages (email, source).
  var p = (e && e.parameter) || {};
  return { action: "join", email: p.email || "", page_url: p.source || "" };
}

function ensureHeaders_(sheet) {
  var have = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0] : [];
  HEADERS.forEach(function (h, i) {
    if (!have[i]) sheet.getRange(1, i + 1).setValue(h);
  });
}

function findRow_(sheet, col, valueLower) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === valueLower) return i + 2;
  }
  return 0;
}

function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (x) { return ("0" + (x < 0 ? x + 256 : x).toString(16)).slice(-2); }).join("");
}

function str_(v, max) { return v === undefined || v === null ? "" : String(v).slice(0, max); }

function shortError_(text) {
  try { var j = JSON.parse(text); return String((j.error && (j.error.message || j.error.type)) || text).slice(0, 150); }
  catch (e) { return String(text).slice(0, 150); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
