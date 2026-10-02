# Tablet Layout — Fields Out of Line in a Row (Passkey Field + Others) — Instructions for Claude Code

**Date:** 2026-10-02
**Raised by:** Michaela — "field layout is skew, e.g. passkey is not staying in line with other fields in the row. This happens to other fields also when using tablet layout."
**Type:** CSS/layout fix plus one small markup change in the signature block. **No change** to fields, names, order, validation, passkey logic, DB calls, CSV or print output.
**Builds on:** `claude/record-page-field-alignment-fix-instructions.md` (2026-09-25 fixed-column system), `claude/tablet-ui-optimisation-brief.md` (2026-09-29), `claude/implementation-passkey-and-title-prefill-REVISED.md` (2026-10-01, introduced the passkey field).

> Caveat: this diagnosis comes from the project docs and the code they quote. I have not seen the live page on a tablet. Step 1 below confirms the cause in 5 minutes before anything is changed.

---

## 1. Why it happens (most likely causes, in order)

| # | Cause | Why it skews the row |
|---|---|---|
| 1 | **The passkey field breaks the "label → input" rule.** The 10-01 change wraps the input in `<div style="position:relative">` and adds a `.passkey-verified-display` div *under* the input. | The field is now taller than its neighbours. With `align-items:end` the extra line pushes the passkey **input up**, so it no longer shares a baseline with the other inputs. Worse, the line only appears after verifying, so the row jumps when the user signs. |
| 2 | **Passkey input has its own look.** `input[placeholder="Enter passkey"]` uses `border:2px`, `background … !important`, 14px text, no min-height. | Different border and padding means a different height from the 48px engine inputs (the 09-25 rule: one input height per density mode). `!important` also beats the theme. |
| 3 | **Tablet = the 2-column mode (≥700px).** Sign-off and Completed-by have 4–5 fields. Two columns make them wrap onto a second row. | Any field with extra content above or below its input (hints, Change link, verified text, 2-line label) shows up as misaligned. On PC (4 columns) the same fields often sit in one row and hide the fault. |
| 4 | **Landscape tablets are treated as PC.** The tablet brief §2.3 found rules keyed on width ≤1024 miss landscape iPads (1080–1366px). | The same page flips between PC density (36px) and tablet density (48px) depending on orientation, so inputs in one row can be different sizes. |
| 5 | **Other fields have the same flaw** (Job no. "Change" link, hint lines such as "(°C)", two-line labels). | Same mechanism as #1: anything between label and input, or below it, changes the field's height. |

---

## 2. Step 1 — Confirm (5 min, do before changing code)

Open any record with a Sign-off / Verification block on the tablet (or Chrome DevTools at 1180×820 and 820×1180, touch emulation on). In the console run:

```js
(() => {
  const out = [];
  document.querySelectorAll('.rt-content *').forEach(g => {
    if (getComputedStyle(g).display !== 'grid' || g.closest('table')) return;
    const rows = {};
    [...g.children].filter(c => c.offsetParent).forEach(c => {
      const t = Math.round(c.getBoundingClientRect().top);
      (rows[t] = rows[t] || []).push(c);
    });
    Object.values(rows).forEach(cells => {
      const ins = cells.map(c => c.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select'))
                       .filter(i => i && i.offsetParent);
      if (ins.length < 2) return;
      const b = ins.map(i => Math.round(i.getBoundingClientRect().bottom));
      const h = ins.map(i => Math.round(i.getBoundingClientRect().height));
      if (Math.max(...b) - Math.min(...b) > 3 || Math.max(...h) - Math.min(...h) > 3)
        out.push({ grid: g.id || g.className, ids: ins.map(i => i.id || i.name), bottoms: b, heights: h });
    });
  });
  return out;
})();
```

Expected: the passkey input (id ends `_signature` or similar) appears with a different `bottom` and/or `height` from its row-mates. Record the output in the work log. The same script must return `[]` after the fix.

---

## 3. The rule to build to

**Every field is the same three-part stack, with the input always last-but-one and on the row baseline:**

```
[ label text ........ optional right-aligned link/status ]   ← label line (may wrap to 2 lines)
[ input / select — 48px tablet, 36px PC                  ]   ← the only thing that must line up
[ hint / helper text (optional, small)                   ]   ← reserved, never moves the input
```

