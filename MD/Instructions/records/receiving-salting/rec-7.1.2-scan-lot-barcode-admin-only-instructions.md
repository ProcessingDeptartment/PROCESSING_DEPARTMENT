# REC 7.1.2 Abalone Receiving — Scan Lot & Barcode Scanning (Admin-Only) Instructions

**Date:** 2026-10-27  
**Raised by:** Michaela — "scan lot and barcode scanning options. needs to only be visible on administrator such as the dry cooking. not just for basket scan lot also for job number scan lot."  
**Scope:** Add barcode scanning (camera + handheld) to two fields in `REC-7.1.2-abalone-receiving.html`:
1. **Job number field** (Section 1 / Job Info) — scan to look up and autofill the job
2. **Basket/lot # field** (Section 2 / Basket Entry) — scan a lot barcode to fill the field

Both must be **invisible to non-admin users** — same gating pattern as dry cooking. Not just hidden visually; absent from the DOM entirely.  
**Related files:** `claude/barcode-scanning-integration-instructions.md`, `public/records/REC-7.1.2-abalone-receiving.html`, `public/lib/form-record.js`, `public/lib/permission-rules.js`  
**No coding in this file** — instructions for Claude Code only.

---

## 1. What needs to be built

Three admin-only additions to the abalone receiving form (`REC 7.1.2`):

| Location | Feature | What it does |
|---|---|---|
| Section 1 — Job Info | **📷 Scan job barcode** button | Scan a job barcode → fills job number field → triggers autofill exactly as if the operator had typed the job number and confirmed |
| Section 1 — Job Info | **Handheld scanner support on job # input** | Enter key on the job number field fires the job lookup (same as tapping Confirm / Search) |
| Section 2 — Basket Entry | **📷 Scan lot** button | Scan a lot/basket barcode → fills lot/basket # field, applies FD-prefix logic |
| Section 2 — Basket Entry | **Handheld scanner support on basket # input** | Enter key fires add-basket if weight is filled, or moves focus to weight if not |

All four must be **hidden entirely from the DOM** for non-admin users.

---

## 2. Admin-only visibility — the rule

### 2.1 How the existing system gates admin features

`public/lib/permission-rules.js` (or equivalent) exposes `window.PermissionRules.can(permission)`. The logged-in user's role is stored on the client — likely `window.currentUserRole`, `window.UserSession.role`, or similar. **Before building, grep `public/lib/` for the dry cooking form's admin gate and copy that exact pattern.** Do not invent a new variable or method.

Dry cooking uses something like:

```javascript
if (PermissionRules.can('adminFeatures')) { … }
// or
if (window.currentUserRole === 'ADMINISTRATOR') { … }
```

### 2.2 Rules for this feature

- Role **is** `ADMINISTRATOR` → show all scan buttons and scanner-enhanced inputs described in this doc.
- Role **is not** `ADMINISTRATOR` → render nothing extra. Both fields remain plain text inputs, unchanged from today.
- Gate is evaluated **once on page load** after the session/role is known. Not toggled dynamically.
- Do **not** remove the plain text inputs — scanning is an extra affordance layered on top. All users can still type.

---

## 3. Scanning — how each method works

### 3.1 Handheld scanner (Bluetooth / USB)

Acts as a keyboard. Scans barcode → types value into focused field → sends Enter. Works in any browser, needs no permissions. Implementation = add a `keydown` listener for `Enter` that fires the field's primary action (job lookup or add-basket). Also add `focus` → `select()` so a second scan overwrites cleanly.

### 3.2 Camera (BarcodeDetector API)

```javascript
const cameraSupported = ('BarcodeDetector' in window);
// Show camera scan button only if cameraSupported === true
```

Supported on Chrome (Android + desktop). Not on Safari / iOS as of 2026 — hide the button gracefully, no error. Formats to always pass: `['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8']`.

