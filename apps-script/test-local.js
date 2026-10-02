/* Local test harness for apps-script/Code.gs (no Google account needed).
 *   node apps-script/test-local.js           run the assertions
 *   node apps-script/test-local.js --serve   also serve the site on :8137 and a fake /exec on :8138
 *                                            (fake sheet in memory; Meta calls are recorded, never sent;
 *                                            Pixel/GA are blank, or throwaway IDs with FAKE_TAGS=1 for Lighthouse)
 * Google services are stubbed in memory, so this checks the logic, not Google's runtime. */
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto"), http = require("http");

function makeEnv(props) {
  const grid = []; // grid[r-1][c-1]
  const formats = {};
  const ensure = (r, c) => { while (grid.length < r) grid.push([]); for (let i = 0; i < grid.length; i++) while (grid[i].length < c) grid[i].push(""); };
  const rangeOf = (r, c, nr = 1, nc = 1) => ({
    getValues: () => { ensure(r + nr - 1, c + nc - 1); return Array.from({ length: nr }, (_, i) => grid[r - 1 + i].slice(c - 1, c - 1 + nc)); },
    getValue() { return this.getValues()[0][0]; },
    setValues(v) { ensure(r + nr - 1, c + nc - 1); v.forEach((row, i) => row.forEach((x, j) => (grid[r - 1 + i][c - 1 + j] = x))); return this; },
    setValue(x) { ensure(r, c); grid[r - 1][c - 1] = x; return this; },
    setNumberFormat(f) { formats[`${r},${c}`] = f; return this; },
  });
  const sheet = {
    getLastRow: () => grid.filter((row) => row.some((x) => x !== "")).length,
    getLastColumn: () => grid.reduce((m, row) => Math.max(m, row.filter((x, i) => x !== "" || row.slice(i).some((y) => y !== "")).length), 0),
    getRange: rangeOf,
  };
  const fetches = [];
  const sandbox = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [sheet] }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (_, s) => Array.from(crypto.createHash("sha256").update(s, "utf8").digest()).map((x) => (x > 127 ? x - 256 : x)),
      getUuid: () => crypto.randomUUID(),
    },
    UrlFetchApp: { fetch: (url, opts) => { const rec = { url, opts, body: JSON.parse(opts.payload) }; fetches.push(rec); return { getResponseCode: () => (sandbox.__capiStatus || 200), getContentText: () => (sandbox.__capiStatus ? '{"error":{"message":"Invalid token"}}' : '{"events_received":1}') }; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8"), sandbox);
  const post = (obj) => JSON.parse(sandbox.doPost({ postData: { contents: typeof obj === "string" ? obj : JSON.stringify(obj) }, parameter: {} }).text);
  return { sandbox, grid, formats, fetches, post };
}

if (require.main === module && !process.argv.includes("--serve")) {
  const assert = require("assert");
  const base = { action: "join", variant: "B", utm_source: "ig", utm_campaign: "c1", utm_content: "B", fbclid: "ABC123xyz", fbp: "fb.1.1.2", fbc: "", user_agent: "UA", page_url: "https://x/2/?utm_content=B" };

  // happy path
  let t = makeEnv({ META_PIXEL_ID: "111", META_CAPI_TOKEN: "TOK", META_TEST_EVENT_CODE: "TEST1" });
  let r = t.post({ ...base, email: "  Foo@Example.com ", event_id: "e1" });
  assert.deepStrictEqual(r, { ok: true, duplicate: false, event_id: "e1" });
  assert.strictEqual(t.fetches.length, 1);
  const f = t.fetches[0];
  assert(f.url.endsWith("/v26.0/111/events"));
  const ev = f.body.data[0];
  assert.strictEqual(ev.event_name, "Lead"); assert.strictEqual(ev.event_id, "e1");
  assert.strictEqual(ev.action_source, "website"); assert.strictEqual(ev.custom_data.content_name, "B");
  assert.strictEqual(ev.user_data.em[0], crypto.createHash("sha256").update("foo@example.com").digest("hex"));
  assert.match(ev.user_data.fbc, /^fb\.1\.\d+\.ABC123xyz$/); // built from fbclid when no cookie
  assert.strictEqual(ev.user_data.fbp, "fb.1.1.2"); assert.strictEqual(f.body.test_event_code, "TEST1");
  assert(!("client_ip_address" in ev.user_data));
  assert(!JSON.stringify(f.body.data).includes("Foo@Example"), "plain email must not be sent to Meta");
  const row = t.grid[1];
  assert.strictEqual(row[1], "Foo@Example.com"); assert.strictEqual(row[3], "B"); assert.strictEqual(row[6], "B");
  assert.strictEqual(row[7], "ABC123xyz"); assert.strictEqual(row[8], "e1"); assert.strictEqual(row[9], "200");
  assert.deepStrictEqual(t.grid[0].slice(0, 3), ["Timestamp", "Email", "Source"]);

  // duplicate (different case) -> ok, duplicate, no CAPI, no new row
  r = t.post({ ...base, email: "foo@example.com", event_id: "e2" });
  assert.deepStrictEqual(r, { ok: true, duplicate: true, event_id: "e1" });
  assert.strictEqual(t.fetches.length, 1); assert.strictEqual(t.grid.length, 2);
  // retry of the same submission is idempotent and not flagged duplicate
  r = t.post({ ...base, email: "foo@example.com", event_id: "e1" });
  assert.strictEqual(r.duplicate, false); assert.strictEqual(t.fetches.length, 1);

  // survey updates same row, rejects junk
  assert.deepStrictEqual(t.post({ action: "survey", event_id: "e1", q_fiber_now: "Powder" }), { ok: true });
  assert.deepStrictEqual(t.post({ action: "survey", event_id: "e1", q_price: "$12" }), { ok: true });
  assert.strictEqual(t.grid[1][10], "Powder"); assert.strictEqual(t.grid[1][11], "$12");
  assert.strictEqual(t.formats["2,12"], "@"); // "$12" kept as text, not currency
  assert.deepStrictEqual(t.post({ action: "survey", event_id: "e1", q_channel: "Amazon" }), { ok: true });
  assert.strictEqual(t.post({ action: "survey", event_id: "e1", q_channel: "Costco" }).ok, false);
  assert.strictEqual(t.post({ action: "survey", event_id: "e1", q_price: "$99" }).ok, false);
  assert.strictEqual(t.post({ action: "survey", event_id: "nope", q_price: "$8" }).ok, false);

  // bad email, formula injection
  assert.strictEqual(t.post({ ...base, email: "nope", event_id: "e3" }).ok, false);
  assert.strictEqual(t.post({ ...base, email: "=1+1@x.com", event_id: "e3" }).ok, false);

  // CAPI failure: row saved, user still ok, status recorded
  t = makeEnv({ META_PIXEL_ID: "111", META_CAPI_TOKEN: "TOK" });
  t.sandbox.__capiStatus = 400;
  r = t.post({ ...base, email: "a@b.co", event_id: "e9" });
  assert.strictEqual(r.ok, true); assert.match(t.grid[1][9], /^400: Invalid token/);
  assert(!("test_event_code" in t.fetches[0].body), "no test code when unset");
  assert(!t.grid[1].join("|").includes("TOK"), "token never stored");

  // no token configured: saved, skipped
  t = makeEnv({});
  r = t.post({ ...base, email: "c@d.co", event_id: "e8" });
  assert.strictEqual(r.ok, true); assert.match(t.grid[1][9], /^skipped/); assert.strictEqual(t.fetches.length, 0);

  // old existing sheet (3 headers + old row w/o event_id), old form-encoded page still works
  t = makeEnv({}); t.grid.push(["Timestamp", "Email", "Source"], ["d", "old@x.co", "https://basilseedfiber.com/"]);
  r = t.post({ ...base, email: "OLD@x.co", event_id: "e7" });
  assert.deepStrictEqual(r, { ok: true, duplicate: true, event_id: "e7" }); assert.strictEqual(t.grid[1][8], "e7");
  assert.strictEqual(t.grid[0][8], "event_id");
  console.log("apps-script logic: all assertions passed");
}

module.exports = { makeEnv };

if (process.argv.includes("--serve")) {
  const props = { META_PIXEL_ID: "1662330358569350", META_CAPI_TOKEN: "FAKE", META_TEST_EVENT_CODE: "TEST_LOCAL" };
  const t = makeEnv(props);
  const root = path.join(__dirname, "..");
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon" };
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    if (p === "/assets/config.js") { // point the page at the fake endpoint
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return res.end(fs.readFileSync(path.join(root, p), "utf8").replace(/FORM_ENDPOINT:\s*"[^"]*"/, 'FORM_ENDPOINT: "http://localhost:8138/exec"').replace(/META_PIXEL_ID:\s*"[^"]*"/, `META_PIXEL_ID: "${process.env.FAKE_TAGS ? "1" : ""}"`).replace(/GA4_ID:\s*"[^"]*"/, `GA4_ID: "${process.env.FAKE_TAGS ? "G-TEST000000" : ""}"`)); // local runs must not send real Pixel/GA events
    }
    if (p === "/__state") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ rows: t.grid, fetches: t.fetches.map((f) => f.body) }, null, 1)); }
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(8137);
  http.createServer((req, res) => {
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (req.method === "OPTIONS") { res.writeHead(403, cors); return res.end(); } // Apps Script can't answer preflights
    let data = ""; req.on("data", (c) => (data += c));
    req.on("end", () => {
      const out = req.method === "POST" ? t.sandbox.doPost({ postData: { contents: data }, parameter: {} }).text : '{"ok":true}';
      setTimeout(() => { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); res.end(out); }, 400);
    });
  }).listen(8138, () => console.log("site http://localhost:8137  fake exec http://localhost:8138/exec  state http://localhost:8137/__state"));
}
