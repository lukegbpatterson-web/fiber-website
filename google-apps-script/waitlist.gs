/**
 * bayzl waitlist intake.
 *
 * Bind this script to the waitlist Google Sheet (Extensions > Apps Script),
 * then deploy it as a Web App (see README.md "Connect the email list" for
 * the exact steps). The deployed /exec URL goes into FORM_ENDPOINT in
 * index.html.
 *
 * The site posts form-encoded data with mode:"no-cors", so it can never
 * read this function's return value — the response below only matters if
 * you're testing the URL directly (e.g. by pasting it in a browser).
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Email", "Source"]);
  }

  var email = ((e.parameter && e.parameter.email) || "").trim();
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "missing email" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var source = (e.parameter && e.parameter.source) || "";
  sheet.appendRow([new Date(), email, source]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
