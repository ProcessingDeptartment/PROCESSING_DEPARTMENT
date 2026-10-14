# Edit Submitted Record — Implementation Instructions

**File:** `public/lib/form-record.js`  
**Version bump required:** Yes — bump `?v=N` in every HTML file that references `form-record.js` after editing.

---

## Overview

Allow a submitted (or verified) record to be amended after the fact. Rules:

| Record state | Who may amend |
|---|---|
| Submitted (not yet verified) | Any user with `editSubmission` permission |
| Verified | **Only** the user whose role matches the verifier roles for this record (`SignOffBlock.verifyGate`) |

When amending, the user must supply:
1. **Reason for edit** — free-text, required before re-submission.
2. **Passkey sign-off** — same passkey field as the normal "Completed by" signature.

Every amendment is appended to `sub.amendments[]` on the submission object. If a verified record is amended its verification is cleared (status reverts to `'submitted'` and `sub.verification` is deleted).

---

## 1 — New state variable

Add `amendMode` alongside `editingId` and `formLocked` at the top of the state block inside `initForm` (search for `let formLocked = false;`):

```js
let amendMode = false;   // true while the user is editing a submitted/verified record
```

---

## 2 — New function: `openAmend(id)`

Add this function just after the closing brace of `openForm`:

```js
async function openAmend(id) {
  const sub = submissions.find(s => s.id === id);
  if (!sub) return;

  // Gate: verified records → only the verifier role may amend
  if (sub.verification) {
    const gate = await window.SignOffBlock.verifyGate(config.recordKey);
    if (!gate.allowed) {
      toast('Only ' + gate.rolesLabel + ' may amend a verified record. You are signed in as '
        + (gate.role ? window.SignOffBlock.roleLabel(gate.role) : 'not signed in') + '.');
      return;
    }
  }

  amendMode = true;
  openForm(id);   // renders the form; see changes to openForm below
}
```

---

## 3 — Modify `openForm` to support amend mode

Inside `openForm`, find the block that sets `locked` and builds the header HTML:

```js
// EXISTING (around line 3370):
const locked = isSubmitted(existing);
...
let html = ... + (locked
  ? `<div class="fr-locked">Submitted${existing.submittedAt
      ? ' on ' + fmtDateTimeAbbr(existing.submittedAt) : ''} — this submission can no longer be changed.</div>`
  : '');
```

Replace with:

```js
// Whether this record is locked for viewing (submitted AND not in amend mode)
const locked = isSubmitted(existing) && !amendMode;

let html = (window.NcRaise && existing ? window.NcRaise.bannerHtml(existing.nc_refs) : '');

if (isSubmitted(existing) && !amendMode) {
  // Normal view: show locked banner
  html += `<div class="fr-locked">Submitted${existing.submittedAt
    ? ' on ' + fmtDateTimeAbbr(existing.submittedAt) : ''} — this submission can no longer be changed.</div>`;
}

if (amendMode && existing) {
  // Amend mode: show amber amendment panel at the top of the form
  const wasVerified = !!existing.verification;
  html += `
    <div class="fr-amend-banner" style="padding:10px 13px;margin-bottom:12px;border-left:4px solid #c87800;
      background:#fff8ee;color:#7a4800;border-radius:0 4px 4px 0;">
      <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;">⚠ Amendment mode</strong>
      <div style="font-size:12px;margin-top:4px;">
        You are editing a ${wasVerified ? '<strong>verified</strong>' : 'submitted'} record.
        ${wasVerified ? 'Saving will <strong>clear the verification</strong> and return the record to Submitted status.' : ''}
        All changes are logged with a mandatory reason.
      </div>
      <label class="fr-field" style="margin-top:10px;display:block;">
        <span style="font-weight:600;font-size:12px;">Reason for amendment <span style="color:#a30000;">*</span></span>
        <textarea id="fr_amendReason" rows="2" style="width:100%;margin-top:4px;font-size:12.5px;
          border:1.5px solid #c87800;border-radius:4px;padding:6px;resize:vertical;"
          placeholder="Describe what is being corrected and why…"></textarea>
      </label>
    </div>`;
}
```

---

## 4 — Modify the "disable all inputs" pass for amend mode

Still inside `openForm`, find this line (around line 3555):

