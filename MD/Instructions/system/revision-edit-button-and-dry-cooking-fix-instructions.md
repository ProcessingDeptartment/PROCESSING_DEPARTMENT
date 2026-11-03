# Edit Revision Button on Master Record Index + Dry Cooking Rev 7 Fix

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Scope:** `public/lib/document-revision.js`, `public/lib/master-index-data.js`, `public/records/master-record-index.html`

---

## What this adds

1. **Dry Cooking date fix** — Update REC 7.4.0 baseline date in `master-index-data.js` from `30/03/2026` to `03/03/2026`, and write a DocumentRevision backend entry for `dry-cooking` at Rev 7 with that date.
2. **Edit Revision button** — New admin button at the top of the Master Record Index, next to "Edit Document Headers". Opens a modal to set any record's revision number and revision date.
3. **Password-protected save** — The modal requires the admin's passkey before saving, and every change is appended to the DocumentRevision audit log.

---

## 1. Fix: `public/lib/master-index-data.js`

Find the row for `REC 7.4.0`. It currently reads:

```js
{
    "docNo": "REC 7.4.0",
    "name": "Dry Cooking",
    "details": "Reviewed for new process",
    "revision": 7,
    ...
    "dateOfIssue": "30/03/2026",
    "recordKey": "dry-cooking",
    "href": "REC-7.4.0-dry-cooking.html"
},
```

Change **only** `"dateOfIssue"` from `"30/03/2026"` to `"03/03/2026"`:

```js
"dateOfIssue": "03/03/2026",
```

`"revision": 7` is already correct — do not change it.

**After editing, bump the `?v=` on every file that loads `master-index-data.js`:**

```bash
grep -rl "master-index-data.js" public/records/
```

Currently:
- `public/records/record-list.html` — `?v=4` → change to `?v=5`
- `public/records/master-record-index.html` — `?v=8` → change to `?v=9`

---

## 2. New function: `public/lib/document-revision.js`

The existing `bump()` function auto-increments the revision number. Add a new `setRevision()` function that lets admins write any specific revision number and date, with the same audit fields.

Add this function **before** the `window.DocumentRevision = {...}` line at the bottom:

```js
async function setRevision(recordKey, revisionNumber, isoDate, meta) {
  meta = meta || {};
  if (!meta.reason || !String(meta.reason).trim()) {
    throw new Error('A reason is required.');
  }
  if (!meta.changedBy || !String(meta.changedBy).trim()) {
    throw new Error('A name is required.');
  }
  if (!meta.changedByTitle || !String(meta.changedByTitle).trim()) {
    throw new Error('A title is required.');
  }
  if (!revisionNumber || isNaN(Number(revisionNumber)) || Number(revisionNumber) < 1) {
    throw new Error('A valid revision number is required.');
  }
  const existing = await loadHistory(recordKey);
  const entry = {
    revisionNumber: Number(revisionNumber),
    reason: meta.reason,
    changedBy: meta.changedBy,
    changedByTitle: meta.changedByTitle,
    changedAt: isoDate ? new Date(isoDate).getTime() : Date.now(),
    setManually: true
  };
  existing.push(entry);
  await window.storage.set('document_revision:' + recordKey, JSON.stringify(existing), true);
  return entry;
}
```

Then add `setRevision` to the export at the bottom:

```js
window.DocumentRevision = { getCurrent, getCurrentDate, history, bump, bumpAll, latestAll, setRevision };
```

**Bump the `?v=` for `document-revision.js`** wherever it is referenced:

```bash
grep -rl "document-revision.js" public/records/
```

Change from the current version (e.g. `?v=3`) to `?v=4` in all files found.

---

## 3. `public/records/master-record-index.html`

### 3a. CSS — add inside the existing `<style>` block

```css
/* Edit Revision modal */
#revModal { display:none; position:fixed; inset:0; z-index:9000; background:rgba(0,0,0,.5); align-items:center; justify-content:center; }
#revModal.open { display:flex; }
#revModalBox { background:#fff; border-radius:8px; padding:28px 32px; width:100%; max-width:480px; box-shadow:0 8px 32px rgba(0,0,0,.18); }
#revModalBox h3 { margin:0 0 18px; font-size:16px; color:#1b2330; }
.rev-field { margin-bottom:14px; }
.rev-field label { display:block; font-size:11.5px; font-weight:600; color:#4b5563; margin-bottom:4px; }
.rev-field input, .rev-field select, .rev-field textarea {
  width:100%; padding:8px 10px; border:1px solid #d0d5db; border-radius:5px;
  font-size:13px; font-family:inherit; box-sizing:border-box;
}
.rev-field input:focus, .rev-field select:focus, .rev-field textarea:focus {
  outline:none; border-color:#1d4ed8; box-shadow:0 0 0 3px rgba(29,78,216,.1);
}
.rev-modal-actions { display:flex; gap:10px; margin-top:20px; justify-content:flex-end; }
.btn-rev-save { background:#1d4ed8; color:#fff; border:none; padding:8px 22px; border-radius:5px; cursor:pointer; font-size:13px; font-weight:600; }
.btn-rev-save:disabled { opacity:.5; cursor:default; }
.btn-rev-cancel { background:none; border:1px solid #d0d5db; padding:8px 16px; border-radius:5px; cursor:pointer; font-size:13px; color:#6b7280; }
#revModalMsg { font-size:12px; color:#dc2626; margin-top:8px; min-height:18px; }
```

