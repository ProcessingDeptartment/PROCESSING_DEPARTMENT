# Time Picker — Digital Only (No Analog Clock) Instructions

**File:** `public/lib/form-record.js`
**Also:** `public/styles/record-theme.css`
**Scope:** Replace native `<input type="time">` (which shows an analog clock on Chrome/Android) with a custom digital HH : MM picker — two number spinners with +/− buttons, no clock face.

---

## Why

Chrome on Android and desktop shows an analog clock overlay when a user taps `<input type="time">`. On a tablet on the factory floor this is slow and fiddly. A digital HH:MM entry with large tap targets is faster and more accurate.

---

## Approach

Replace the single `<input type="time">` with a small custom widget: two `<input type="number">` fields (hours 0–23, minutes 0–59) side by side, each with ▲ / ▼ buttons. The widget writes its combined value back to a hidden `<input type="text">` in `HH:MM` format — so the rest of form-record.js (save, submit, validate) reads it from that hidden field exactly as before.

---

## Changes in `public/lib/form-record.js`

### 1. Find the time field render (line ~611)

**Current:**
```js
if (field.type === 'time') return `<input type="time" id="${id}" value="${esc(v)}">`;
```

**Replace with:**
```js
if (field.type === 'time') return buildTimePicker(id, v);
```

---

### 2. Add `buildTimePicker` function — place it near `fmtDDMMYYYY` (top of the helpers block)

```js
function buildTimePicker(id, value) {
  // Parse existing value (HH:MM or empty)
  const parts = (value || '').split(':');
  const hh = parts[0] ? String(parseInt(parts[0])).padStart(2, '0') : '';
  const mm = parts[1] ? String(parseInt(parts[1])).padStart(2, '0') : '';

  // Hidden field holds the combined HH:MM value read by the rest of the engine
  return `
    <span class="fr-time-picker" data-for="${id}">
      <input type="text" id="${id}" value="${esc(value || '')}" class="fr-time-hidden" readonly tabindex="-1" aria-hidden="true">
      <span class="fr-time-unit">
        <button type="button" class="fr-time-btn fr-time-up" data-part="h" data-for="${id}" tabindex="-1" aria-label="Hour up">▲</button>
        <input type="number" class="fr-time-h" min="0" max="23" value="${esc(hh)}" placeholder="HH" data-for="${id}" aria-label="Hours">
        <button type="button" class="fr-time-btn fr-time-dn" data-part="h" data-for="${id}" tabindex="-1" aria-label="Hour down">▼</button>
      </span>
      <span class="fr-time-sep">:</span>
      <span class="fr-time-unit">
        <button type="button" class="fr-time-btn fr-time-up" data-part="m" data-for="${id}" tabindex="-1" aria-label="Minute up">▲</button>
        <input type="number" class="fr-time-m" min="0" max="59" value="${esc(mm)}" placeholder="MM" data-for="${id}" aria-label="Minutes">
        <button type="button" class="fr-time-btn fr-time-dn" data-part="m" data-for="${id}" tabindex="-1" aria-label="Minute down">▼</button>
      </span>
    </span>`;
}
```

---

### 3. Add event wiring for the time picker — add this inside the main `init` function, after the container is built (near where other field event listeners are wired, around the `wireNowButtons` area)