1. **Nothing is allowed to change the input's position.** Anything extra goes on the label line (right-aligned) or in the hint slot below.
2. **The hint slot below the input takes no layout space** (or a fixed reserved height), so a hint or "Confirmed" message appearing later cannot shift the row.
3. **All inputs in a row share one height and one border weight.** No field gets its own size, border or `!important` styling.
4. **Grid rows align on the input**, not the field box: `align-items:end` on the grid and `justify-content:flex-end` on each field (already specified 2026-09-25 — verify it is actually in place, §5.1).

---

## 4. Changes

### 4.1 Passkey field — `public/lib/signoff-block.js` (markup only)

Replace the 10-01 passkey markup with a flat field. Keep the same `id`s, `readonly`, and the `onclick="PasskeyInput.openForField(...)"` call.

Target structure (class names are suggestions; keep whatever the file already uses for `${fieldClass}`):

```html
<label class="${fieldClass} pk-field">
  <span class="pk-label">
    <span>Signature</span>
    <span class="pk-status" id="${signatureId}_display" aria-live="polite"></span>
  </span>
  <input id="${signatureId}" type="text" readonly
         placeholder="Tap to enter passkey"
         onclick="PasskeyInput.openForField('${signatureId}')">
</label>
```

- No wrapper `<div>`, no inline `style`. The "Confirmed ✓" text now lives **on the label line, right-aligned** (where the Job no. "Change" link also goes), so the input never moves.
- Update `passkey-input.js` `submit()` so it finds the status element by id (`document.getElementById(currentFieldId + '_display')`) instead of `fieldGroup.querySelector('.passkey-verified-display')`. Text becomes: `John Smith · Confirmed ✓` (truncate with ellipsis, full name in `title=""`).
- Remove the `style.textContent` block added to `mountVerification()` (the one with `input[placeholder="Enter passkey"]` and `!important`). Replace it with the CSS in 4.2.

### 4.2 `public/styles/record-theme.css` (inside the ENGINE RESKIN block, everything under `.rt-content`)

1. **Shared field stack** (confirm it exists; add if not):
   - `.rt-content .fr-field, .rt-content .ml-field, .rt-content .cr-field` → `display:flex; flex-direction:column; justify-content:flex-end; min-width:0;`
2. **Label line**: `.rt-content .pk-label` (and the Job no. label) → `display:flex; justify-content:space-between; align-items:baseline; gap:8px; min-height:1.4em;`
3. **Status text**: `.rt-content .pk-status` → `font-size:14px; font-weight:600; color:var(--rt-ok, #15803D); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%;`
4. **Passkey input matches every other input**: no special rule for height/border. If a visual cue that it is tap-only is wanted, change only **background** (`#EEF1F0` read-only grey from the tablet brief §5.5) and `cursor:pointer`. Never `!important`.
   - After verification: add class `is-verified` to the field → border colour `--ok`, background white. Colour only; same size.
5. **Delete** any remaining rule that targets `input[placeholder="Enter passkey"]`.

### 4.3 Touch sizing by input type, not width (fixes cause #4)

Per tablet brief §5.1, in `record-theme.css`:

```
@media (pointer: coarse) { .rt-content { --rt-input-h: 48px; --rt-input-fs: 16px; } }
body.rt-pc .rt-content   { --rt-input-h: 36px; --rt-input-fs: 14px; }
```

- All field inputs/selects use `min-height: var(--rt-input-h); font-size: var(--rt-input-fs);` — header fields, roster fields, sign-off and the passkey field alike.
- Keep a **single** width breakpoint for columns: ≥1100px = 4, 700–1099px = 2, <700px = 1 (2026-09-25 §2). Do not add new breakpoints.
- Do not use `body.rt-pc` on a touch device. If `rt-pc` is being applied by width, change it to apply only when `(pointer: fine)` and width ≥1100px. Report where it is set.

### 4.4 Same fix for the other offenders (cause #5)

Apply the §3 rule to each:

- **Job no. "Change" link** — move onto the label line, right-aligned (already specified in 2026-09-25 §3.4; confirm it was actually done).
- **Hints/units** ("(°C)", "tol ±0.02mm", "record only") — render *after* the input in a `.fr-hint` / `.ml-hint` (14px), or append to the label in brackets. Nothing between label and input.
- **Two-line labels** — allowed; the input still sits on the baseline because of `justify-content:flex-end`.
- **Any other helper element** found by the §2 script on other records: list in the work log, then fix with the same pattern.

### 4.5 Grid check

- Sign-off / Verification / Completed-by containers must use the fixed-track grid (`repeat(var(--rt-form-cols), minmax(0,1fr))`, `align-items:end`). If any are still `auto-fit/auto-fill` or flex-wrap, convert them.
- Field order for the sign-off row (so two-column tablet pairs make sense): **Verified by / Title**, then **Date / Signature**.
- A 5th field must not orphan on its own half-row. Where a block has an odd number of fields, let the last one span the full row.

---

## 5. Do NOT change

- Passkey behaviour: number pad, `/api/passkey/verify`, hashing, logging, what value is stored, `dataset.verified`, `readVerifyInputs()` keys.
- Any field name, order, validation, calculation, export or print layout (`@media print` stays as is).
- Out-of-scope pages from the 2026-09-25 brief §4 (Home, Dashboard, Record List index, Job Status, etc.). All new rules stay under `.rt-content` / `.rt-shell` because `job-status.html` also loads `record-theme.css`.
- The number-pad modal styling. That is a separate overlay and not part of the row layout.

---

## 6. Build order

1. Run the §2 script on the tablet / emulator on 3 records (one `fr`, one `ml`, REC 7.2.12). Save output to the work log. Take before screenshots at 1180×820 and 820×1180.
2. Do 4.1 + 4.2. **Stop and show Michaela** one sign-off block, before and after verifying a passkey.
3. Do 4.3 (touch query). Re-check landscape and portrait.
4. Do 4.4 and 4.5 across the engines.
5. Loop the §2 script (Playwright, Chromium is pre-installed, with `hasTouch:true`) over every Record List page at 1180×820, 820×1180, 1024×768, 768×1024, 390×844. Target `[]` everywhere. Put the pass/fail table in the work log.
6. Regression screenshots of the out-of-scope pages (unchanged) and a print preview of 3 records (unchanged).
7. Bump `?v=` on `record-theme.css`, `signoff-block.js` and `passkey-input.js` on all pages that load them.
8. Write `claude/tablet-field-row-alignment-worklog.md`.

---

## 7. Acceptance checks

- [ ] On tablet landscape and portrait, the passkey input sits on the same baseline and is the same height as Verified by, Title and Date in its row.
- [ ] Verifying a passkey does **not** move or resize anything in the row. The "Confirmed ✓" status appears on the label line.
- [ ] All inputs in any row, on every record, are the same height (48px touch / 36px PC), including Job no.
- [ ] Nothing sits between a label and its input anywhere.
- [ ] §2 script returns `[]` on every Record List page at all five viewport sizes.
- [ ] No `!important` on the passkey input, and no rule left targeting `placeholder="Enter passkey"`.
- [ ] Passkey sign-off still works end-to-end (wrong passkey rejected, correct one accepted, same stored values as before).
- [ ] Print output and out-of-scope pages unchanged.

---

## 8. Paste-ready prompt for Claude Code

> Read `claude/tablet-field-row-alignment-passkey-fix-instructions.md` and follow it exactly. First run the §2 diagnostic script on the tablet or emulator and save the output. Then fix the passkey field in `signoff-block.js` (flat markup, "Confirmed ✓" on the label line, no wrapper div, no inline style, no `!important`), update `passkey-input.js` to write the status by id, and add the shared field-stack, label-line and one-input-height rules under `.rt-content` in `record-theme.css`. Switch tablet sizing to `(pointer: coarse)` rather than width. Apply the same "nothing between label and input" rule to the Job no. Change link and hint lines. Do not change passkey logic, any field, validation, calculation, export or print output, and do not touch out-of-scope pages. Stop after §6 step 2 to show me the sign-off block before and after verifying, then continue and finish with the Playwright run across all Record List pages and a work log at `claude/tablet-field-row-alignment-worklog.md`.

---

## 9. Save location

Save this file in the repo `MD` folder as `MD/tablet-field-row-alignment-passkey-fix-instructions.md` (per project rule: all MD files live in the MD folder).