```js
container.querySelectorAll('input,select,textarea,button').forEach(i => {
  i.disabled = (locked && !i.hasAttribute('data-keep-enabled')) || computedIds.has(i.id);
});
```

No change needed — because `locked` is now `false` in amend mode, all inputs are already enabled. The `fr_amendReason` textarea is rendered inline in the amendment banner and does not need special treatment.

---

## 5 — Modify the Save/Submit button visibility for amend mode

Find (around line 3560):

```js
el('fr_saveBtn').style.display = locked ? 'none' : '';
el('fr_submitBtn').style.display = locked ? 'none' : '';
el('fr_cancelBtn').textContent = locked ? 'Close' : 'Clear';
```

Replace with:

```js
el('fr_saveBtn').style.display = (locked && !amendMode) ? 'none' : '';
el('fr_submitBtn').style.display = (locked && !amendMode) ? 'none' : '';
el('fr_submitBtn').textContent = amendMode ? 'Re-submit (amend)' : 'Submit';
el('fr_cancelBtn').textContent = (locked && !amendMode) ? 'Close' : (amendMode ? 'Cancel amendment' : 'Clear');
```

---

## 6 — Reset `amendMode` when the form is closed or a new form is opened

At the top of `openForm`, right after:

```js
function openForm(id) {
  editingId = id || null;
  pendingNc = []; ncHandled = new Set(); ncSkipped = []; specAccepted = {};
```

Add:

```js
  // If openForm is called for a new/draft entry (id is null or not an existing submitted record)
  // while amendMode is on, reset it — amendMode only applies to the specific record it was opened for.
  if (!id) amendMode = false;
  const calledInAmendMode = amendMode;   // snapshot for the rest of this call
```

Then replace every reference to `amendMode` inside `openForm` with `calledInAmendMode` so the correct snapshot is used:

> **Note:** this prevents `amendMode` from drifting if `openForm` is called re-entrantly. The snapshot `calledInAmendMode` is used for all HTML-building decisions inside that single call.

Also reset `amendMode` inside `closeForm`:

```js
function closeForm() {
  amendMode = false;
  editingId = null;
  openForm(null);
}
```

---

## 7 — Modify `saveForm` to validate + record amendments

Find inside `saveForm` (around line 3866–3870):

```js
const status = finalize ? 'submitted' : 'draft';
let savedSub;
if (editingId) {
  const existing = submissions.find(s => s.id === editingId);
  if (isSubmitted(existing)) { toast('This submission is submitted and can no longer be changed.'); return; }
```

Replace with:

```js
const status = finalize ? 'submitted' : 'draft';
let savedSub;
if (editingId) {
  const existing = submissions.find(s => s.id === editingId);

  // --- Amendment path ---
  if (isSubmitted(existing)) {
    if (!amendMode) {
      toast('This submission is submitted and can no longer be changed.');
      return;
    }
    // Amendment validation
    const amendReasonEl = el('fr_amendReason');
    const amendReason = amendReasonEl ? amendReasonEl.value.trim() : '';
    if (!amendReason) {
      if (amendReasonEl) amendReasonEl.focus();
      toast('A reason for amendment is required before re-submitting.');
      return;
    }
    // Passkey (fr_cb_signature) must be verified
    const sigEl = el('fr_cb_signature');
    if (!sigEl || !sigEl.value.trim() || sigEl.dataset.verified !== 'true') {
      toast('A valid passkey signature is required to amend a submitted record.');
      if (sigEl) sigEl.click();   // open the passkey pad
      return;
    }
    // Completed-by (name) must be filled
    const byEl = el('fr_cb_by');
    if (!byEl || !byEl.value.trim()) {
      toast('Please fill in "Completed by" before amending.');
      if (byEl) byEl.focus();
      return;
    }

    // Build amendment audit record
    const amendRecord = {
      ts: Date.now(),
      amendedBy: byEl.value.trim(),
      amendedByTitle: (el('fr_cb_title') || {}).value || '',
      amendedBySignature: sigEl.value.trim(),
      reason: amendReason,
      previousValues: existing.values,
      previousRoster: existing.roster,
      previousRosters: existing.rosters,
      previousCompletedBy: existing.completedBy,
      clearedVerification: !!existing.verification
    };

    // If the record was verified, clear verification so it returns to the verification queue
    if (existing.verification) {
      delete existing.verification;
    }

    existing.amendments = existing.amendments || [];
    existing.amendments.push(amendRecord);
    existing.history = existing.history || [];
    existing.history.push({
      ts: amendRecord.ts,
      previousValues: amendRecord.previousValues,
      previousRoster: amendRecord.previousRoster,
      previousRosters: amendRecord.previousRosters
    });
    existing.values = values;
    if (hasRoster) rosterList.forEach((roster, i) => setRosterRows(existing, i, roster.key, rosterRowsByIndex[i]));
    existing.updatedAt = Date.now();
    existing.status = 'submitted';         // stays submitted — not demoted to draft
    existing.submittedAt = existing.submittedAt || Date.now();
    existing.completedBy = completedBy;    // updated with the amender's sign-off
    savedSub = existing;
    amendMode = false;
    // Jump to the normal persist() path below — skip the regular editingId block
    // by doing an early goto-style jump using the savedSub guard:
    // (see the rest of saveForm — we fall through to the persist() call)
  } else {
    // Normal draft-edit path (unchanged):
    existing.history = existing.history || [];
    existing.history.push({
      ts: Date.now(), previousValues: existing.values,
      previousRoster: existing.roster, previousRosters: existing.rosters
    });
    existing.values = values;
    if (hasRoster) rosterList.forEach((roster, i) => setRosterRows(existing, i, roster.key, rosterRowsByIndex[i]));
    existing.updatedAt = Date.now();
    existing.status = status;
    if (finalize) { existing.submittedAt = Date.now(); existing.completedBy = completedBy; }
    savedSub = existing;
  }
```