```js
// --- Digital time picker wiring ---
container.querySelectorAll('.fr-time-picker').forEach(widget => {
  const forId = widget.dataset.for;
  const hidden = document.getElementById(forId);
  const hInput = widget.querySelector('.fr-time-h');
  const mInput = widget.querySelector('.fr-time-m');

  function writeBack() {
    const h = hInput.value.trim();
    const m = mInput.value.trim();
    if (h === '' && m === '') { hidden.value = ''; }
    else {
      const hh = String(Math.min(23, Math.max(0, parseInt(h) || 0))).padStart(2, '0');
      const mm = String(Math.min(59, Math.max(0, parseInt(m) || 0))).padStart(2, '0');
      hidden.value = hh + ':' + mm;
    }
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Clamp and zero-pad on blur
  hInput.addEventListener('blur', () => {
    if (hInput.value !== '') hInput.value = String(Math.min(23, Math.max(0, parseInt(hInput.value) || 0))).padStart(2, '0');
    writeBack();
  });
  mInput.addEventListener('blur', () => {
    if (mInput.value !== '') mInput.value = String(Math.min(59, Math.max(0, parseInt(mInput.value) || 0))).padStart(2, '0');
    writeBack();
  });

  hInput.addEventListener('input', writeBack);
  mInput.addEventListener('input', writeBack);

  // ▲ / ▼ buttons
  widget.querySelectorAll('.fr-time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const part = btn.dataset.part;
      const inp = part === 'h' ? hInput : mInput;
      const max = part === 'h' ? 23 : 59;
      const step = btn.classList.contains('fr-time-up') ? 1 : -1;
      const cur = parseInt(inp.value) || 0;
      inp.value = String(Math.min(max, Math.max(0, cur + step))).padStart(2, '0');
      writeBack();
    });
  });
});
```

---

### 4. Reading values back (no change needed)

The rest of form-record.js reads field values from the element with the field's `id`. Since the hidden `<input type="text">` carries that `id` and `writeBack()` keeps it current and fires `input`/`change` events, all existing save, validate, and submit logic works without modification.

---

## Changes in `public/styles/record-theme.css`

Add these rules at the end of the file:

```css
/* ── Digital time picker ── */
.fr-time-picker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fr-time-hidden {
  display: none !important;
}

.fr-time-unit {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.fr-time-h,
.fr-time-m {
  width: 3.2rem;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
  padding: 6px 4px;
  border: 1px solid var(--border, #ccc);
  border-radius: 4px;
  -moz-appearance: textfield;   /* hide Firefox spinner arrows */
  appearance: textfield;
}

/* Hide native number spinner arrows in Chrome/Safari */
.fr-time-h::-webkit-outer-spin-button,
.fr-time-h::-webkit-inner-spin-button,
.fr-time-m::-webkit-outer-spin-button,
.fr-time-m::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.fr-time-btn {
  width: 2rem;
  height: 1.8rem;
  padding: 0;
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
  border: 1px solid var(--border, #ccc);
  border-radius: 3px;
  background: var(--surface2, #f4f4f4);
  color: var(--text, #333);
  touch-action: manipulation;
}

.fr-time-btn:active {
  background: var(--accent, #0077cc);
  color: #fff;
}

.fr-time-sep {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  padding-bottom: 2px;
  align-self: center;
}

/* Tablet: larger touch targets */
@media (pointer: coarse) {
  .fr-time-h,
  .fr-time-m {
    width: 3.8rem;
    font-size: 1.4rem;
    padding: 8px 4px;
  }
  .fr-time-btn {
    width: 2.6rem;
    height: 2.2rem;
    font-size: 0.9rem;
  }
}

/* Print: show HH:MM text only, hide buttons */
@media print {
  .fr-time-picker .fr-time-btn,
  .fr-time-picker .fr-time-sep { display: none; }
  .fr-time-hidden {
    display: inline !important;
    border: none;
    background: none;
    font-size: inherit;
  }
}
```

---

## After editing

1. Bump `?v=N` in all HTML files referencing `form-record.js`:
   ```bash
   grep -rl "form-record.js" public/records/
   ```
   Increment version by 1 in each.

2. Commit and push:
   ```bash
   git add public/lib/form-record.js public/styles/record-theme.css public/records/
   git commit -m "Replace analog time picker with digital HH:MM spinner"
   git push
   ```

3. Render auto-deploys in ~30 seconds. Hard-refresh to verify (`Ctrl+Shift+R`).

---

## Result

| Before | After |
|--------|-------|
| Tap time field → analog clock overlay | Tap time field → two number boxes with ▲▼ buttons |
| Fiddly on tablet | Large touch targets, fast entry |
| Clock only on Chrome/Android | Consistent across all browsers |
| Native `<input type="time">` | Hidden text field + custom widget |