Use (or create) the shared `scanWithCamera(formats, onResult, onCancel)` utility from `barcode-scanning-integration-instructions.md §7.3`. If `public/lib/scan-utils.js` does not yet exist, create it there. Load it on the receiving page with `<script src="../lib/scan-utils.js?v=1"></script>`.

---

## 4. Feature A — Job number scanning (Section 1, admin only)

### 4.1 What scanning fills

The job number field (key: `jobNo`, likely a `type: 'jobsearch'` picker). Scanning populates this field and then fires the **same lookup/autofill chain** as when the operator types a job number and confirms — i.e. it fetches job info and populates the read-only job fields (processing-for, intake weight, harvest farm, intake date, etc.).

Do not bypass the existing job lookup logic. Just fill the input with the scanned value and trigger the confirm/lookup event programmatically.

### 4.2 UI — admin only, above the job number field

```
[ 📷 Scan job barcode ]   or type job number below

[ Job no.: ________________ ]  [ Confirm / Search ]
```

- **"📷 Scan job barcode" button**: height 48 px, `--action` colour, shown only if `cameraSupported && isAdmin`.
- **Helper text** above the button: `"Scan the job barcode from the job sheet, or type the job number below."` — `fr-muted`, 12 px, italic, hidden in print.
- **Job number input** (admin only enhancements):
  - `input.addEventListener('focus', () => input.select())` — overwrite on re-scan
  - `keydown` Enter → trigger the job lookup (same as tapping the Confirm/Search button)

### 4.3 Camera scan flow — job number

1. Admin taps **📷 Scan job barcode**.
2. Camera overlay opens (targeting reticle).
3. Scan detected:
   - Close overlay.
   - Trim whitespace.
   - No FD-prefix logic for job numbers — fill directly.
   - Populate the job number input with the scanned value.
   - Programmatically fire the job lookup (same event as tapping Confirm). The autofill chain runs.
4. Cancel: close overlay, no change.

### 4.4 Handheld scan flow — job number

1. Admin focuses the job number input (taps it).
2. Handheld scanner types the job number + sends Enter.
3. `keydown` Enter listener fires the job lookup.

### 4.5 Job barcode format

Job barcodes use Code 128 with the job number as-is (e.g. `DPR01168`, `3DP00423`, `AG-2026-1042`). No stripping or transformation — fill the field exactly as scanned (after trim). If the scanned value does not match a valid job format, the existing job lookup will handle the error (show "no job found") — do not add extra validation here.

---

## 5. Feature B — Basket / lot # scanning (Section 2, admin only)

### 5.1 What scanning fills

The basket/lot number field in the basket entry row (the repeating add-row in Section 2). Scanning fills this field and applies the FD-prefix rule below.

### 5.2 FD prefix rule

```
Scanned value: FD1234  →  show: "Did you mean 1234?  [ Use 1234 ]  [ Keep as FD1234 ]"
Scanned value: 1234    →  fill directly, no prompt
```

`applyFDCheck(rawValue, containerEl, callback)` — lives in `scan-utils.js`. If no FD prefix, `callback(rawValue)` is called immediately.

### 5.3 UI — admin only, above the basket entry row

```
[ 📷 Scan lot ]   or type lot/basket # below

[ Basket #: ___________🔍 ]  [ Weight kg: ________ ]  [ Add ]
```

- **"📷 Scan lot" button**: height 56 px, `--action` colour, shown only if `cameraSupported && isAdmin`.
- **Helper text**: `"Scan the lot barcode on each bag/basket, or type the lot number below."` — `fr-muted`, 12 px, italic, hidden in print.
- **Basket # input enhancements (admin only)**:
  - Small 🔍 icon cosmetically inside right of input (visual hint only).
  - `inputmode="numeric"` — mobile numeric keyboard hint.
  - `input.addEventListener('focus', () => input.select())`.
  - `keydown` Enter listener → `applyFDCheck` → if weight is filled, trigger add-basket; if weight is empty, focus weight field.

### 5.4 Camera scan flow — basket/lot #