> **Important:** The amendment path sets `savedSub` and then falls through to the `persist()` call and the post-save toast — the surrounding code after this block (`if (pendingNc.length)`, `persist()`, `closeForm()`, `renderTable()`, `toast(...)`) runs unchanged.

For the final toast, after the existing `toast(finalize ? 'Submitted for verification.' : 'Draft saved.')` line, amend it to show a different message when coming from amend mode (capture `wasAmend` before `amendMode` is reset):

Add near the top of `saveForm` (before any returns):

```js
const wasAmend = amendMode && editingId && isSubmitted(submissions.find(s => s.id === editingId));
```

Then replace the final toast call:

```js
toast(wasAmend
  ? 'Record amended and re-submitted for verification.'
  : finalize
    ? 'Submitted for verification.' + (finalRange ? ' Crates numbered ' + finalRange[0] + (finalRange[1] !== finalRange[0] ? ' to ' + finalRange[1] : '') + '.' : '')
    : 'Draft saved.');
```

---

## 8 — Add "Edit" button in `renderTable`

Inside `renderTable`, find the actions cell (around line 1938):

```js
html += `<td style="white-space:nowrap;">
  <button class="fr-btn fr-btn-flat fr-btn-sm" data-open="${sub.id}">${isSubmitted(sub) ? 'View' : 'Open'}</button>
  <button class="fr-btn fr-btn-flat fr-btn-sm" data-pdf="${sub.id}" title="Print this submission as the paper form">PDF</button>
  ${canDelete ? `<button class="fr-btn fr-btn-sm fr-btn-delete" data-delete="${sub.id}" title="Delete this submission (requires double sign-off)">Delete</button>` : ''}
</td>`;
```

Replace with:

```js
const canEdit = isSubmitted(sub) && (window.PermissionRules ? window.PermissionRules.can('editSubmission') : true);
const isVerified = !!sub.verification;
html += `<td style="white-space:nowrap;">
  <button class="fr-btn fr-btn-flat fr-btn-sm" data-open="${sub.id}">${isSubmitted(sub) && !isVerified ? 'View' : isVerified ? 'View (verified)' : 'Open'}</button>
  ${canEdit ? `<button class="fr-btn fr-btn-flat fr-btn-sm fr-btn-amend" data-amend="${sub.id}"
    title="${isVerified ? 'Amend verified record — only the verifier role may do this' : 'Amend this submitted record'}">Edit</button>` : ''}
  <button class="fr-btn fr-btn-flat fr-btn-sm" data-pdf="${sub.id}" title="Print this submission as the paper form">PDF</button>
  ${canDelete ? `<button class="fr-btn fr-btn-sm fr-btn-delete" data-delete="${sub.id}" title="Delete this submission (requires double sign-off)">Delete</button>` : ''}
