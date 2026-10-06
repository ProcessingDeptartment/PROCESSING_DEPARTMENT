# Changes to `public/pages/awaiting-verification.html`

Make all four changes below to `public/pages/awaiting-verification.html`.

---

## 1 — Submitted by pulls through

In the `scan()` function, the push call that builds each row object has:
```js
who: personOf(entry.values),
```
Change it to:
```js
who: entry.submittedBy || entry.submittedByName || entry.completedBy || personOf(entry.values),
```

Also broaden the `personOf` regex so it catches more field-key spellings:
```js
// Old:
return /(completed|recorded|checked|done|performed).*by|^operator$|^name$/i.test(key) && values[key];
// New:
return /(completed|recorded|checked|done|performed|submitted|filled|signed).*by|^operator$|^name$|by.*(name|who)/i.test(key) && values[key];
```

---

## 2 — Submission date AND waiting period both visible

The table currently has one combined "Waiting" column that shows both the date and the age like `2026-09-29 (7d)`. Split it into two separate columns.

**In `renderGroup()`** — change the `<thead>` from:
```html
<th class="chk"></th><th>Entry date</th><th>Ref</th><th>Submitted by</th><th>Waiting</th><th></th>
```
to:
```html
<th class="chk"></th><th>Entry date</th><th>Ref</th><th>Submitted by</th><th>Submitted</th><th>Waiting</th><th></th>
```

**In the row rendering inside `renderGroup()`**, find the two variables:
```js
var ageCls = (d != null && d >= 7) ? 'age old' : 'age';
var age = d == null ? '—' : fmtDate(r.submittedAt) + ' (' + d + 'd)';
```
Change them to:
```js
var ageCls = (d != null && d >= 7) ? 'age old' : 'age';
var submittedDate = r.submittedAt ? fmtDate(r.submittedAt) : '—';
var waitDays = d == null ? '—' : d + 'd';
```

Then in the `<tr>` string, replace the single `Waiting` cell:
```js
'<td class="' + ageCls + '">' + age + '</td>' +
```
with two cells:
```js
'<td class="when">' + submittedDate + '</td>' +
'<td class="' + ageCls + '">' + waitDays + '</td>' +
```

---

## 3 — Preview: show filled text AND add "View submission form" option

### 3a — Rename the button label
The "Preview" / "Hide" button text stays as-is for toggling, but when the detail row is open, show it as "Close".  
*(No change needed if the existing Hide/Preview toggle is acceptable — focus on the detail row content below.)*

### 3b — Replace the raw key-value list with a formatted view + form link

Replace the `valuesDl()` helper function:

**Old:**
```js
function valuesDl(values) {
  var keys = Object.keys(values || {}).filter(function (k) {
    var v = values[k];
    return v != null && v !== '' && typeof v !== 'object';
  });
  if (!keys.length) return '<span class="muted">No field values captured on this entry.</span>';
  return '<dl class="vals">' + keys.map(function (k) {
    return '<dt>' + esc(k) + '</dt><dd>' + esc(values[k]) + '</dd>';
  }).join('') + '</dl>';
}
```

**New:**
```js
function humanLabel(k) {
  // turn camelCase / snake_case into readable words
  return k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function valuesDl(values) {
  var keys = Object.keys(values || {}).filter(function (k) {
    var v = values[k];
    return v != null && v !== '' && typeof v !== 'object';
  });
  if (!keys.length) return '<span style="color:#8a939b;">No field values captured on this entry.</span>';
  return '<dl class="vals">' + keys.map(function (k) {
    return '<dt>' + esc(humanLabel(k)) + '</dt><dd>' + esc(values[k]) + '</dd>';
  }).join('') + '</dl>';
}
```

### 3c — Add the form link into the detail row

In `renderGroup()`, the detail row currently is:
```js
var detail = open ? '<tr class="detail"><td></td><td colspan="5">' + valuesDl(r.values) + '</td></tr>' : '';
```
Change it to (colspan is now 6 because we added the Submitted column):
```js
var formLink = r.href
  ? '<div style="margin-top:10px;"><a href="' + esc(r.href) + '" target="_blank" style="font-size:11.5px;color:#1d4ed8;">View submission form &rarr;</a></div>'
  : '';
var detail = open ? '<tr class="detail"><td></td><td colspan="6">' + valuesDl(r.values) + formLink + '</td></tr>' : '';
```

---

## 4 — Verifier can only verify by using passkey

### 4a — Add passkey-input.js script

After the existing `<script src="../lib/signoff-block.js?v=8"></script>` line, add:
```html
<script src="../lib/passkey-input.js?v=4"></script>
```

### 4b — Add pk-field styles to the page `<style>` block

