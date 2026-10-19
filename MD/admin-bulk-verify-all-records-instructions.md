# Admin: Verify All Records (Bulk Verification) — Instructions for Claude Code

**Date:** 2026-10-19
**Raised by:** Michaela
**Type:** New feature — administrator bulk-verification of submissions from the verification queue.
**Scope:** `pages/awaiting-verification.html` (the verification-action page), `public/lib/signoff-block.js`, `src/index.js` (or wherever `/api/storage/key/` writes are handled), `public/lib/permission-rules.js`.
**Role gate:** `ADMINISTRATOR` only. No other role sees or can trigger bulk-verify.
**Traceability:** Every bulk-verified record must carry a full audit trail identical to a normal per-record verification — `verifiedBy`, `verifiedTitle`, `verifiedDate`, `verifiedSignature`, plus `bulkVerifiedBy` flag for reporting.

---

## 0 — Context: how single verification works today

Read these files before making any changes:

- `public/lib/signoff-block.js` — `mountVerification()`, `submitVerification()`, `verifyGate()`
- `public/lib/permission-rules.js` — `can()` short-circuits true for `ADMINISTRATOR`
- `pages/awaiting-verification.html` (or whatever the actual filename is — grep for "Awaiting Verification" in `public/pages/`)

A submission is "verified" when `sub.verification` is set to an object:

```jsonc
{
  "verifiedBy": "Jane Smith",
  "verifiedTitle": "Quality Supervisor",   // role label, not a DB title column
  "verifiedDate": "2026-10-19",
  "verifiedSignature": "JS01"
}
```

This object is written back via the existing `/api/storage/key/` endpoint (PUT to the key that holds the submission JSON blob).

---

## 1 — UI changes to `pages/awaiting-verification.html`

### 1.1 — Show the bulk-verify toolbar only for Administrator

Wrap the entire bulk-verify UI in a role check. At page load, after `Auth.getCurrentRole()` resolves, add or remove the `admin-bulk-bar` element:

```js
const isAdmin = window.Auth?.getCurrentRole?.() === 'ADMINISTRATOR';
document.getElementById('admin-bulk-bar').style.display = isAdmin ? '' : 'none';
```

### 1.2 — Add checkboxes to every row

Add a `<th>` checkbox column as the **first column** of the table (before Record, Ref, Date, Submitted By, etc.):

```html
<th style="width:36px;">
  <input type="checkbox" id="bulk_select_all" title="Select all">
</th>
```

Each data row gets a matching `<td>`:

```html
<td><input type="checkbox" class="bulk-row-cb" data-submission-id="{{submissionId}}" data-record-key="{{recordKey}}"></td>
```

Wire up "select all":

```js
document.getElementById('bulk_select_all').addEventListener('change', function () {
  document.querySelectorAll('.bulk-row-cb').forEach(cb => cb.checked = this.checked);
  updateBulkBar();
});
document.querySelectorAll('.bulk-row-cb').forEach(cb =>
  cb.addEventListener('change', updateBulkBar)
);

function updateBulkBar() {
  const count = document.querySelectorAll('.bulk-row-cb:checked').length;
  document.getElementById('bulk_selected_count').textContent = count;
  document.getElementById('bulk_verify_btn').disabled = count === 0;
}
```

### 1.3 — Add the bulk-verify toolbar (admin only)

Insert this bar above the table (hidden by default, shown only when `isAdmin`):

```html
<div id="admin-bulk-bar" style="display:none; background:#fffbea; border:1px solid #f59e0b;
     border-radius:6px; padding:10px 14px; margin-bottom:12px; display:flex;
     align-items:center; gap:12px; flex-wrap:wrap;">
  <strong style="color:#92400e;">⚡ Admin bulk verification</strong>
  <span style="color:#555;">
    <span id="bulk_selected_count">0</span> record(s) selected
  </span>
  <button id="bulk_verify_btn" class="btn btn-primary" disabled
          onclick="openBulkVerifyModal()">
    Verify selected
  </button>
  <button class="btn btn-secondary" onclick="
    document.querySelectorAll('.bulk-row-cb').forEach(cb=>cb.checked=true);
    updateBulkBar();">
    Select all visible
  </button>
  <button class="btn btn-secondary" onclick="
    document.querySelectorAll('.bulk-row-cb').forEach(cb=>cb.checked=false);
    document.getElementById('bulk_select_all').checked=false;
    updateBulkBar();">
    Clear selection
  </button>
</div>
```

### 1.4 — Bulk-verify confirmation modal

Add a modal that collects the administrator's sign-off fields once and applies them to all selected records. Show it via `openBulkVerifyModal()`:

