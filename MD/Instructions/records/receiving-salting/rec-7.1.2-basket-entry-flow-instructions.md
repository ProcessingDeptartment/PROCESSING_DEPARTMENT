# REC 7.1.2 Abalone Received — Basket Entry Flow Redesign (Instructions for Claude Code)

**Date:** 2026-10-02
**Raised by:** Michaela — "use like dry cooking principle for abalone receiving. Job info section = only section to pop up first. Then user completes and confirms. Then auto collapse and then basket receiving section. Basket receiving: click to use barcode. Size range set and then button to say new size range. Add basket — user does not see the basket list being created — that is the next section that is collapsed unless user opens."
**Scope:** REC 7.1.2 Abalone Received only. The redesign affects page layout, section flow, and the basket-entry UX. No change to storage keys, database schema, validation rules, calculations, CSV export, or print output.
**Relationship to existing briefs:**
- `claude/record-open-job-gate-instructions.md` — the job gate (pop-up, confirm, collapse) applies here but see §3 for how REC 7.1.2 differs (it is the job-creating start record).
- `claude/record-sections-collapse-and-job-autofocus-instructions.md` — collapsible section engine; this record adopts it.
- `claude/rec-7.1.2-7.1.5-tablet-ux-instructions.md` — earlier tablet sizing brief; the new flow supersedes the layout suggestions in that file but the touch-target sizes and font rules still apply.

---

## 1. The new three-section structure

REC 7.1.2 is reorganised into exactly **three sections** in this order:

| # | Section | Opens automatically? | Collapses automatically? |
|---|---|---|---|
| 1 | **Job Info** | Yes — only section visible on open | Yes — on Confirm |
| 2 | **Basket Entry** | Yes — revealed after Job Info confirmed | No — stays open while operator is scanning |
| 3 | **Basket List** | No — collapsed by default | — operator opens to review |

The three sections are rendered inside the standard collapsible `<details>` component from `form-record.js` (the same `fr-section-collapsible` pattern used throughout the system).

---

## 2. Section 1 — Job Info

### 2.1 Opening state
When a **new** entry is opened, only Section 1 is visible. Sections 2 and 3 are hidden and inert (same gate rule as `record-open-job-gate-instructions.md §2`), except that this record **is the job-creating start record** — it does not search for an existing job, it creates one. The fields in Section 1 are the full job-creating fields (date, farm, AG code, intake weight, etc.) exactly as they are today. The job gate (search bar) does **not** apply here.

### 2.2 Confirm button
A **Confirm** button sits at the bottom of Section 1, inside the section (not a page-level footer button). It is styled as a primary action button (same `--action` colour, 48 px tall). Label: **Confirm job info**.

- The Confirm button is **disabled** until all required fields in Section 1 are filled and valid.
- On Confirm:
  1. Validate Section 1 fields. If any fail, show inline errors and do not proceed.
  2. Section 1 collapses (animates closed, 150 ms; respect `prefers-reduced-motion`).
  3. Section 1 collapsed header shows: `JOB INFO — [job no. / AG code / intake date one-liner]`.
  4. Section 2 (Basket Entry) is revealed and opened. Focus moves to the first interactive element of Section 2 (the **Scan / enter basket** button or the barcode input).
  5. Section 3 (Basket List) is revealed but collapsed.
- The operator can re-open Section 1 by tapping its header to review or correct values. After editing, they tap Confirm again (same button, still at the bottom of Section 1). If a required field is cleared, the Confirm button becomes disabled again.
- Section 2 and 3 do **not** re-hide if Section 1 is re-opened after the first Confirm — they stay visible once revealed.

---

## 3. Section 2 — Basket Entry

This is the active scanning/entry area. It is **not** a table. It is a focused input panel designed for one basket at a time.

### 3.1 Current size range display

At the top of Section 2, a prominent strip shows the **current size range** that will be applied to the next basket added:

```
SIZE RANGE  ·  0–50 g                [⟳ New size range]
```

- The size range label is large (18 px, bold).
- **[⟳ New size range]** is a secondary button (outline style, 44 px tap target). Tapping it opens the size range selector (see §3.2).
- If no size range has been set yet, the strip shows: `SIZE RANGE  ·  Not set` in amber, and the "Add basket" action is blocked until a size range is set.

### 3.2 Size range selector

