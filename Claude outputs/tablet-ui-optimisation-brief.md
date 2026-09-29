# Processing Department — Tablet UI Optimisation Brief

**Date:** 2026-09-29
**For:** Claude Design (visual pass) and Claude Code (implementation pass). No code is included here — this is the brief, the rules, and the acceptance tests.
**Concern being answered:** "We may not be building the most user-friendly design on tablet — colours, blocks and general busyness on pages."
**Short answer:** the concern is justified, and it is mostly a *consistency and restraint* problem, not a missing-feature problem. The stylesheets show too many colours competing for meaning, too many boxes-inside-boxes, a type scale that still bottoms out at 11–12px, and breakpoints that miss landscape tablets. All of it is fixable in the theme layer without touching data, fields, validation or the database.

---

## 0. How this brief was built (and what it could not see)

**Read:** `record-theme.css`, `responsive.css`, `desktop-layout.css`, `nav-menu.css` (the live stylesheets in the repo), plus these project docs: `layout-redesign-instructions.md`, `mobile-tablet-font-responsiveness.md`, `consolidated-plan.md`, and the two Claude Design briefs for the Canning Report and Job Details.

**Could not see:** the running pages on a real tablet. The live site sits behind a password and I do not type passwords into sites on your behalf, so every finding below comes from the code, not from a screenshot. Before Claude Design starts, Michaela should capture the baseline screenshots listed in Section 9, Phase 0 — that is a 15-minute job and it turns this brief from "what the CSS says" into "what the operator sees".

**Assumptions to confirm (Section 10):** which tablet model(s) are actually on the floor, whether operators wear gloves or have wet hands, whether the tablet is held or mounted, and the lighting (glare from wet stainless and overhead light matters for contrast).

---

## 1. Scope

**In scope:** the individual record-entry pages reached from Record List (the ~130 records, across the three rendering paths: `form-record.js` engine `.fr-*`, `monitoring-log.js` engine `.ml-*`, and the ~28 bespoke 7.x pages), plus the shared shell (top bar and hamburger menu).

**Out of scope, unchanged:** Home/Dashboard and Trends, Job Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Quick Abalone Receiving, the Canning Report and other desktop reports, and the login modal. This is the same boundary already set in `layout-redesign-instructions.md` and `consolidated-plan.md`.

**One boundary decision for Michaela (Section 10, Q1):** Record List is the front door tablet users go through to reach every record, and it is currently out of scope. If operators find records by tapping through that page on the tablet, its row size and filter box matter as much as the forms. Recommend a *tap-target-only* exception (row height and filter input), no restyle.

**Never changes:** field names, order, validation, calculations, database calls, storage keys, CSV/print output, record routes.

---

## 2. Diagnosis — why the pages feel busy

Each finding is tied to something in the code, so Claude Code can find it and Claude Design can see what to fix.

### 2.1 Colour: too many things are coloured, so colour has stopped meaning anything