Add these rules inside the existing `<style>` block (e.g. after the `.note` rule):
```css
.pk-field { display:flex; flex-direction:column; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#b9c3cc; gap:3px; }
.pk-field input{ padding:7px 9px; border:1px solid #55636e; border-radius:5px; font-size:12px; background:#fff; color:#1b2330; min-width:150px; cursor:pointer; }
.pk-field .pk-label{ display:flex; gap:6px; align-items:baseline; }
.pk-field .pk-status{ font-size:11px; font-weight:600; color:#2f7a52; }
.pk-field.is-verified input{ background:#e8f3ec; border-color:#2f7a52; }
```

### 4c — Replace the verifybar HTML

Find the entire `<div class="verifybar hidden" id="verifybar">` block and replace it:

**Old:**
```html
<div class="verifybar hidden" id="verifybar">
  <span class="sel" id="selCount">0 selected</span>
  <label>Verified by<input id="vBy" readonly></label>
  <label>Title<input id="vTitle" placeholder="e.g. QA Manager"></label>
  <label>Date<input id="vDate" type="date"></label>
  <label>Signature<input id="vSig" placeholder="Type your name"></label>
  <button class="go" id="btnVerify">Verify selected</button>
</div>
```

**New:**
```html
<div class="verifybar hidden" id="verifybar">
  <span class="sel" id="selCount">0 selected</span>
  <label>Verified by<input id="vfy_by" readonly></label>
  <label>Title<input id="vfy_title" placeholder="e.g. QA Manager" readonly></label>
  <label>Date<input id="vfy_date" type="date" readonly></label>
  <label class="pk-field">
    <span class="pk-label"><span>Signature</span><span class="pk-status" id="vfy_signature_display" aria-live="polite"></span></span>
    <input id="vfy_signature" type="text" placeholder="Tap to enter passkey" readonly inputmode="none" autocomplete="off"
           onclick="window.PasskeyInput && PasskeyInput.openForField('vfy_signature')">
  </label>
  <button class="go" id="btnVerify">Verify selected</button>
</div>
```

### 4d — Update `start()` to use the new field IDs

In `start()`, find:
```js
$('vBy').value = STATE.user || '';
$('vDate').value = today();
```
Change to:
```js
$('vfy_by').value = '';   // passkey auto-fills name from the verified identity
$('vfy_date').value = today();
```
(The `vfy_by` field is now filled automatically by `PasskeyInput` after the verifier enters their passkey. No need to pre-fill it from session state.)

### 4e — Update `doVerify()` to read from new IDs and gate on passkey

In `doVerify()`, find the block that reads inputs:
```js
var v = {
  verifiedBy: ($('vBy').value || '').trim(),
  verifiedSig: ($('vTitle').value || '').trim(),
  verifiedDate: $('vDate').value,
  verifiedSignature: ($('vSig').value || '').trim()
};
if (!window.SignOffBlock.validateVerifyInputs(v)) { toast('Verified by, title, date and signature are all required.'); return; }
```
Replace with:
```js
var sigEl = $('vfy_signature');
if (!sigEl || sigEl.dataset.verified !== 'true') {
  toast('Please enter your passkey to verify.');
  if (window.PasskeyInput) window.PasskeyInput.openForField('vfy_signature');
  return;
}
var v = {
  verifiedBy: ($('vfy_by').value || '').trim(),
  verifiedSig: ($('vfy_title').value || '').trim(),
  verifiedDate: $('vfy_date').value,
  verifiedSignature: ($('vfy_signature').value || '').trim()
};
if (!v.verifiedBy || !v.verifiedDate) { toast('Passkey sign-in and date are required.'); return; }
```

### 4f — Clear the passkey field after a successful verify

After `STATE.picked = {};` in the success block of `doVerify()`, add:
```js
var sigEl2 = $('vfy_signature');
if (sigEl2) { sigEl2.value = ''; sigEl2.dataset.verified = ''; }
var dispEl = $('vfy_signature_display');
if (dispEl) dispEl.textContent = '';
var pkField = sigEl2 && sigEl2.closest('.pk-field');
if (pkField) pkField.classList.remove('is-verified');
$('vfy_title').value = '';
$('vfy_by').value = '';
$('vfy_date').value = today();
```

Also replace the old clear lines:
```js
$('vTitle').value = ''; $('vSig').value = '';
```
Remove them (they are replaced by the block above).

---

## Summary of all changed IDs

| Old ID  | New ID         |
|---------|----------------|
| `vBy`   | `vfy_by`       |
| `vTitle`| `vfy_title`    |
| `vDate` | `vfy_date`     |
| `vSig`  | `vfy_signature`|