1. Admin taps **📷 Scan lot**.
2. Camera overlay opens.
3. Scan detected:
   - Close overlay.
   - Trim whitespace.
   - `applyFDCheck(rawValue, basketHintContainer, (resolved) => { basketInput.value = resolved; weightInput.focus(); })`.
   - If FD prefix: show inline suggestion row beneath the basket # field; the callback fires only after operator chooses.
4. Cancel: close overlay, no change.

### 5.5 Handheld scan flow — basket/lot #

1. Admin focuses the basket # input.
2. Handheld scanner types value + Enter.
3. `keydown` Enter → `applyFDCheck` → if weight filled, add basket; else focus weight.

---

## 6. Code structure

### 6.1 `scan-utils.js` (shared, `public/lib/`)

If it does not already exist, create it. Two exports needed:

```javascript
// Opens camera overlay and resolves on first scan
async function scanWithCamera(formats, onResult, onCancel) {
  if (!('BarcodeDetector' in window)) { onCancel(); return; }
  const detector = new BarcodeDetector({ formats });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }});
  // Show overlay with targeting reticle
  // Run detect loop — call onResult(trimmedValue) on first hit, then stop stream and close overlay
  // Dismiss button → onCancel(), stop stream, close overlay
}

// FD-prefix check — calls callback(resolvedValue) when value is settled
function applyFDCheck(rawValue, containerEl, callback) {
  const stripped = rawValue.replace(/^fd/i, '');
  if (stripped !== rawValue) {
    // inject suggestion row into containerEl
    // "Use [stripped]" → callback(stripped)
    // "Keep as [rawValue]" → callback(rawValue)
  } else {
    callback(rawValue);
  }
}
```

### 6.2 Admin gate block — how to place it

After the form engine renders both sections, and after the user role is known:

```javascript
const isAdmin = /* dry cooking's exact check */;
const cameraSupported = ('BarcodeDetector' in window);

if (isAdmin) {
  // --- Feature A: Job number ---
  addScanButton({
    label: '📷 Scan job barcode',
    hint: 'Scan the job barcode from the job sheet, or type the job number below.',
    targetInput: jobNumberInput,
    insertBefore: jobNumberInput.closest('.fr-field-row'),
    showCamera: cameraSupported,
    onScan: (value) => {
      jobNumberInput.value = value.trim();
      jobNumberInput.dispatchEvent(new Event('change', { bubbles: true }));
      triggerJobLookup(); // fire same function as Confirm button
    },
    enterAction: () => triggerJobLookup(),
    fdCheck: false,
    formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8'],
  });

  // --- Feature B: Basket / lot # ---
  addScanButton({
    label: '📷 Scan lot',
    hint: 'Scan the lot barcode on each bag/basket, or type the lot number below.',
    targetInput: basketInput,
    insertBefore: basketEntryRow,
    showCamera: cameraSupported,
    onScan: (value) => {
      applyFDCheck(value, basketHintContainer, (resolved) => {
        basketInput.value = resolved;
        weightInput.focus();
      });
    },
    enterAction: () => {
      applyFDCheck(basketInput.value.trim(), basketHintContainer, (resolved) => {
        basketInput.value = resolved;
        if (weightInput.value.trim()) triggerAddBasket();
        else weightInput.focus();
      });
    },
    fdCheck: true,
    formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8'],
  });
}
```

`addScanButton` is a small local helper that creates the button + hint text, attaches the `focus` and `keydown` listeners, and handles the camera-not-supported hide. Keep it in the receiving page's inline script or a page-specific JS file — do not add it to `form-record.js` unless the scan pattern is confirmed to be wanted on other records too.

---

## 7. File changes