---

### 3b. HTML — the Edit Revision button

Find the existing "Edit Document Headers" button in the top toolbar area. It looks something like:

```html
<button id="editHeadersBtn" ...>Edit Document Headers</button>
```

Add the new button **immediately after** it:

```html
<button id="editRevBtn" class="btn-tool" style="display:none;" title="Set a record's revision number and date">Edit Revision</button>
```

---

### 3c. HTML — the Edit Revision modal

Add this block just before the closing `</body>` tag:

```html
<!-- Edit Revision Modal -->
<div id="revModal" role="dialog" aria-modal="true" aria-labelledby="revModalTitle">
  <div id="revModalBox">
    <h3 id="revModalTitle">Edit Document Revision</h3>

    <div class="rev-field">
      <label for="revSelectRecord">Record</label>
      <select id="revSelectRecord">
        <option value="">— select a record —</option>
      </select>
    </div>

    <div class="rev-field">
      <label for="revNumber">Revision number</label>
      <input type="number" id="revNumber" min="1" max="99" placeholder="e.g. 7">
    </div>

    <div class="rev-field">
      <label for="revDate">Revision date</label>
      <input type="date" id="revDate">
    </div>

    <div class="rev-field">
      <label for="revReason">Reason for change</label>
      <textarea id="revReason" rows="2" placeholder="e.g. Updated process — new cooking times"></textarea>
    </div>

    <div class="rev-field">
      <label for="revName">Changed by (name)</label>
      <input type="text" id="revName" placeholder="Full name">
    </div>

    <div class="rev-field">
      <label for="revTitle">Position / title</label>
      <input type="text" id="revTitle" placeholder="e.g. QC Manager">
    </div>

    <div class="rev-field">
      <label for="revPasskey">Admin passkey <span style="color:#6b7280;font-weight:400;">(required to save)</span></label>
      <input type="password" id="revPasskey" placeholder="Enter admin passkey" autocomplete="off">
    </div>

    <div id="revModalMsg"></div>

    <div class="rev-modal-actions">
      <button class="btn-rev-cancel" id="revCancelBtn">Cancel</button>
      <button class="btn-rev-save" id="revSaveBtn">Save revision</button>
    </div>
  </div>
</div>
```

---

### 3d. JS — wire up the Edit Revision button and modal

Add the following script block at the **bottom of the inline `<script>`**, just before the closing `})();` of the main IIFE:

```js
// ---- Edit Revision button ----

function openRevModal() {
  // Populate the record dropdown from all rows that have a recordKey
  const sel = document.getElementById('revSelectRecord');
  sel.innerHTML = '<option value="">— select a record —</option>';
  const withKeys = ROWS
    .filter(r => r.recordKey)
    .sort((a, b) => (a.docNo || '').localeCompare(b.docNo || '', undefined, { numeric: true, sensitivity: 'base' }));
  withKeys.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.recordKey;
    opt.textContent = (r.docNo ? r.docNo + ' — ' : '') + r.name;
    sel.appendChild(opt);
  });

  // Clear fields
  document.getElementById('revNumber').value = '';
  document.getElementById('revDate').value = '';
  document.getElementById('revReason').value = '';
  document.getElementById('revName').value = '';
  document.getElementById('revTitle').value = '';
  document.getElementById('revPasskey').value = '';
  document.getElementById('revModalMsg').textContent = '';
  document.getElementById('revSaveBtn').disabled = false;

  document.getElementById('revModal').classList.add('open');
  document.getElementById('revSelectRecord').focus();
}

function closeRevModal() {
  document.getElementById('revModal').classList.remove('open');
}

// When a record is selected, pre-fill its current revision number
document.getElementById('revSelectRecord').addEventListener('change', async function () {
  const key = this.value;
  if (!key) return;
  const row = ROWS.find(r => r.recordKey === key);
  try {
    const cur = await window.DocumentRevision.getCurrent(key, row ? (row.revision || 1) : 1);
    document.getElementById('revNumber').value = cur;
  } catch (e) { /* leave blank */ }
  // Pre-fill date to today
  document.getElementById('revDate').value = new Date().toISOString().slice(0, 10);
});

document.getElementById('editRevBtn').addEventListener('click', openRevModal);
document.getElementById('revCancelBtn').addEventListener('click', closeRevModal);

// Close modal on backdrop click
document.getElementById('revModal').addEventListener('click', function (e) {
  if (e.target === this) closeRevModal();
});

// Save handler
document.getElementById('revSaveBtn').addEventListener('click', async function () {
  const msg = document.getElementById('revModalMsg');
  const saveBtn = this;

  const recordKey = document.getElementById('revSelectRecord').value;
  const revNumber = document.getElementById('revNumber').value.trim();
  const revDate = document.getElementById('revDate').value;
  const reason = document.getElementById('revReason').value.trim();
  const name = document.getElementById('revName').value.trim();
  const title = document.getElementById('revTitle').value.trim();
  const passkey = document.getElementById('revPasskey').value;

  msg.textContent = '';
  msg.style.color = '#dc2626';

  if (!recordKey) { msg.textContent = 'Please select a record.'; return; }
  if (!revNumber || isNaN(Number(revNumber)) || Number(revNumber) < 1) {
    msg.textContent = 'Enter a valid revision number.'; return;
  }
  if (!revDate) { msg.textContent = 'Enter the revision date.'; return; }
  if (!reason) { msg.textContent = 'Enter a reason for the change.'; return; }
  if (!name) { msg.textContent = 'Enter the name of who is making this change.'; return; }
  if (!title) { msg.textContent = 'Enter a position / title.'; return; }
  if (!passkey) { msg.textContent = 'Enter the admin passkey.'; return; }

  // Verify passkey via Auth
  let passkeyOk = false;
  try {
    // window.Auth.verifyPasskey returns true/false (or throws on invalid)
    passkeyOk = await window.Auth.verifyPasskey(passkey);
  } catch (e) {
    passkeyOk = false;
  }
  if (!passkeyOk) {
    msg.textContent = 'Incorrect passkey. Change not saved.'; return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const row = ROWS.find(r => r.recordKey === recordKey);
    const entry = await window.DocumentRevision.setRevision(
      recordKey,
      Number(revNumber),
      revDate,
      { reason, changedBy: name, changedByTitle: title }
    );
    msg.style.color = '#15803d';
    msg.textContent = `Saved — ${row ? row.docNo + ' ' + row.name : recordKey} set to Rev ${entry.revisionNumber} (${revDate}).`;
    saveBtn.textContent = 'Saved ✓';
    setTimeout(closeRevModal, 1800);
  } catch (e) {
    msg.style.color = '#dc2626';
    msg.textContent = 'Error: ' + e.message;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save revision';
  }
});
```