```js
function openBulkVerifyModal() {
  const count = document.querySelectorAll('.bulk-row-cb:checked').length;
  if (!count) return;

  const html = `
    <div id="bvm_overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;
         display:flex;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:8px;padding:24px;width:min(480px,95vw);
                  box-shadow:0 8px 32px rgba(0,0,0,.18);">
        <h3 style="margin:0 0 16px;">Bulk verify ${count} record(s)</h3>
        <p style="color:#555;margin:0 0 16px;font-size:13px;">
          Your sign-off will be applied to all <strong>${count}</strong> selected submissions.
          This action is logged against your account and cannot be undone.
        </p>
        <label style="display:block;margin-bottom:10px;">
          <span style="font-weight:600;">Verified by <span style="color:red">*</span></span>
          <input id="bvm_by" class="form-control" placeholder="Your full name" style="margin-top:4px;">
        </label>
        <label style="display:block;margin-bottom:10px;">
          <span style="font-weight:600;">Title / Role <span style="color:red">*</span></span>
          <input id="bvm_title" class="form-control" placeholder="e.g. Administrator" style="margin-top:4px;">
        </label>
        <label style="display:block;margin-bottom:10px;">
          <span style="font-weight:600;">Date <span style="color:red">*</span></span>
          <input id="bvm_date" type="date" class="form-control" style="margin-top:4px;">
        </label>
        <label style="display:block;margin-bottom:16px;">
          <span style="font-weight:600;">Passkey / Signature <span style="color:red">*</span></span>
          <input id="bvm_sig" class="form-control" placeholder="Your passkey or initials" style="margin-top:4px;">
        </label>
        <div id="bvm_err" style="color:red;font-size:13px;margin-bottom:10px;display:none;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeBulkVerifyModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitBulkVerify()">
            ✓ Confirm — verify ${count} records
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // Pre-fill from current user
  document.getElementById('bvm_by').value    = window.Auth?.getCurrentUser?.() || '';
  document.getElementById('bvm_title').value = window.Auth?.getCurrentRole?.() || 'Administrator';
  document.getElementById('bvm_date').value  = new Date().toISOString().slice(0, 10);
}