| File | Change |
|---|---|
| `public/records/REC-7.1.2-abalone-receiving.html` | Add `<script src="../lib/scan-utils.js?v=1"></script>` (if new). Bump `?v=N` on `form-record.js`. |
| `public/lib/scan-utils.js` | Create if not present: `scanWithCamera()` and `applyFDCheck()`. |
| `public/lib/form-record.js` | Only if the Enter-key / focus-select additions are put here rather than inline. Bump version if changed. |
| Any HTML referencing `form-record.js` | Bump `?v=N` if `form-record.js` changed. Run: `grep -rl "form-record.js" public/records/` |

**Scope:** REC 7.1.2 only. Do not change any other record.

---

## 8. CSS — add to `public/styles/record-theme.css`

```css
/* Scan buttons — admin only, both job number and lot */
.fr-btn-scan {
  background: var(--action);
  color: #fff;
  border-radius: 8px;
  padding: 0 20px;
  font-size: 15px;
  cursor: pointer;
  margin-bottom: 8px;
  min-height: 48px;
}
.fr-btn-scan--lot {
  min-height: 56px; /* larger touch target for the basket entry scan */
}
.fr-scan-hint {
  font-style: italic;
  font-size: 12px;
  color: var(--muted, #888);
  margin-bottom: 4px;
}
/* FD suggestion row */
.fr-scan-fd-suggest {
  font-size: 13px;
  margin-top: 4px;
  display: flex;
  gap: 8px;
  align-items: center;
}
@media print {
  .fr-btn-scan,
  .fr-btn-scan--lot,
  .fr-scan-hint,
  .fr-scan-fd-suggest { display: none !important; }
}
```

---

## 9. Testing checklist

**Non-admin (operator) login:**
- [ ] Open REC 7.1.2 → no scan button anywhere on the form. Confirm in DevTools: no `.fr-btn-scan` in DOM.
- [ ] Job number input and basket # input behave exactly as before — plain inputs, no Enter-key listener added.

**Admin login — job number scanning:**
- [ ] "📷 Scan job barcode" button visible above the job number field (if device has camera).
- [ ] Tap button → camera opens → scan a job barcode → job number field fills → job lookup fires → job info autofills.
- [ ] Handheld scanner: focus job number input → scan → Enter fires → job lookup runs.
- [ ] Invalid job number scanned → existing "no job found" error shows — no extra error from scan code.

**Admin login — basket/lot # scanning:**
- [ ] "📷 Scan lot" button visible above basket entry row.
- [ ] Tap → camera opens → scan Code 128 → basket # fills → focus moves to weight.
- [ ] FD prefix: scan `FD5678` → suggestion row appears with "Use 5678" and "Keep as FD5678". Tapping "Use 5678" fills `5678`. Tapping "Keep" fills `FD5678`.
- [ ] Handheld scan into basket # + Enter: weight filled → basket added; weight empty → focus moves to weight.

**Both scan fields — edge cases:**
- [ ] No `BarcodeDetector` (Safari/iOS): scan buttons hidden, no error, plain inputs work.
- [ ] Camera permission denied: overlay closes gracefully, no error shown, no field change.
- [ ] Print/PDF: no scan buttons, no hint text, no FD suggestion row in output.
- [ ] Form submits correctly after scanning — database has the right job number and basket/lot numbers.

---

## 10. Build order

1. Grep `public/lib/` for the dry cooking admin gate — confirm the exact role variable / `PermissionRules` method. Write it down in the work log before touching anything.
2. Check if `public/lib/scan-utils.js` exists. If yes, confirm it has `scanWithCamera` and `applyFDCheck`. If no, create it.
3. Add the admin-gated scan block to the receiving page (inline script or page-specific JS) — **job number first**, then basket/lot.
4. Add CSS to `record-theme.css`.
5. Add `<script src="../lib/scan-utils.js?v=1"></script>` to `REC-7.1.2-abalone-receiving.html` if it was created.
6. Bump `?v=N` on `form-record.js` in the receiving HTML (and any other file that loads it, if `form-record.js` was changed).
7. Commit and push to `main` → Render auto-deploys.
8. Test on live site: log in as non-admin → no scan controls. Log in as admin → both scan buttons present and working.
