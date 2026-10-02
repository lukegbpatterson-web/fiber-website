# Waitlist backend: deploy steps

`Code.gs` replaces the old `google-apps-script/waitlist.gs`. It saves the row, sends the Meta Conversions API Lead event, and returns `{ ok, duplicate, event_id }` to the page.

**Order matters: deploy this script BEFORE pushing the new site.** The new pages expect the JSON reply; the old script can't give it. (The new script still accepts the old form-encoded posts, so the reverse order is harmless.)

## 1. Paste the code
1. Open the waitlist Google Sheet, then **Extensions > Apps Script**.
2. Select everything in the editor's `Code.gs`, delete it, and paste in the contents of `apps-script/Code.gs` from this repo.
3. **Save** (disk icon).

## 2. Set the three Script Properties
**Project Settings** (gear icon, left) > **Script Properties** > **Add script property**:

| Property | Value |
|---|---|
| `META_PIXEL_ID` | `1662330358569350` |
| `META_CAPI_TOKEN` | the Conversions API access token from Events Manager (Settings > Conversions API > Generate access token) |
| `META_TEST_EVENT_CODE` | the code from Events Manager > **Test events** (looks like `TEST12345`). **Only while testing; delete the property afterwards** or real events will be flagged as test events |

Never put the token in the repo or in chat.

## 3. Authorize the script to contact Meta (required once)
The script now calls an outside service (Meta), which needs a new permission. If you skip this, `capi_status` shows `Exception: You do not have permission to call UrlFetchApp.fetch`.
1. In the Apps Script editor, open the function dropdown at the top (next to **Run**) and choose **authorize**.
2. Click **Run**. A dialog says "Authorization required": **Review permissions**, pick your Google account, then **Advanced > Go to (project name) (unsafe)** if shown, and **Allow**.
3. The log should say "External requests authorized".

## 4. Redeploy as a NEW VERSION of the existing deployment (URL stays the same)
1. **Deploy > Manage deployments**.
2. Click the **pencil (Edit)** icon on the existing Web app deployment.
3. **Version** dropdown > **New version**. Add a description like "Conversions API + survey".
4. Confirm *Execute as: Me* and *Who has access: Anyone*, then **Deploy**.
5. The `/exec` URL does not change, so `assets/config.js` needs no edit. Do **not** use "New deployment": that makes a new URL.

Check it: open the `/exec` URL in a browser. You should see `{"ok":true,"service":"bayzl waitlist"}`.

## 5. Sheet columns
The script appends these to the right of the existing `Timestamp, Email, Source` (it fills the header cells itself on the first submit):
`variant, utm_source, utm_campaign, utm_content, fbclid, event_id, capi_status, q_fiber_now, q_price`

- `capi_status` is `200` when Meta accepted the event. Anything else shows the HTTP code and Meta's message (e.g. `400: Invalid OAuth access token`). The row is saved either way.
- `skipped: ...` means the token or Pixel ID property is missing.
- Old rows have blank `event_id`; if one of those emails rejoins, it is treated as a duplicate and gets an id.

## Logs
Apps Script editor > **Executions** shows every request and any logged Conversions API error.

## Local test (no Google account)
```bash
node apps-script/test-local.js            # assertions on the script logic
node apps-script/test-local.js --serve    # site on :8137 with a fake in-memory backend on :8138
```
The Meta call is stubbed (recorded, never sent) and the Pixel/GA are blanked, so local runs send nothing real.