function closeBulkVerifyModal() {
  document.getElementById('bvm_overlay')?.remove();
}
```

### 1.5 — `submitBulkVerify()` — client-side orchestration

```js
async function submitBulkVerify() {
  const by    = document.getElementById('bvm_by').value.trim();
  const title = document.getElementById('bvm_title').value.trim();
  const date  = document.getElementById('bvm_date').value;
  const sig   = document.getElementById('bvm_sig').value.trim();
  const errEl = document.getElementById('bvm_err');

  if (!by || !title || !date || !sig) {
    errEl.textContent = 'All fields are required.';
    errEl.style.display = '';
    return;
  }

  // Verify passkey against server (reuse existing passkey check)
  const validSig = await verifyPasskey(sig); // see §2 — returns true/false
  if (!validSig) {
    errEl.textContent = 'Passkey is incorrect. Verification cancelled.';
    errEl.style.display = '';
    return;
  }

  const selected = Array.from(document.querySelectorAll('.bulk-row-cb:checked'))
    .map(cb => ({ submissionId: cb.dataset.submissionId, recordKey: cb.dataset.recordKey }));

  closeBulkVerifyModal();

  showToast(`Verifying ${selected.length} records…`, 'info');

  const results = { ok: 0, fail: 0, errors: [] };

  for (const item of selected) {
    try {
      await applyVerification(item.recordKey, item.submissionId, { by, title, date, sig });
      results.ok++;
    } catch (e) {
      results.fail++;
      results.errors.push(`${item.submissionId}: ${e.message}`);
    }
  }

  if (results.fail === 0) {
    showToast(`✓ ${results.ok} record(s) verified successfully.`, 'success');
  } else {
    showToast(
      `${results.ok} verified, ${results.fail} failed. Check console for details.`,
      'warning'
    );
    console.error('Bulk verify failures:', results.errors);
  }

  // Reload the queue to reflect the new state
  setTimeout(() => location.reload(), 1500);
}
```

### 1.6 — `applyVerification()` helper

This mirrors exactly what `signoff-block.js`'s `submitVerification()` does for a single record, but called programmatically:

```js
async function applyVerification(recordKey, submissionId, { by, title, date, sig }) {
  // 1. Fetch the current submission blob
  const key = `formrecord:${recordKey}`;
  const res = await fetch(`/api/storage/key/${encodeURIComponent(key)}`, {
    headers: { 'x-access-key': window.getAccessKey?.() || '' }
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const store = await res.json();

  // 2. Find the submission by ID
  // Adapt to the actual store shape — check form-record.js's loadEntries() for the exact path
  const entries = store.entries || store.data || store;
  const sub = entries.find(e => e.id === submissionId);
  if (!sub) throw new Error(`Submission ${submissionId} not found`);

  // 3. Apply verification
  sub.verification = {
    verifiedBy:        by,
    verifiedTitle:     title,
    verifiedDate:      date,
    verifiedSignature: sig,
    verifiedAt:        new Date().toISOString(),
    bulkVerifiedBy:    window.Auth?.getCurrentUser?.() || by,
    bulkVerified:      true
  };

  // 4. Write the updated blob back
  const putRes = await fetch(`/api/storage/key/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-access-key': window.getAccessKey?.() || ''
    },
    body: JSON.stringify(store)
  });
  if (!putRes.ok) throw new Error(`Write failed (${putRes.status})`);
}
```

> **Important:** The store shape (`store.entries`, `store.data`, or a flat array) must match exactly how `form-record.js` reads and writes submissions for `recordKey`. Read `loadEntries()` in `form-record.js` before coding this — do not guess the shape.

---

## 2 — Passkey verification (`verifyPasskey`)

Reuse the existing passkey-check endpoint. Find the endpoint used by `signoff-block.js` when a user submits their passkey on a normal verification (likely `POST /api/passkeys/verify` or similar). Call the same endpoint:

```js
async function verifyPasskey(sig) {
  try {
    const res = await fetch('/api/passkeys/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-key': window.getAccessKey?.() || ''
      },
      body: JSON.stringify({
        username: window.Auth?.getCurrentUser?.(),
        passkey: sig
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true || data.ok === true;
  } catch {
    return false;
  }
}
```

> Find the exact endpoint and request/response shape by searching `src/index.js` for the passkey-verify route. Adapt the body and response check to match what the server expects.

---

## 3 — Server side: no new endpoint required

The bulk-verify feature writes via the existing `/api/storage/key/` PUT endpoint, one submission at a time, from the client. No new API route is needed.

**However:** Add a server-side guard on that endpoint so that writing a `sub.verification` object is rejected unless the caller's role is in `['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMINISTRATOR']` (reuse the existing `verifyRecord` permission list in `permission-rules.js`). If this guard already exists, confirm it and document it in the work log.

---

## 4 — Audit trail requirements (traceability)

Every bulk-verified submission must carry:

| Field | Value |
|---|---|
| `sub.verification.verifiedBy` | Admin's full name (from the modal) |
| `sub.verification.verifiedTitle` | Admin's role label |
| `sub.verification.verifiedDate` | Date selected in modal |
| `sub.verification.verifiedSignature` | Passkey/initials entered |
| `sub.verification.verifiedAt` | ISO timestamp at time of write |
| `sub.verification.bulkVerified` | `true` |
| `sub.verification.bulkVerifiedBy` | `Auth.getCurrentUser()` — the logged-in account username |

This is identical to a normal single-record verification except for the last two fields. The submissions log, drying report, and any other page that reads `sub.verification` will continue to work without changes, because the shape is backward-compatible.

---

## 5 — Filtering: only show unverified records in the queue

The existing awaiting-verification page should already filter to only submissions where `!sub.verification`. Confirm this is the case. If not, add a filter so that the bulk-select checkboxes are only rendered for unverified rows.

---

## 6 — Role gate summary

| Action | Roles permitted |
|---|---|
| See bulk-verify toolbar and checkboxes | `ADMINISTRATOR` only |
| Verify individual records (existing) | `QUALITY_SUPERVISOR`, `QA_MANAGER`, `PRODUCTION_MANAGER`, `SHIFT_MANAGER`, `ADMINISTRATOR` |
| Bulk-verify via this feature | `ADMINISTRATOR` only |

---

## 7 — Testing checklist

1. Log in as **Quality Supervisor** — confirm bulk-verify toolbar and checkboxes are **not visible**.
2. Log in as **Administrator** — confirm toolbar and checkboxes appear on the awaiting-verification page.
3. Select one record, click **Verify selected**, fill in all fields with a valid passkey → confirm the record disappears from the queue and `sub.verification` is set correctly in the database.
4. Select all records, bulk-verify → confirm all disappear from queue and each has a full `verification` object with `bulkVerified: true`.
5. Enter an **invalid passkey** → confirm bulk-verify is rejected, no records are written.
6. Leave a required field blank in the modal → confirm validation prevents submission.
7. Open the Submissions Log — confirm bulk-verified records show the verifier's name and date exactly as single-verified records do.
8. Check the database directly (Neon query tool) — confirm `bulkVerified` and `bulkVerifiedBy` are present on each written submission.

---

## 8 — Commit and deploy

```bash
git add public/pages/awaiting-verification.html
git add public/lib/signoff-block.js   # only if changed
git add public/lib/permission-rules.js  # only if changed
git commit -m "feat: admin bulk-verify all records from verification queue

- Bulk-verify toolbar visible to ADMINISTRATOR only
- Per-row checkboxes + select-all in awaiting-verification page
- Modal collects verifiedBy/title/date/passkey once, applies to all selected
- applyVerification() writes sub.verification via existing storage endpoint
- Audit trail: bulkVerified=true + bulkVerifiedBy on each written record
- Passkey validated against existing passkey-verify endpoint before any write
- Role gate: bulk toolbar hidden from all non-admin roles

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JTwM88tZgMWj3hg54MeGr5"
git push origin main
```

---

## Work log

- **2026-10-19** — Instruction file created by Michaela / Claude. Feature: admin bulk-verify all records.
- Before coding, confirm:
  - [ ] Exact filename of the awaiting-verification/action page (grep `public/pages/` for "Awaiting Verification" heading).
  - [ ] Store shape for `formrecord:<recordKey>` (check `form-record.js` `loadEntries()`).
  - [ ] Passkey-verify endpoint path and request body (grep `src/index.js` for passkey route).
  - [ ] Existing passkey-verify route already used by `signoff-block.js`.