---

### 3e. Show the button for admins in `init()`

In `init()`, after the line:

```js
document.body.classList.toggle('no-archive-col', !isAdmin);
```

Add:

```js
document.getElementById('editRevBtn').style.display = isAdmin ? '' : 'none';
```

---

## 4. Set Dry Cooking to Rev 7 in the backend (one-time data fix)

After deployment, do this once from the browser console while logged in as admin on the master record index page:

```js
// Paste in the browser console — sets dry-cooking to Rev 7, dated 03 March 2026
await window.DocumentRevision.setRevision(
  'dry-cooking',
  7,
  '2026-03-03',
  {
    reason: 'Reviewed for new process — revision date corrected to 03/03/2026',
    changedBy: 'Michaela',
    changedByTitle: 'QC Manager'
  }
);
```

This writes a history entry with `revisionNumber: 7` and `changedAt: 2026-03-03T00:00:00.000Z`, so both the master index and the record list will display **Rev 7** for dry cooking. If a DocumentRevision entry already exists for `dry-cooking` at a lower number, the new entry appended above becomes the latest and will supersede it.

---

## 5. How `window.Auth.verifyPasskey` should work

The modal's save uses `window.Auth.verifyPasskey(passkey)`. Check `public/lib/auth.js` for the current implementation.

If `verifyPasskey` does not yet exist on `window.Auth`, add it inside `auth.js` following this pattern:

```js
// Inside the Auth module, after the existing methods:
async function verifyPasskey(input) {
  try {
    const raw = await window.storage.get('admin_passkey', true);
    const stored = raw && raw.value ? raw.value : '';
    return stored && input === stored;
  } catch (e) {
    return false;
  }
}
// Add verifyPasskey to the window.Auth export
```

> If the passkey is stored differently (e.g. hashed, or checked against a fixed salt), adapt accordingly. The point is that the modal should fail to save if the passkey is wrong, and the attempt should be silent (no alert, just the inline error message in `#revModalMsg`).

---

## 6. `document-revision.js` — version bump

This file is loaded in multiple pages. After adding `setRevision`, bump its `?v=` everywhere:

```bash
grep -rl "document-revision.js" public/records/ public/lib/
```

Increment each `?v=N` by 1.

---

## 7. Commit message template

```
feat: edit-revision button on master index; dry-cooking date fix; setRevision() API

- master-index-data.js: REC 7.4.0 dateOfIssue corrected 30/03/2026 → 03/03/2026
- document-revision.js: add setRevision(recordKey, number, isoDate, meta) — writes
  a specific rev number with admin audit fields to the history array
- master-record-index.html:
    - "Edit Revision" button (admin-only) next to Edit Document Headers
    - Modal: record picker, revision number, date, reason, name, title, passkey
    - Passkey verified via window.Auth.verifyPasskey() before save
    - On success: appends entry via DocumentRevision.setRevision(), closes modal
- ?v= bumped: master-index-data.js (→v5 / →v9), document-revision.js (→v4)

One-time console fix: setRevision('dry-cooking', 7, '2026-03-03', {...}) to write
the Rev 7 backend entry for dry cooking.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3xX6Sjx1AVSdMX7bR
```