</td>`;
```

Then wire the `data-amend` buttons after the existing `.forEach` listeners at the bottom of `renderTable`:

```js
wrap.querySelectorAll('[data-amend]').forEach(btn => btn.addEventListener('click', () => openAmend(btn.dataset.amend)));
```

---

## 9 — Show amendment history when viewing a submitted record

Inside `openForm`, after the existing "Previously captured" block (around line 3453), add the amendment log display when viewing a submitted/verified entry:

```js
// Amendment history (shown in view mode for submitted/verified records)
if (existing && existing.amendments && existing.amendments.length) {
  html += `<details class="fr-section-collapsible">
    <summary class="fr-section-title">Amendment history (${existing.amendments.length})</summary>
    <div style="font-size:11.5px;">`;
  existing.amendments.slice().reverse().forEach((a, i) => {
    html += `<div style="padding:6px 0;border-bottom:1px solid #e2e4e3;">
      <strong>${esc(a.amendedBy || '—')}</strong>
      <span class="fr-muted"> · ${esc(a.amendedByTitle || '')} · ${a.ts ? fmtDateTimeAbbr(a.ts) : ''}</span>
      ${a.clearedVerification ? '<span class="fr-badge fr-badge-warn" style="margin-left:4px;">Verification cleared</span>' : ''}
      <div style="margin-top:3px;color:#5a6068;font-style:italic;">${esc(a.reason || '(no reason recorded)')}</div>
    </div>`;
  });
  html += `</div></details>`;
}
```

---

## 10 — CSS additions

In `public/styles/record-theme.css`, add the following (or append to the file):

```css
/* Amendment mode button */
.fr-btn-amend {
  color: #7a4800;
  border-color: #c87800;
}
.fr-btn-amend:hover {
  background: #fff3dd;
}

/* Amendment banner (injected by openForm in amend mode) */
.fr-amend-banner textarea {
  box-sizing: border-box;
  font-family: inherit;
}
```

---

## 11 — `PermissionRules` — add `editSubmission` permission

In whichever file defines `window.PermissionRules` (likely `public/lib/permission-rules.js` or similar), add the permission key:

```js
// Roles that may amend (edit) a submitted (but not yet verified) record.
// Verified records are gated separately via SignOffBlock.verifyGate().
editSubmission: ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMINISTRATOR'],
```

If no `PermissionRules` file exists, the `canEdit` check in step 8 falls back to `true` (all users can edit), which is acceptable until the file is created.

---

## 12 — Version bump

After all changes to `form-record.js`, bump `?v=N` in every HTML file that references it:

```bash
grep -rl "form-record.js" public/records/
```

Increment `v=N` by 1 in each file found.

---

## 13 — Commit and deploy

```
git add public/lib/form-record.js public/styles/record-theme.css
git add public/records/*.html    # whichever changed
git commit -m "feat: amend submitted records with reason + passkey re-sign-off

- Edit button in submissions table (permission-gated)
- Verified records locked to verifier role only via SignOffBlock.verifyGate
- Amendment panel: mandatory reason textarea + passkey signature
- Amendments stored in sub.amendments[] with audit trail (who, when, why, previous values)
- Verified records have verification cleared on amendment → return to queue
- Amendment history shown in collapsed section when viewing a record

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrVKBs2QSA3Q83wQE4rA9y"
git push origin main
```

Render will auto-deploy within ~60 s.

---

## Summary of data model change

Each submission object gains an optional `amendments` array:

```jsonc
{
  "id": "sub_abc123",
  "status": "submitted",
  "values": { /* current (amended) values */ },
  "completedBy": { /* amender's sign-off */ },
  "amendments": [
    {
      "ts": 1728890000000,
      "amendedBy": "Jane Smith",
      "amendedByTitle": "Quality Supervisor",
      "amendedBySignature": "JS01",
      "reason": "Incorrect drying temperature recorded — should be 58°C not 85°C",
      "previousValues": { /* snapshot of values before this amendment */ },
      "previousRoster": null,
      "previousRosters": null,
      "previousCompletedBy": { /* original sign-off */ },
      "clearedVerification": false
    }
  ]
}
```

No DB schema change is required — this is stored inside the JSON blob that goes into the `KeyValue` storage via the existing `/api/storage/key/` endpoint.