Tapping **New size range** opens a modal/sheet (same style as the dry cooking optional-additions pop-up):
- Title: **Select size range**
- The existing size range options as large segmented buttons (one tap to select — no dropdown). If there are more than 6 options, use a simple vertical list of 48 px tap-target buttons.
- Buttons: **Set size range** (primary, disabled until a selection is made) and **Cancel**.
- On Set: the strip in §3.1 updates to the new size range. The selection applies to all baskets added after this point until changed again.
- On Cancel: nothing changes.
- The size range is **not** stored until a basket is added; changing it before adding any basket has no effect on already-added baskets.

### 3.3 Basket scan / entry

Below the size range strip, a large input area for the basket identifier:

```
[ 📷 Scan barcode ]     or     [ ___________🔍 Enter basket # ]
```

- **Scan barcode** button: 56 px tall, full width on portrait, half width on landscape. Tapping it activates the device camera (using the browser's built-in barcode/QR API: `BarcodeDetector` where available; fall back to a text input if unavailable). On a successful scan the basket number is auto-filled into the entry field and the focus moves to the Weight field.
- **Enter basket #** input: plain text input, 48 px, numeric keyboard suggestion. The operator can type the basket number directly. On tablets without a camera or where scan fails, this is the primary path.
- A hint below: *"Basket # = lot code without 'FD' — e.g. FD1234 → 1234"*. If the operator types a value starting with "FD" or "fd", an inline suggestion appears: *"Did you mean [value without FD]?"* with a one-tap **Use [derived]** correction.

### 3.4 Weight field

Directly below the basket # input:

```
Weight (kg)   [ __________ ]
```

- Numeric input, decimal, 48 px, numeric keyboard. Unit suffix "(kg)" visible inside the input.
- Required. "Add basket" is disabled until both basket # and weight are filled.

### 3.5 Add basket button

A single full-width **Add basket** button (56 px, `--action` colour). Tap it once both fields are filled.

On tap:
1. Validate: basket # not empty, weight > 0, size range is set.
2. If valid:
   - The basket is added to the internal roster (stored as a row with basket #, weight, size range, and current timestamp).
   - A brief confirmation toast appears at the top of Section 2: **"Basket [#] added — [weight] kg · [size range]"** (2 seconds, dismissible). This is the only feedback — the list is not shown here.
   - The **basket # field is cleared** and re-focused (ready for the next scan/entry). Weight is also cleared.
   - The **basket count** and **running total weight** in the strip (§3.6) update immediately.
   - The current size range stays set — it persists until **New size range** is tapped.
3. If invalid: inline error under the relevant field; no toast, no add.

### 3.6 Running tally strip

A strip pinned at the bottom of Section 2 (above the section divider, always visible within the section):

```
Baskets added: 12   ·   Total weight: 234.50 kg
```

Updates live on every Add. Styled in secondary text colour (`--ink-2`), not bold — informational, not the primary action area.

### 3.7 Section 2 does not show the basket list

Section 2 contains **only** the current size range strip, the scan/entry fields, and the tally. There is no table, no basket list, and no scroll-through of previously added baskets. The operator focuses entirely on the current basket.

---

## 4. Section 3 — Basket List

### 4.1 Collapsed by default

Section 3 starts **collapsed** when first revealed (after Job Info confirmed). Its header shows:

```
▸ BASKET LIST — 12 baskets · 234.50 kg
```

The count and total update live even while collapsed (the `<summary>` text is bound to the same state).

### 4.2 Opening the list

Tapping the Section 3 header expands it to show the full basket table — one row per basket in the order they were added:

| Basket # | Size range | Weight (kg) | ✕ |
|---|---|---|---|
| 1234 | 0–50 g | 18.50 | ✕ |
| 1235 | 0–50 g | 20.10 | ✕ |

- The table is read-only except for the delete (✕) button on each row.
- **✕ delete:** tapping ✕ shows a confirm toast: *"Remove basket [#]? [Yes, remove] [Keep]"*. On Yes: row removed, tally updates, Section 3 header count updates. No undo beyond the confirm.
- The operator can also edit an existing basket by tapping its row (optional — open to Michaela's preference; if yes, tapping a row re-populates Section 2's fields pre-filled with that basket's values and the Add button changes to **Update basket**; on Update, the row is updated in place; on clearing the basket # field, the edit is cancelled).
- On tablet landscape: the table is a standard scrollable table within the section. On portrait: each basket becomes a compact two-line card (Basket # + size range on line 1, weight on line 2, ✕ at top right).
- A **"+ Add more baskets"** link at the bottom of the list scrolls back up to Section 2 and focuses the barcode/basket # input — for when the operator opened the list to check and wants to resume scanning.

### 4.3 No horizontal scroll requirement

All basket fields (basket #, size range, weight, ✕) fit in a 3-column + action layout without horizontal scrolling on a portrait tablet at standard tablet widths (≥ 768 px).

---

## 5. Submit and draft

- **Save draft** and **Submit** are in the sticky bottom action bar (standard, per the tablet brief). They are only visible and active after Section 1 is confirmed (the gate).
- Submit is blocked if: Section 1 has required fields empty, or no baskets have been added (Basket List is empty), or any other existing required validation fails.
- A draft saved after confirmation restores with: Section 1 collapsed (showing the job summary), Section 2 open, Section 3 collapsed. The same state as after first confirm.

---

## 6. What does not change

- Storage keys and database schema for baskets — no change. Each basket row stores the same fields as today.
- Validation rules on basket weight and basket # — no change.
- CSV export: column names, order, and values — no change.
- Print / PDF layout — no change. All baskets print in a table as today, regardless of which section is collapsed on screen.
- The OOSW business rule that compares total receiving weight to the OOSW record — no change.
- Other records in the system — no change.

---

## 7. Barcode scanning — implementation note

Use the browser-native `BarcodeDetector` API (supported in Chrome on Android and desktop; not in Safari/iOS as of early 2026 — check current support before shipping). Graceful fallback for unsupported browsers: the Scan button is hidden and the text input is the only path (no error shown, just no button). Do not add a third-party scanning library unless `BarcodeDetector` is confirmed absent on the actual tablet's browser. Check with Michaela which browser and tablet model are on the floor (from `claude/tablet-ui-optimisation-brief.md §10`).

The scanned value is treated as the basket #. Trim whitespace. If the scanned string starts with "FD"/"fd", apply the same "Did you mean?" suggestion as §3.3.

---

## 8. Testing checklist

1. **New entry:** only Section 1 is visible. Sections 2 and 3 are not rendered visibly. No footer Submit button.
2. **Confirm disabled:** leave a required Section 1 field blank; Confirm stays disabled. Fill all fields; Confirm enables.
3. **Confirm:** tap Confirm → Section 1 collapses (header shows job summary) → Section 2 appears open with focus on the Scan/Enter area → Section 3 appears but collapsed (header shows "0 baskets · 0.00 kg") → footer Submit and Save draft appear.
4. **Size range not set:** the strip shows "Not set" in amber. Add basket is disabled. Tap New size range, select a range, tap Set → strip updates → Add basket enables.
5. **New size range mid-session:** add 3 baskets at size X, tap New size range, select Y, add 2 more. Basket List shows 3 at X, 2 at Y.
6. **Barcode scan (where supported):** tap Scan, present a barcode, basket # fills, focus moves to Weight. On unsupported browser: Scan button absent, text input is sole path.
7. **FD prefix:** type "FD1234" → suggestion appears → tap "Use 1234" → field shows 1234.
8. **Add basket:** fill basket # and weight → tap Add → toast shows with basket details → basket # and weight clear → focus returns to basket # → tally updates → Section 3 header count updates.
9. **Section 3 collapsed/open:** header shows live count and total. Tap header → table appears. All rows correct order, size ranges correct.
10. **Delete basket:** tap ✕ → confirm toast → Yes → row removed, tally and header count update.
11. **Re-open Section 1:** tap its header → opens → edit a field → Confirm re-validates. Section 2 and 3 remain visible.
12. **Submit blocked:** remove all baskets (basket list empty) → Submit disabled.
13. **Draft restore:** save a draft with 5 baskets → reload → Section 1 collapsed, Section 2 open, Section 3 collapsed with correct count. The 5 baskets are intact in Section 3.
14. **Print:** generate PDF → all baskets present in print layout regardless of screen collapsed state.
15. **CSV export:** columns and values identical to before the redesign.
16. **Portrait and landscape:** Section 2 fits one-column, no horizontal scroll. Section 3 list fits in portrait (no horizontal scroll). Landscape table has standard columns.
17. **Touch targets:** Scan button ≥ 56 px, Add basket ≥ 56 px, New size range ≥ 44 px, ✕ ≥ 40 px, Section headers ≥ 44 px.