- **Two parallel palettes exist in `record-theme.css`.** The `--rt-*` tokens (top of file) and a second `--palette-*` set (around line 856). They disagree: primary gold is `#A9763A` in one and `#C9832B` in the other, with two different hover golds (`#C0863F`, `#DD9536`).
- **Twenty category header colours.** There are 20 `data-palette` blocks (sauce, dry, cleaning/hygiene, traceability, quality_general, canning, live, technical/maintenance, warehouse/stock, SOP's, unknowns, and nine decorative names such as periwinkle, lilac, coral, cherry-blossom-pink, terracotta). Several of the names are decorative, not meaningful — an operator cannot learn 20 colours, so the header colour tells them nothing.
- **At least seven accent hues can appear on one page:** gold (actions), green (ok), amber (in progress), red (fail), blue (info/links/averages), purple (card accent stripe), plus the category header colour. Green/amber/red mean *state*; the rest are decoration. When decoration and state share the palette, the state colours stop standing out — which is the opposite of what a floor tablet needs.
- **Contrast problems (measured, WCAG 2.x):**
  - White text on the brand gold `#A9763A` is **3.93:1** — below the 4.5:1 needed for normal-size text. On `#C9832B` it is worse (**3.1:1**), which is why that palette uses black text (6.76:1) — so there are two button styles.
  - The input border used on PC density, `#B9C0C6` on white, is **1.84:1**, and the default card/table border `#E2E4E3` is **1.28:1**. Field boundaries need about 3:1 to stay visible in glare. Faint borders make a form look like a page of floating labels.
  - Gold text on the cream page background `#F4F1E8` is **3.48:1** — fine for large headings, not for small labels.
  - Passing already: slate `#5C6771` on cream 5.12:1, white on green `#15803D` 5.02:1, white on amber `#B45309` 5.02:1. Keep these.

### 2.2 Type: still too small for a held, arm's-length screen

- The most common font sizes declared in `record-theme.css` are **11px and 12px** (22 of 60 declarations), then 14px and 13px. `desktop-layout.css` sets field labels to 11px.
- The tablet fixes in `mobile-tablet-font-responsiveness.md` raise sizes only at `max-width: 1024px` and `768px`. Labels land at 13.5–14px on tablet in the two engines, hints at 12px. That is better, but hints and units at 12px are still hard to read at arm's length on a wet floor.

### 2.3 Breakpoints: the tablet rules likely don't fire on a landscape tablet

Tablet sizes are decided by **width**, and landscape tablets are wider than the 1024px tablet breakpoint:

| Common tablet | Portrait (CSS px) | Landscape (CSS px) | Hits `≤1024` tablet rules? |
|---|---|---|---|
| 10.2" iPad | 810 × 1080 | 1080 × 810 | Portrait yes, **landscape no** |
| 10.9–11" iPad | 820–834 × 1180–1194 | 1180–1194 × 820 | Portrait yes, **landscape no** |
| 12.9" iPad Pro | 1024 × 1366 | 1366 × 1024 | Portrait borderline, **landscape no** |
| 10.1" Android | 800 × 1280 | 1280 × 800 | Portrait yes, **landscape no** |

So a tablet held in landscape — the natural way to use a wide form — likely receives the *desktop* density (36px inputs, 11px labels from the PC rules, if `rt-pc` is present, and the un-bumped type otherwise). On top of that, five different breakpoint values are in play across the files (`1099`, `1024`, `800`, `768`, `700`, `699`, `560`, `480`), so behaviour changes at widths that don't correspond to any real device. **Fix by switching from width to input type** (Section 5.1).

### 2.4 Blocks: boxes inside boxes, and a border around everything

- Cards, panels, section heads, per-row roster cards, an accent-stripe card variant, and bordered inputs stack up so a single field can sit inside four visual containers. `desktop-layout.css` exists largely to *undo* the per-row card look for roster records — a sign the tablet default is too boxy.
- Every field is a bordered box with a label above it, at equal visual weight. Nothing tells the operator which fields matter now, which are optional, which are auto-filled, and which are already done.
- Entries and Verification are collapsed panels below the form — good — but they use the same card styling as the form itself, so the page still reads as a stack of equal blocks.

### 2.5 Structure: long single-scroll forms with no orientation

- The top bar carries identity only (correct), but there is no way to see progress through a long form or jump to a section, and Save draft / Submit live at the end of the scroll. On a long record the operator must scroll to the bottom to save.
- The original design (sidebar + tab bar) was dropped in the built version — the code comment says "no sidebar / tab bar at any width" and navigation is now a hamburger dropdown. That is a sound decision for tablets (it gives the form the full width), and this brief keeps it. `layout-redesign-instructions.md` should be marked *superseded on the sidebar/tab bar* so nobody rebuilds it.

### 2.6 Three rendering paths means three chances to be inconsistent

Type and spacing are defined separately in `fr-*`, `ml-*` and hand-written pages. The bumps were applied three times. Any new rule must be written **once as tokens** and consumed by all three, or drift will return.

---

## 3. Design principles for the floor tablet

1. **Colour means state, never decoration.** One action colour, three state colours, everything else neutral.
2. **One container level.** A page is a background, sections, and fields. No card inside a card, no border on both the section and every field row.
3. **Show what the operator must do next.** Emphasise the current section; quiet the rest.
4. **Big, forgiving, close-together-but-not-touching targets.** Wet or gloved fingers miss small targets; adjacent targets need real gaps.
5. **Text you can read at arm's length under glare.** Nothing below 14px; values larger than labels.
6. **The keyboard is part of the design.** Numbers get a number pad, dates get a picker, choices get buttons — typing is the last resort.
7. **Never lose work.** Autosave, visible save state, and a clear message when the server is waking up.
8. **No hover dependence.** Every state must be visible without a mouse.

---

## 4. The colour system (single source of truth)

Replace the two palettes with one token set. Names below are suggestions for the tokens; values are starting points for Claude Design to validate on a real tablet outdoors-bright and indoors.

| Role | Token | Value | Used for | Contrast note |
|---|---|---|---|---|
| Page background | `--bg` | `#F4F1E8` (keep) | Behind everything | — |
| Surface | `--surface` | `#FFFFFF` | Section content | — |
| Text | `--ink` | `#1B2330` (keep) | Values, headings | 15.8:1 |
| Secondary text | `--ink-2` | `#54606B` | Labels, hints | 6.4:1 on white |
| Structure line | `--line` | `#E2E4E3` | Section dividers only | decorative |
| **Field boundary** | `--field-line` | `#8A949C` (3.1:1 on white) | Input borders | needed for visibility |
| Top bar / menu | `--chrome` | `#1B2330` / `#1D2B38` (keep) | Header, hamburger panel | — |
| **Action** | `--action` | **`#96652B`** (5.0:1 with white) | Submit, primary buttons, focus ring | replaces both golds |
| Action hover/pressed | `--action-press` | `#7C5222` | Pressed state | — |
| OK / pass | `--ok` | `#15803D` (keep) + tint `#E8F3EC` | Pass, verified, saved | 5.0:1 |
| Warning / in progress | `--warn` | `#B45309` (keep) + tint | Draft, needs attention | 5.0:1 |
| Fail / deviation | `--fail` | `#A3352D` (keep) + tint `#FBE8E6` | Fail, out of spec, error | 6.8:1 |
| Info | `--info` | `#1D4ED8` (keep) | Links and info only | — |

**Rules:**

- **Purple is retired** as a card accent stripe. It carries no meaning.
- **Category colour is demoted.** The 20 header colours collapse to **one navy header** for every record. Category identity moves to a small chip in the top bar (category name text plus a 10px dot in the old category colour). Ten years from now nobody has to remember what periwinkle means. If Michaela wants to keep some header colour, cap it at **6 meaningful categories** (Canning, Dry, Live, Quality, Hygiene, Stock), all dark enough for white text at 4.5:1, and delete the decorative names.
- **Every state uses colour + icon + word.** Pass is green + ✓ + "Pass"; fail is red + ✕ + "Fail". About 1 in 12 men has some colour-vision deficiency, and colour alone also disappears in print.
- **Maximum hue budget per page:** action colour + up to three state colours + neutrals. Nothing else.
- **Filled vs empty is a colour job too:** a completed field/section gets a subtle green tick, not a green fill, so the page doesn't turn into a traffic-light board.

---

## 5. Layout, type and touch rules

### 5.1 Detect touch, not width
Apply tablet sizing whenever the device is a touch device (input type "coarse"), regardless of screen width, so landscape tablets get tablet rules. Keep one small width breakpoint only for narrow portrait layouts (single column below roughly 700px). Delete the redundant intermediate breakpoints once each has been checked. Desktop users with a mouse keep the compact PC density (`rt-pc`).

### 5.2 Type scale (tablet / coarse pointer)

| Element | Size | Weight | Note |
|---|---|---|---|
| Record title (top bar) | 18px | 700 | |
| Section heading | 18px | 700 | Sentence case, not tiny all-caps |
| Field label | 15px | 600 | Above the field, never wrapping mid-phrase |
| **Field value (input text)** | **18px** | 500 | Larger than the label — the value is the point |
| Hint / unit / helper | 14px | 400 | Minimum anywhere on screen is 14px |
| Buttons | 17px | 700 | |
| Table body / roster values | 16px | 500 | Table headings 14px |

Remove every 11px and 12px declaration on screen (print keeps its own 12px lock — unchanged).

### 5.3 Touch targets and spacing

- Inputs and secondary buttons: **48px** minimum height (current 44px is the floor, not the goal, for gloves).
- **Primary Submit: 56px** high, full width of the action bar.
- Checkbox / radio: **28px** box with the entire label row tappable at 48px.
- **8px minimum gap** between any two tappable things; 16px between field groups; 24px between sections.
- Row-delete (✕) buttons: 40px with a 12px gap, and a confirm/undo toast rather than an instant delete.
- Buttons inside roster tables: 40px, the current 36px is too tight.

### 5.4 Page anatomy (every record, all three rendering paths)

1. **Top bar (sticky, 56px):** back, doc code, title, category chip, save-state indicator ("Draft saved 10:42"), hamburger. Identity only — no job/batch fields (existing rule).
2. **Section rail (sticky, under the top bar, ≥ ~4 sections only):** a horizontal strip of section names with a tick when complete, tap to jump. Replaces the "scroll and hope" problem for long records.
3. **Sections:** each one a flat white block with a heading and a hairline divider. **No card-in-card.** Section header shows "3 of 8 fields done" for long sections.
4. **Sticky bottom action bar:** `Clear` (text-only), `Save draft` (outline), `Submit` (filled action colour, 56px). Always on screen. Padded for iOS home indicator.
5. **Entries and Verification:** below the form, as slim full-width bars ("Entries (12) ›"), not cards, opening into a full-height sheet so the form is not pushed off screen.

### 5.5 Fields

- **Grid:** landscape 2 columns (3 only for tightly related short fields like Point 1/2/3), portrait 1 column. No more than **6 fields visible in one group** before a subheading.
- **Field boundary:** 1.5px `--field-line`, 8px radius. Focus: 3px `--action` ring — visible from arm's length.
- **State of a field must be visible:** empty (white), filled (white + tick), auto-filled/read-only (grey `#EEF1F0`, lock icon, not editable-looking), invalid (red border + message underneath in plain words), optional (label suffix "(optional)" in secondary text). Required fields are the default, so mark the *optional* ones — it reduces asterisk noise.
- **Hints move behind an ⓘ button** on the label instead of sitting under every field. Instruction text from the work instructions stays reachable via the existing top-bar button.
- **Input types:** numbers use the numeric/decimal keypad; date and time use native pickers with a "Now" shortcut button; **Yes/No, Pass/Fail and any choice with 4 or fewer options become big segmented buttons** (min 48px, selected state = filled + tick), not dropdowns; dropdowns only for long lists.
- **Numeric stepper (− / +)** beside number fields that are usually adjusted by small amounts (counts, temperatures) — optional, pilot on one record first.
- **Sensible defaults:** today's date, logged-in operator, last-used values for shift-constant fields (with a visible "carried over" cue so nothing is submitted by accident).

### 5.6 Repeating-row and roster records

- Keep the table-like row (label heading once, then one line per row) on landscape; on portrait, a row becomes a compact two-line block. Remove the per-row card border.
- Every row: 48px inputs, ✕ at the end, and **"+ Add row"** as a full-width 56px button under the last row, and a running total/count strip pinned above the list.
- Newly added row scrolls into view and focuses its first input.
- Zebra striping stays subtle (`#F7F8F7`), and the header row of the table stays visible when scrolling (sticky).

### 5.7 Feedback and reliability (matters on tablets in a wet plant)

- **Save-state chip** in the top bar: *Saved*, *Saving…*, *Draft saved*, *Offline — will retry*, *Error — tap to retry*.
- **Server waking message:** the API is on Render's free tier and sleeps after 15 minutes idle, so the first save/load can take many seconds. Show "Connecting to the server… this can take up to a minute after a quiet period" with a progress indicator instead of a blank or frozen screen. Never let the operator tap Submit twice because nothing appeared to happen — disable the button and show the state.
- **Autosave draft** locally every few seconds so a dropped connection or accidental navigation doesn't lose entries; restore with a visible "Restored your draft from 10:42" banner.
- **Submit confirmation:** a full-width success sheet ("Submitted · 10:43 · view entry") that clears itself, instead of a small toast that can be missed.
- **Validation:** summarise at the bottom bar ("2 fields need attention"), tap to jump to the first one; inline messages in plain words ("Enter pH between 4.0 and 7.0"), not codes.

### 5.8 Menu and shell

- The hamburger panel (320px, 48px rows) is the right pattern; keep it. Add the current record's category and a "Recently used" group of 3–5 records at the top, since operators repeat the same few forms each shift.
- Right-hand (thumb-friendly) placement of the hamburger for right-handers is fine; ask whether a left-handed toggle is needed (Section 10).

---

## 6. What "less busy" means in practice (before/after checklist for every record)

| Before (today) | After |
|---|---|
| 20 header colours | One navy header + small category chip |
| 7 accent hues on a page | Action colour + ok/warn/fail + neutrals |
| Cards inside cards | Flat sections on the page background |
| Every field a same-weight bordered box | Clear filled / empty / read-only / invalid states |
| Hints under every field | Hints behind ⓘ |
| 11–12px labels and hints | Nothing under 14px |
| Submit at the bottom of the scroll | Sticky bottom action bar |
| Long form, no orientation | Section rail with ticks |
| Dropdowns for Yes/No, Pass/Fail | Big segmented buttons |
| Blank screen while the API wakes | Explicit "Connecting…" state |

---

## 7. Implementation approach (for Claude Code) — keep it one change in one place

1. **Introduce the token set (Section 4) in `record-theme.css` only**, scoped exactly as the file already scopes things (`.rt-shell` and its descendants). Do not add bare element selectors — `job-status.html` also loads this stylesheet, and the file header explicitly warns about that.
2. **Make both engines and the bespoke pages consume tokens.** In `form-record.js` and `monitoring-log.js`, replace hard-coded sizes and colours in their injected `<style>` blocks with the same variables (or override them from the theme file loaded last). In `responsive.css`, re-key the `--form-fs-*` variables to the new scale. **Goal: change a value once, all three paths follow.**
3. **Replace width breakpoints with a touch query** as described in 5.1, keeping the existing print re-pins (`@media print` must still lock 12px and exact layouts — not touched).
4. **Retire the duplicate palette.** Remove `--palette-*` and the 20 `data-palette` blocks only after confirming which pages set `data-palette` (search the engines and pages). Replace with a category chip. Confirm before deleting anything in use — same rule as the earlier redesign brief.
5. **Add the shared pieces:** section rail, sticky action bar, save-state chip, segmented Yes/No, slim Entries/Verification bars. Build them as small shared components used by both engines so the ~130 records get them without page-by-page edits. Bespoke 7.x pages adopt them in a later phase.
6. **Don't change** storage calls, keys, validation, computations, CSV export, print sheets, routes.

---

## 8. Acceptance criteria (measurable, so "user-friendly" is testable)

A page passes only if **all** are true on a real tablet in **both orientations**:

1. **No text smaller than 14px on screen** (script: list any visible element with computed font-size < 14px, excluding print).
2. **Every interactive element ≥ 48px** (≥ 40px only for row ✕ and in-table buttons) with ≥ 8px between neighbours (script: measure bounding boxes).
3. **Contrast:** all normal text ≥ 4.5:1; all field borders and icon-only controls ≥ 3:1 (run an automated contrast check across the pilot pages).
4. **Hue budget:** no more than the action colour, the three state colours, the neutrals, and the info blue on any page (visual review against a screenshot).
5. **No nested card levels** (page → section → field; nothing wraps a section in a second bordered box).
6. **Submit reachable without scrolling** (sticky bar), and section rail present for records with ≥ 4 sections.
7. **Landscape and portrait both use tablet sizing** on the actual tablet model(s) (this catches the breakpoint problem).
8. **State visible without colour** (turn on greyscale — pass/fail/read-only still distinguishable by icon and word).
9. **Print output identical** to before (compare PDF of three records).
10. **Behavioural parity:** submit the same test data before/after on three records and diff the stored value and CSV — must be identical.
11. **Floor test:** three real operators each complete the same pilot record on the tablet, no coaching, and report on a 3-question form: could you read it, did you hit the wrong thing, did you know what to do next. Target: zero "could not read" answers and fewer mis-taps than today (count them over 5 minutes of observation).

---

## 9. Phased plan

**Phase 0 — Baseline (Michaela, ~15 min).** On the actual tablet, in landscape and portrait, take screenshots of: (a) one repeating-row record (Mortalities Log), (b) one single-submission form, (c) REC 7.2.12 Double Seam, (d) one monitoring-log record, (e) the hamburger menu open, (f) the Record List page. Note the tablet model and browser (Safari / Chrome). Save into the project folder as `baseline-tablet/`.

**Phase 1 — Design (Claude Design).** Deliverable: three archetype screens in landscape and portrait — repeating-row, single-submission (measurement heavy), monitoring log — plus the component sheet (buttons, fields in every state, segmented control, status chips, section rail, action bar, roster row, save-state chip) and the final colour tokens with contrast values. Michaela reviews. Prompt is in Section 11.

**Phase 2 — Tokens and shared components (Claude Code).** Sections 7.1–7.3, verified on one throwaway test page, then on Mortalities Log only. Review.

**Phase 3 — Pilot on three records** (one per rendering path: one `fr`, one `ml`, one bespoke). Run all Section 8 tests plus the floor test with three operators. Record what changes.

**Phase 4 — Roll-out** by rendering path (engines first: all `fr` and `ml` records change together via tokens; bespoke pages in batches of about 5). Regression check of all out-of-scope pages (unchanged) after each batch.

**Phase 5 — Retire the old palette and dead breakpoints; update docs** (`layout-redesign-instructions.md` marked superseded on sidebar/tab bar; `mobile-tablet-font-responsiveness.md` updated to the new scale; `record-theme.css` header comment refreshed).

Suggested order of value if time is short: **type scale + touch query → colour tokens → sticky action bar → Yes/No segmented buttons → section rail → the rest.** Those five remove most of the "busy and small" feeling.

---

## 10. Open questions for Michaela

1. **Record List on tablet:** may Claude Code make tap-target-only changes (row height, filter input size) there? (It is the front door.)
2. **Which tablet model(s), browser, and how is it held or mounted?** (Decides breakpoints and the test matrix.)
3. **Gloves or wet hands?** If yes, primary buttons go to 64px and the stepper becomes standard, not optional.
4. **Category colours:** collapse to one navy header plus chip (recommended), or keep up to six meaningful ones?
5. **Lighting:** any bright or glare-heavy areas? (Would justify a high-contrast mode later.)
6. **Left-handed operators:** need a left/right toggle for the hamburger and action bar?
7. **Language:** English only on the tablet, or do any operators need another language? (Affects label length and wrapping.)
8. **Do all operators use one shared tablet or personal ones?** Shared tablets should not carry over "last-used values" silently across operators.

---

## 11. Paste-ready prompts

### For Claude Design
> Design the tablet record-entry experience for the Abagold Processing Department system. Use `claude/tablet-ui-optimisation-brief.md` Sections 2–6 as the requirements and the existing palette tokens (navy `#1B2330`/`#1D2B38`, cream `#F4F1E8`, ink `#1B2330`) as the base.
>
> Deliver, for **landscape (1180×820) and portrait (820×1180)**: (1) a repeating-row record (Mortalities Log), (2) a measurement-heavy single-submission record (Double Seam Inspection), (3) a monitoring-log record; (4) the hamburger menu open; and (5) a component sheet showing every field state (empty, filled, read-only/auto-filled, invalid, optional), the segmented Yes/No and Pass/Fail controls, status chips with icon+word, the sticky action bar, section rail, roster row with ✕, and the save-state chip in all five states.
>
> Rules: colour means state only; one action colour (`#96652B` on white, or propose an alternative with ≥4.5:1); one navy header for every record with a small category chip; no card-in-card; nothing under 14px; inputs 48px, Submit 56px, 8px minimum gaps; field borders ≥3:1 contrast; values at 18px, labels 15px. Show contrast values for every colour pairing. Do not change any field names, order or validation — this is a visual/layout change only. Keep everything print-safe; print layout is out of scope.

### For Claude Code
> Implement the tablet UI optimisation in `claude/tablet-ui-optimisation-brief.md`, Sections 4, 5, 7 and 8, in the phases in Section 9. Start with Phase 2 only: create the token set inside `.rt-shell` scope in `public/styles/record-theme.css`, wire `form-record.js`, `monitoring-log.js` and `responsive.css` to it, and switch tablet sizing from width breakpoints to a coarse-pointer (touch) query. Do not add bare element selectors — `job-status.html` also loads `record-theme.css`. Do not change data, keys, validation, calculations, CSV, print output, routes, or any out-of-scope page. Verify on a throwaway test page, then on Mortalities Log only, and stop for review. Before deleting `--palette-*` or any `data-palette` block, list every file that uses it and wait for confirmation. Report against each numbered criterion in Section 8, including the script results for font size, tap-target size and contrast.

---

## 12. Related docs

- `claude/layout-redesign-instructions.md` — scope boundary and tokens (sidebar/tab bar part superseded by the hamburger menu).
- `claude/mobile-tablet-font-responsiveness.md` — the earlier type/tap-target work this brief builds on and re-keys.
- `claude/consolidated-plan.md` — system status and what not to redesign (database and storage are untouched by this brief).
- `claude/canning-report-design-improvements-brief.md`, `claude/job-details-modal-design-brief.md` — desktop-only briefs; they should reuse the colour tokens in Section 4 so the whole system shares one palette.
