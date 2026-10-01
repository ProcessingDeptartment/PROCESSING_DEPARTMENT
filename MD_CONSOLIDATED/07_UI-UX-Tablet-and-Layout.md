# UI / UX: Tablet, Mobile, Layout and Navigation

Tablet optimisation, layout redesign, fonts, menu, collapsible sections and page-level UI changes.

_Consolidated from 13 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Processing Department — Tablet UI Optimisation Brief](#processing-department--tablet-ui-optimisation-brief) — `Claude outputs/tablet-ui-optimisation-brief.md`
2. [Tablet UI Implementation Instructions (for Claude Code)](#tablet-ui-implementation-instructions-for-claude-code) — `claude/tablet-ui-implementation-instructions.md`
3. [Tablet UI v2 — as built](#tablet-ui-v2--as-built) — `claude/tablet-ui-v2-as-built.md`
4. [Processing Department — Tablet Record-Entry Redesign Instructions for Claude Code](#processing-department--tablet-record-entry-redesign-instructions-for-claude-code) — `claude/layout-redesign-instructions.md`
5. [Record Pages — Field Alignment & Layout Fix (Instructions for Claude Code)](#record-pages--field-alignment--layout-fix-instructions-for-claude-code) — `claude/record-page-field-alignment-fix-instructions.md`
6. [Replace the Left Sidebar with a Top-Right Hamburger Dropdown — Every Record, All UI](#replace-the-left-sidebar-with-a-top-right-hamburger-dropdown--every-record-all-ui) — `Claude outputs/hamburger-dropdown-menu-instructions.md`
7. [Home Page — Remove the "Production — this month" Summary](#home-page--remove-the-production--this-month-summary) — `home-remove-this-month-summary-instructions.md`
8. [Record Pages — Collapsible Sections, Auto-Focus Job No., Auto-Collapse Job Info (Instructions for Claude Code)](#record-pages--collapsible-sections-auto-focus-job-no-auto-collapse-job-info-instructions-for-claude-code) — `Claude outputs/record-sections-collapse-and-job-autofocus-instructions.md`
9. [Record collapse / Job-info auto-collapse / job auto-focus — work log (2026-10-01)](#record-collapse--job-info-auto-collapse--job-auto-focus--work-log-2026-10-01) — `claude/record-collapse-autofocus-worklog.md`
10. [Mobile & Tablet Font Responsiveness — Work Done](#mobile--tablet-font-responsiveness--work-done) — `claude/mobile-tablet-font-responsiveness.md`
11. [Instruction: Mobile & Tablet Font Responsiveness](#instruction-mobile--tablet-font-responsiveness) — `Claude outputs/mobile-responsive-fonts-instruction.md`
12. [Time fields → clock selector](#time-fields--clock-selector) — `Claude outputs/time-fields-clock-selector.md`
13. [Instructions: Move "Edit Template" off record pages into an index section](#instructions-move-edit-template-off-record-pages-into-an-index-section) — `claude/EDIT_TEMPLATE_RELOCATION.md`

---

## Processing Department — Tablet UI Optimisation Brief

> **Source:** `Claude outputs/tablet-ui-optimisation-brief.md`

**Date:** 2026-09-29
**For:** Claude Design (visual pass) and Claude Code (implementation pass). No code is included here — this is the brief, the rules, and the acceptance tests.
**Concern being answered:** "We may not be building the most user-friendly design on tablet — colours, blocks and general busyness on pages."
**Short answer:** the concern is justified, and it is mostly a *consistency and restraint* problem, not a missing-feature problem. The stylesheets show too many colours competing for meaning, too many boxes-inside-boxes, a type scale that still bottoms out at 11–12px, and breakpoints that miss landscape tablets. All of it is fixable in the theme layer without touching data, fields, validation or the database.

---

### 0. How this brief was built (and what it could not see)

**Read:** `record-theme.css`, `responsive.css`, `desktop-layout.css`, `nav-menu.css` (the live stylesheets in the repo), plus these project docs: `layout-redesign-instructions.md`, `mobile-tablet-font-responsiveness.md`, `consolidated-plan.md`, and the two Claude Design briefs for the Canning Report and Job Details.

**Could not see:** the running pages on a real tablet. The live site sits behind a password and I do not type passwords into sites on your behalf, so every finding below comes from the code, not from a screenshot. Before Claude Design starts, Michaela should capture the baseline screenshots listed in Section 9, Phase 0 — that is a 15-minute job and it turns this brief from "what the CSS says" into "what the operator sees".

**Assumptions to confirm (Section 10):** which tablet model(s) are actually on the floor, whether operators wear gloves or have wet hands, whether the tablet is held or mounted, and the lighting (glare from wet stainless and overhead light matters for contrast).

---

### 1. Scope

**In scope:** the individual record-entry pages reached from Record List (the ~130 records, across the three rendering paths: `form-record.js` engine `.fr-*`, `monitoring-log.js` engine `.ml-*`, and the ~28 bespoke 7.x pages), plus the shared shell (top bar and hamburger menu).

**Out of scope, unchanged:** Home/Dashboard and Trends, Job Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Quick Abalone Receiving, the Canning Report and other desktop reports, and the login modal. This is the same boundary already set in `layout-redesign-instructions.md` and `consolidated-plan.md`.

**One boundary decision for Michaela (Section 10, Q1):** Record List is the front door tablet users go through to reach every record, and it is currently out of scope. If operators find records by tapping through that page on the tablet, its row size and filter box matter as much as the forms. Recommend a *tap-target-only* exception (row height and filter input), no restyle.

**Never changes:** field names, order, validation, calculations, database calls, storage keys, CSV/print output, record routes.

---

### 2. Diagnosis — why the pages feel busy

Each finding is tied to something in the code, so Claude Code can find it and Claude Design can see what to fix.

#### 2.1 Colour: too many things are coloured, so colour has stopped meaning anything

- **Two parallel palettes exist in `record-theme.css`.** The `--rt-*` tokens (top of file) and a second `--palette-*` set (around line 856). They disagree: primary gold is `#A9763A` in one and `#C9832B` in the other, with two different hover golds (`#C0863F`, `#DD9536`).
- **Twenty category header colours.** There are 20 `data-palette` blocks (sauce, dry, cleaning/hygiene, traceability, quality_general, canning, live, technical/maintenance, warehouse/stock, SOP's, unknowns, and nine decorative names such as periwinkle, lilac, coral, cherry-blossom-pink, terracotta). Several of the names are decorative, not meaningful — an operator cannot learn 20 colours, so the header colour tells them nothing.
- **At least seven accent hues can appear on one page:** gold (actions), green (ok), amber (in progress), red (fail), blue (info/links/averages), purple (card accent stripe), plus the category header colour. Green/amber/red mean *state*; the rest are decoration. When decoration and state share the palette, the state colours stop standing out — which is the opposite of what a floor tablet needs.
- **Contrast problems (measured, WCAG 2.x):**
  - White text on the brand gold `#A9763A` is **3.93:1** — below the 4.5:1 needed for normal-size text. On `#C9832B` it is worse (**3.1:1**), which is why that palette uses black text (6.76:1) — so there are two button styles.
  - The input border used on PC density, `#B9C0C6` on white, is **1.84:1**, and the default card/table border `#E2E4E3` is **1.28:1**. Field boundaries need about 3:1 to stay visible in glare. Faint borders make a form look like a page of floating labels.
  - Gold text on the cream page background `#F4F1E8` is **3.48:1** — fine for large headings, not for small labels.
  - Passing already: slate `#5C6771` on cream 5.12:1, white on green `#15803D` 5.02:1, white on amber `#B45309` 5.02:1. Keep these.

#### 2.2 Type: still too small for a held, arm's-length screen

- The most common font sizes declared in `record-theme.css` are **11px and 12px** (22 of 60 declarations), then 14px and 13px. `desktop-layout.css` sets field labels to 11px.
- The tablet fixes in `mobile-tablet-font-responsiveness.md` raise sizes only at `max-width: 1024px` and `768px`. Labels land at 13.5–14px on tablet in the two engines, hints at 12px. That is better, but hints and units at 12px are still hard to read at arm's length on a wet floor.

#### 2.3 Breakpoints: the tablet rules likely don't fire on a landscape tablet

Tablet sizes are decided by **width**, and landscape tablets are wider than the 1024px tablet breakpoint:

| Common tablet | Portrait (CSS px) | Landscape (CSS px) | Hits `≤1024` tablet rules? |
|---|---|---|---|
| 10.2" iPad | 810 × 1080 | 1080 × 810 | Portrait yes, **landscape no** |
| 10.9–11" iPad | 820–834 × 1180–1194 | 1180–1194 × 820 | Portrait yes, **landscape no** |
| 12.9" iPad Pro | 1024 × 1366 | 1366 × 1024 | Portrait borderline, **landscape no** |
| 10.1" Android | 800 × 1280 | 1280 × 800 | Portrait yes, **landscape no** |

So a tablet held in landscape — the natural way to use a wide form — likely receives the *desktop* density (36px inputs, 11px labels from the PC rules, if `rt-pc` is present, and the un-bumped type otherwise). On top of that, five different breakpoint values are in play across the files (`1099`, `1024`, `800`, `768`, `700`, `699`, `560`, `480`), so behaviour changes at widths that don't correspond to any real device. **Fix by switching from width to input type** (Section 5.1).

#### 2.4 Blocks: boxes inside boxes, and a border around everything

- Cards, panels, section heads, per-row roster cards, an accent-stripe card variant, and bordered inputs stack up so a single field can sit inside four visual containers. `desktop-layout.css` exists largely to *undo* the per-row card look for roster records — a sign the tablet default is too boxy.
- Every field is a bordered box with a label above it, at equal visual weight. Nothing tells the operator which fields matter now, which are optional, which are auto-filled, and which are already done.
- Entries and Verification are collapsed panels below the form — good — but they use the same card styling as the form itself, so the page still reads as a stack of equal blocks.

#### 2.5 Structure: long single-scroll forms with no orientation

- The top bar carries identity only (correct), but there is no way to see progress through a long form or jump to a section, and Save draft / Submit live at the end of the scroll. On a long record the operator must scroll to the bottom to save.
- The original design (sidebar + tab bar) was dropped in the built version — the code comment says "no sidebar / tab bar at any width" and navigation is now a hamburger dropdown. That is a sound decision for tablets (it gives the form the full width), and this brief keeps it. `layout-redesign-instructions.md` should be marked *superseded on the sidebar/tab bar* so nobody rebuilds it.

#### 2.6 Three rendering paths means three chances to be inconsistent

Type and spacing are defined separately in `fr-*`, `ml-*` and hand-written pages. The bumps were applied three times. Any new rule must be written **once as tokens** and consumed by all three, or drift will return.

---

### 3. Design principles for the floor tablet

1. **Colour means state, never decoration.** One action colour, three state colours, everything else neutral.
2. **One container level.** A page is a background, sections, and fields. No card inside a card, no border on both the section and every field row.
3. **Show what the operator must do next.** Emphasise the current section; quiet the rest.
4. **Big, forgiving, close-together-but-not-touching targets.** Wet or gloved fingers miss small targets; adjacent targets need real gaps.
5. **Text you can read at arm's length under glare.** Nothing below 14px; values larger than labels.
6. **The keyboard is part of the design.** Numbers get a number pad, dates get a picker, choices get buttons — typing is the last resort.
7. **Never lose work.** Autosave, visible save state, and a clear message when the server is waking up.
8. **No hover dependence.** Every state must be visible without a mouse.

---

### 4. The colour system (single source of truth)

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

### 5. Layout, type and touch rules

#### 5.1 Detect touch, not width
Apply tablet sizing whenever the device is a touch device (input type "coarse"), regardless of screen width, so landscape tablets get tablet rules. Keep one small width breakpoint only for narrow portrait layouts (single column below roughly 700px). Delete the redundant intermediate breakpoints once each has been checked. Desktop users with a mouse keep the compact PC density (`rt-pc`).

#### 5.2 Type scale (tablet / coarse pointer)

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

#### 5.3 Touch targets and spacing

- Inputs and secondary buttons: **48px** minimum height (current 44px is the floor, not the goal, for gloves).
- **Primary Submit: 56px** high, full width of the action bar.
- Checkbox / radio: **28px** box with the entire label row tappable at 48px.
- **8px minimum gap** between any two tappable things; 16px between field groups; 24px between sections.
- Row-delete (✕) buttons: 40px with a 12px gap, and a confirm/undo toast rather than an instant delete.
- Buttons inside roster tables: 40px, the current 36px is too tight.

#### 5.4 Page anatomy (every record, all three rendering paths)

1. **Top bar (sticky, 56px):** back, doc code, title, category chip, save-state indicator ("Draft saved 10:42"), hamburger. Identity only — no job/batch fields (existing rule).
2. **Section rail (sticky, under the top bar, ≥ ~4 sections only):** a horizontal strip of section names with a tick when complete, tap to jump. Replaces the "scroll and hope" problem for long records.
3. **Sections:** each one a flat white block with a heading and a hairline divider. **No card-in-card.** Section header shows "3 of 8 fields done" for long sections.
4. **Sticky bottom action bar:** `Clear` (text-only), `Save draft` (outline), `Submit` (filled action colour, 56px). Always on screen. Padded for iOS home indicator.
5. **Entries and Verification:** below the form, as slim full-width bars ("Entries (12) ›"), not cards, opening into a full-height sheet so the form is not pushed off screen.

#### 5.5 Fields

- **Grid:** landscape 2 columns (3 only for tightly related short fields like Point 1/2/3), portrait 1 column. No more than **6 fields visible in one group** before a subheading.
- **Field boundary:** 1.5px `--field-line`, 8px radius. Focus: 3px `--action` ring — visible from arm's length.
- **State of a field must be visible:** empty (white), filled (white + tick), auto-filled/read-only (grey `#EEF1F0`, lock icon, not editable-looking), invalid (red border + message underneath in plain words), optional (label suffix "(optional)" in secondary text). Required fields are the default, so mark the *optional* ones — it reduces asterisk noise.
- **Hints move behind an ⓘ button** on the label instead of sitting under every field. Instruction text from the work instructions stays reachable via the existing top-bar button.
- **Input types:** numbers use the numeric/decimal keypad; date and time use native pickers with a "Now" shortcut button; **Yes/No, Pass/Fail and any choice with 4 or fewer options become big segmented buttons** (min 48px, selected state = filled + tick), not dropdowns; dropdowns only for long lists.
- **Numeric stepper (− / +)** beside number fields that are usually adjusted by small amounts (counts, temperatures) — optional, pilot on one record first.
- **Sensible defaults:** today's date, logged-in operator, last-used values for shift-constant fields (with a visible "carried over" cue so nothing is submitted by accident).

#### 5.6 Repeating-row and roster records

- Keep the table-like row (label heading once, then one line per row) on landscape; on portrait, a row becomes a compact two-line block. Remove the per-row card border.
- Every row: 48px inputs, ✕ at the end, and **"+ Add row"** as a full-width 56px button under the last row, and a running total/count strip pinned above the list.
- Newly added row scrolls into view and focuses its first input.
- Zebra striping stays subtle (`#F7F8F7`), and the header row of the table stays visible when scrolling (sticky).

#### 5.7 Feedback and reliability (matters on tablets in a wet plant)

- **Save-state chip** in the top bar: *Saved*, *Saving…*, *Draft saved*, *Offline — will retry*, *Error — tap to retry*.
- **Server waking message:** the API is on Render's free tier and sleeps after 15 minutes idle, so the first save/load can take many seconds. Show "Connecting to the server… this can take up to a minute after a quiet period" with a progress indicator instead of a blank or frozen screen. Never let the operator tap Submit twice because nothing appeared to happen — disable the button and show the state.
- **Autosave draft** locally every few seconds so a dropped connection or accidental navigation doesn't lose entries; restore with a visible "Restored your draft from 10:42" banner.
- **Submit confirmation:** a full-width success sheet ("Submitted · 10:43 · view entry") that clears itself, instead of a small toast that can be missed.
- **Validation:** summarise at the bottom bar ("2 fields need attention"), tap to jump to the first one; inline messages in plain words ("Enter pH between 4.0 and 7.0"), not codes.

#### 5.8 Menu and shell

- The hamburger panel (320px, 48px rows) is the right pattern; keep it. Add the current record's category and a "Recently used" group of 3–5 records at the top, since operators repeat the same few forms each shift.
- Right-hand (thumb-friendly) placement of the hamburger for right-handers is fine; ask whether a left-handed toggle is needed (Section 10).

---

### 6. What "less busy" means in practice (before/after checklist for every record)

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

### 7. Implementation approach (for Claude Code) — keep it one change in one place

1. **Introduce the token set (Section 4) in `record-theme.css` only**, scoped exactly as the file already scopes things (`.rt-shell` and its descendants). Do not add bare element selectors — `job-status.html` also loads this stylesheet, and the file header explicitly warns about that.
2. **Make both engines and the bespoke pages consume tokens.** In `form-record.js` and `monitoring-log.js`, replace hard-coded sizes and colours in their injected `<style>` blocks with the same variables (or override them from the theme file loaded last). In `responsive.css`, re-key the `--form-fs-*` variables to the new scale. **Goal: change a value once, all three paths follow.**
3. **Replace width breakpoints with a touch query** as described in 5.1, keeping the existing print re-pins (`@media print` must still lock 12px and exact layouts — not touched).
4. **Retire the duplicate palette.** Remove `--palette-*` and the 20 `data-palette` blocks only after confirming which pages set `data-palette` (search the engines and pages). Replace with a category chip. Confirm before deleting anything in use — same rule as the earlier redesign brief.
5. **Add the shared pieces:** section rail, sticky action bar, save-state chip, segmented Yes/No, slim Entries/Verification bars. Build them as small shared components used by both engines so the ~130 records get them without page-by-page edits. Bespoke 7.x pages adopt them in a later phase.
6. **Don't change** storage calls, keys, validation, computations, CSV export, print sheets, routes.

---

### 8. Acceptance criteria (measurable, so "user-friendly" is testable)

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

### 9. Phased plan

**Phase 0 — Baseline (Michaela, ~15 min).** On the actual tablet, in landscape and portrait, take screenshots of: (a) one repeating-row record (Mortalities Log), (b) one single-submission form, (c) REC 7.2.12 Double Seam, (d) one monitoring-log record, (e) the hamburger menu open, (f) the Record List page. Note the tablet model and browser (Safari / Chrome). Save into the project folder as `baseline-tablet/`.

**Phase 1 — Design (Claude Design).** Deliverable: three archetype screens in landscape and portrait — repeating-row, single-submission (measurement heavy), monitoring log — plus the component sheet (buttons, fields in every state, segmented control, status chips, section rail, action bar, roster row, save-state chip) and the final colour tokens with contrast values. Michaela reviews. Prompt is in Section 11.

**Phase 2 — Tokens and shared components (Claude Code).** Sections 7.1–7.3, verified on one throwaway test page, then on Mortalities Log only. Review.

**Phase 3 — Pilot on three records** (one per rendering path: one `fr`, one `ml`, one bespoke). Run all Section 8 tests plus the floor test with three operators. Record what changes.

**Phase 4 — Roll-out** by rendering path (engines first: all `fr` and `ml` records change together via tokens; bespoke pages in batches of about 5). Regression check of all out-of-scope pages (unchanged) after each batch.

**Phase 5 — Retire the old palette and dead breakpoints; update docs** (`layout-redesign-instructions.md` marked superseded on sidebar/tab bar; `mobile-tablet-font-responsiveness.md` updated to the new scale; `record-theme.css` header comment refreshed).

Suggested order of value if time is short: **type scale + touch query → colour tokens → sticky action bar → Yes/No segmented buttons → section rail → the rest.** Those five remove most of the "busy and small" feeling.

---

### 10. Open questions for Michaela

1. **Record List on tablet:** may Claude Code make tap-target-only changes (row height, filter input size) there? (It is the front door.)
2. **Which tablet model(s), browser, and how is it held or mounted?** (Decides breakpoints and the test matrix.)
3. **Gloves or wet hands?** If yes, primary buttons go to 64px and the stepper becomes standard, not optional.
4. **Category colours:** collapse to one navy header plus chip (recommended), or keep up to six meaningful ones?
5. **Lighting:** any bright or glare-heavy areas? (Would justify a high-contrast mode later.)
6. **Left-handed operators:** need a left/right toggle for the hamburger and action bar?
7. **Language:** English only on the tablet, or do any operators need another language? (Affects label length and wrapping.)
8. **Do all operators use one shared tablet or personal ones?** Shared tablets should not carry over "last-used values" silently across operators.

---

### 11. Paste-ready prompts

#### For Claude Design
> Design the tablet record-entry experience for the Abagold Processing Department system. Use `claude/tablet-ui-optimisation-brief.md` Sections 2–6 as the requirements and the existing palette tokens (navy `#1B2330`/`#1D2B38`, cream `#F4F1E8`, ink `#1B2330`) as the base.
>
> Deliver, for **landscape (1180×820) and portrait (820×1180)**: (1) a repeating-row record (Mortalities Log), (2) a measurement-heavy single-submission record (Double Seam Inspection), (3) a monitoring-log record; (4) the hamburger menu open; and (5) a component sheet showing every field state (empty, filled, read-only/auto-filled, invalid, optional), the segmented Yes/No and Pass/Fail controls, status chips with icon+word, the sticky action bar, section rail, roster row with ✕, and the save-state chip in all five states.
>
> Rules: colour means state only; one action colour (`#96652B` on white, or propose an alternative with ≥4.5:1); one navy header for every record with a small category chip; no card-in-card; nothing under 14px; inputs 48px, Submit 56px, 8px minimum gaps; field borders ≥3:1 contrast; values at 18px, labels 15px. Show contrast values for every colour pairing. Do not change any field names, order or validation — this is a visual/layout change only. Keep everything print-safe; print layout is out of scope.

#### For Claude Code
> Implement the tablet UI optimisation in `claude/tablet-ui-optimisation-brief.md`, Sections 4, 5, 7 and 8, in the phases in Section 9. Start with Phase 2 only: create the token set inside `.rt-shell` scope in `public/styles/record-theme.css`, wire `form-record.js`, `monitoring-log.js` and `responsive.css` to it, and switch tablet sizing from width breakpoints to a coarse-pointer (touch) query. Do not add bare element selectors — `job-status.html` also loads `record-theme.css`. Do not change data, keys, validation, calculations, CSV, print output, routes, or any out-of-scope page. Verify on a throwaway test page, then on Mortalities Log only, and stop for review. Before deleting `--palette-*` or any `data-palette` block, list every file that uses it and wait for confirmation. Report against each numbered criterion in Section 8, including the script results for font size, tap-target size and contrast.

---

### 12. Related docs

- `claude/layout-redesign-instructions.md` — scope boundary and tokens (sidebar/tab bar part superseded by the hamburger menu).
- `claude/mobile-tablet-font-responsiveness.md` — the earlier type/tap-target work this brief builds on and re-keys.
- `claude/consolidated-plan.md` — system status and what not to redesign (database and storage are untouched by this brief).
- `claude/canning-report-design-improvements-brief.md`, `claude/job-details-modal-design-brief.md` — desktop-only briefs; they should reuse the colour tokens in Section 4 so the whole system shares one palette.

---

## Tablet UI Implementation Instructions (for Claude Code)

> **Source:** `claude/tablet-ui-implementation-instructions.md`

**Source of truth:** `claude/tablet-ui-optimisation-brief.md` (Sections 4, 5, 7, 8) and the visual reference `Dry Cooking Record.dc.html` (design project). This file is the ordered work list.

**Scope:** record-entry pages only (`form-record.js` `.fr-*`, `monitoring-log.js` `.ml-*`, bespoke 7.x pages). Do NOT touch Home, Trends, Job Status, Traceability, Submissions Log, FSMS, Handovers, Canning Report, login modal.

**Never change:** field names/order, validation, calculations, DB calls, storage keys, CSV/print output, routes. `@media print` rules stay exactly as they are.

**Guardrails**
- `job-status.html` also loads `record-theme.css`. Every new rule is nested under `.rt-shell` (or `.fr-app` / `.ml-app` inside the engines). No bare element selectors.
- Pilot first: Phase A on a throwaway test page, then `Mortalities Log` only. Stop for review before rolling out.
- Before deleting `--palette-*` or any `data-palette` block, list every file that uses it and wait for confirmation.

---

### Phase A — Tokens and type scale (one change, three consumers)

#### A1. Token set in `public/styles/record-theme.css`
Add inside the existing `:root` block (keep old `--rt-*` names as aliases so nothing breaks):

```css
--bg:#F4F1E8; --surface:#FFFFFF; --ink:#1B2330; --ink-2:#54606B;
--line:#E2E4E3; --field-line:#8A949C; --field-ro:#EEF1F0;
--chrome:#1B2330; --chrome-2:#1D2B38;
--action:#96652B; --action-press:#7C5222;
--ok:#15803D; --ok-tint:#E8F3EC;
--warn:#B45309; --warn-tint:#FBF0DC;
--fail:#A3352D; --fail-tint:#FBE8E6;
--info:#1D4ED8;
--fs-title:18px; --fs-section:18px; --fs-label:15px; --fs-value:18px;
--fs-hint:14px; --fs-btn:17px; --fs-table:16px; --fs-th:14px;
--tap:48px; --tap-primary:56px; --tap-row:40px; --gap-min:8px;
--field-border:1.5px solid var(--field-line); --field-radius:8px;
```
Alias: `--rt-gold` -> `var(--action)`, `--rt-gold-hover` -> `var(--action-press)`, `--rt-border` -> `var(--line)`. Do the same for `--palette-primary`, `--palette-primary-hover`, `--palette-primary-text` (set to `#fff`), `--palette-border`, `--palette-focus` (= `var(--action)`).

#### A2. Touch query instead of width
In `record-theme.css`, `responsive.css`, and the STYLE strings of `form-record.js` and `monitoring-log.js`:

- Wrap tablet sizing in `@media (pointer: coarse), (max-width: 1099px) { ... }`.
- Keep ONE narrow breakpoint: `@media (max-width: 700px)` = single column.
- Delete intermediate breakpoints (`1099`, `1024`, `900`, `800`, `768`, `699`, `560`, `480`) only after checking each rule is either folded into the two above or unneeded. List the removed ones in the report.
- Desktop mouse users keep the compact `rt-pc` density.

#### A3. Type scale (coarse pointer)
Replace hard-coded sizes in `.fr-*`, `.ml-*` and `responsive.css --form-fs-*`:

| Element | px | Weight |
|---|---|---|
| Top bar title | 18 | 700 |
| Section heading (`.fr-panel-head h2`, `.fr-section-title`) | 18, sentence case, no all-caps | 700 |
| Field label (`.fr-field`) | 15 | 600 |
| Input/select/textarea value | 18 | 500 |
| Hint / unit (`span.hint`, `.fr-upload-info`) | 14 | 400 |
| Buttons | 17 | 700 |
| Table body / roster inputs | 16 | 500 |
| Table th | 14 | 700 |

Remove every on-screen 10/10.5/11/11.5/12/12.5/13px declaration (badges, `.fr-btn-sm`, `.instr-item strong`, etc. -> 14px min). Print re-pins stay.

#### A4. Touch targets
- `input, select, textarea, .fr-btn, .ml-yesno button`: `min-height:48px`.
- Primary Submit: `min-height:56px`.
- Checkbox/radio: 28px box, whole label row 48px tappable.
- Row delete `✕` and in-table buttons: 40px.
- 8px minimum gap between neighbours; 16px between field groups; 24px between sections.
- Inputs inside `table.fr-table` get 16px font and `min-height:40px` (currently `min-height:0`).

#### A5. Field styling
```css
.fr-app input,.fr-app select,.fr-app textarea{border:var(--field-border);border-radius:var(--field-radius);font-size:var(--fs-value);min-height:var(--tap);padding:10px 12px}
.fr-app input:focus,.fr-app select:focus,.fr-app textarea:focus{outline:3px solid var(--action);outline-offset:1px}
.fr-app input[readonly],.fr-app input:disabled{background:var(--field-ro)}
.fr-field.invalid input{border-color:var(--fail)} /* message below in plain words */
```
Keep `.fr-provisional` but recolour to `--warn` / `--warn-tint`.

---

### Phase B — Colour restraint

1. Buttons: `.fr-btn-primary` = `background:var(--action); color:#fff`. Retire black-text-on-gold variant.
2. Retire purple card-accent stripe (`--rt-purple` usages). Grep `rt-purple|7C3AED|accent-stripe`.
3. Header colour: every record uses `--chrome-2` (navy). Add a category chip in the top bar (text + 10px dot in the old category colour, read from `palette-map.js`). List every file that sets `data-palette` / calls `palette-map.js` first, then wait for confirmation before removing the 20 `data-palette` blocks and `--palette-*` set (~line 856 of `record-theme.css`).
4. Status = colour + icon + word: `.fr-badge-ok` "✓ Pass", `.fr-badge-fail` "✕ Fail", warn "! Attention". Use the `--ok/--warn/--fail` tokens and tints; badge min font 14px.
5. Border colours: card/table dividers stay `--line`; anything that is an input boundary uses `--field-line`.

---

### Phase C — Structure (shared components in both engines)

Build once as small functions in `form-record.js` and reuse in `monitoring-log.js` (or extract to `lib/record-chrome.js` loaded by `record-shell.js`).

#### C1. One container level
Remove `.fr-panel` border+radius for form sections: page background -> flat white section (`background:var(--surface)`, hairline divider under heading) -> fields. Remove the per-row card border on `.fr-roster-row` (`border`, `padding`, `radius`) in the phone block.

#### C2. Collapsible sections, current one open
The engine already has `<details class="fr-section-collapsible">`. Change behaviour:
- First section with an incomplete required field is `open`; others closed.
- On completing a section (all required filled) show a green `✓` in its summary and open the next.
- Summary row: 48px tall, 18px title, `n of m fields done` in 14px `--ink-2`.
- Do not add JS state to storage; derive from current field values.

#### C3. Section rail (only when a record has >= 4 sections)
Sticky under the top bar (`top: var(--rt-topbar-h)`), horizontal scroll strip, one button per section (48px), tick when complete, tap = open that section and scroll to it with `element.scrollTop`-style offset (do NOT use `scrollIntoView`; use `window.scrollTo({top: el.getBoundingClientRect().top + scrollY - offset})`). Active section underlined with `--action`.

#### C4. Sticky bottom action bar
Fixed bottom bar: `Clear` (text button), `Save draft` (outline, 48px), `Submit` (filled `--action`, 56px, flex:1 max 320px). Add `padding-bottom: env(safe-area-inset-bottom)`. Add `padding-bottom: 96px` to `.fr-body` so content is never hidden. These call the SAME existing handlers as today's bottom buttons (move the existing DOM nodes or proxy clicks; do not duplicate logic). Hide the bar in `@media print`.

#### C5. Save-state chip in top bar
States: `Saved`, `Saving…`, `Draft saved HH:MM`, `Offline — will retry`, `Error — tap to retry`. Hook into the existing save/draft promise chain; no new storage. While saving, disable Submit and show state (prevents double submit).

#### C6. Server-wake message
If the first API call takes > 3s show banner: "Connecting to the server… this can take up to a minute after a quiet period" with an indeterminate progress bar. Clear on first response.

#### C7. Segmented controls
- `.ml-yesno` and any `select` with <= 4 options (Yes/No, Pass/Fail, shift) render as segmented buttons: min-height 48px, selected = filled + `✓`, unselected = white with `--field-line` border. Underlying `<select>`/value stays the source of truth (hide the select, set its value on click, dispatch `change`) so validation and storage are untouched.

#### C8. Hints behind ⓘ
Move `span.hint` under `.fr-field` into a 44px `ⓘ` button beside the label that toggles the hint text. Work-instruction panel button in top bar stays.

#### C9. Optional-field marking
Required is the default. Add "(optional)" suffix in `--ink-2` on optional labels; remove asterisk noise where the engine adds one.

#### C10. Roster / repeating rows
- Remove per-row card. Sticky table header on landscape.
- Add full-width 56px "+ Add row" under the last row; new row scrolls into view and focuses first input.
- Running count/total strip above the list.
- Row `✕` 40px with 12px gap; deleting shows an Undo toast (5s) instead of instant delete (keep existing delete handler; delay commit until toast expires, or restore from a held copy).

#### C11. Entries / Verification bars
Replace the panel cards with slim full-width bars ("Entries (12) ›", 56px) that open the existing content in a full-height sheet (reuse `.fr-modal-overlay`).

#### C12. Validation summary
Bottom bar shows "2 fields need attention" (tap = jump to first invalid). Inline message in plain words under the field. Reuse existing validation results; no rule changes.

---

### Phase D — Other rendering paths
1. `monitoring-log.js`: apply A–C (same tokens; `.ml-*` equivalents).
2. Bespoke 7.x pages (~28): adopt tokens via `record-theme.css` first (free), then shared components in batches of ~5.
3. Record List: tap-target-only change (row height 56px, filter input 48px) — only if approved.

---

### Acceptance (report each with script output)
1. No visible on-screen text < 14px (list offenders via `getComputedStyle` scan).
2. Every interactive element >= 48px (>= 40px for row ✕ / in-table), >= 8px gaps (bounding-box scan).
3. Text contrast >= 4.5:1; field borders and icon controls >= 3:1.
4. Hue budget: action + ok/warn/fail + info + neutrals only.
5. No nested card levels.
6. Submit visible without scrolling; section rail present at >= 4 sections.
7. Landscape (1180x820, 1366x1024) and portrait (820x1180) both receive tablet sizing.
8. Greyscale: pass/fail/read-only still distinguishable.
9. Print PDF of 3 records identical to before.
10. Submit same test data before/after on 3 records: stored values and CSV identical.
11. Floor test with 3 operators (Michaela).

### Pilot order
1. Throwaway test page with the tokens + one of each component.
2. Mortalities Log (`fr`).
3. One `ml` record, one bespoke record.
Stop and report after step 2.

### Order of value if time is short
type scale + touch query -> colour tokens -> sticky action bar -> segmented Yes/No -> section rail -> rest.

---

## Tablet UI v2 — as built

> **Source:** `claude/tablet-ui-v2-as-built.md`

Written 2026-09-30. Companion to `tablet-ui-implementation-instructions.md` (the plan). This file records what was actually built, where it lives, what was decided along the way, and what is still open.

**Status:** built and checked on the local copy only (a mouse browser at 820×1180). **Not deployed. Not tried on a real touch tablet. Print PDF not re-tested.** Deploy is held while REC 7.4.1 is unfinished (see the 7.4.1 memory note).

---

### 1. What changed, in one paragraph

Every in-scope record page (131) now opts in with `<body class="rt-tablet">`. That switches on one set of size/colour tokens in `record-theme.css` and a small script, `record-chrome.js`, that adds the shared tablet furniture: section blocks, section strip, slim header/footer, save indicator, submissions sheet, and so on. The two engines (`form-record.js`, `monitoring-log.js`) were **not edited** — their DOM is restyled and, in places, re-parented, never re-created, so every field, calculation, validation, storage key and CSV/print path is the engine's own.

### 2. Files

| File | Role |
|---|---|
| `public/styles/record-theme.css` | Tokens (`--fs-*`, `--tap`, colours) and all `body.rt-tablet …` rules. Tablet block starts at the comment `TABLET UI v2`. |
| `public/lib/record-chrome.js` | New. Everything JS-driven (section 4). Loaded early in each page, right after `<body>`. |
| `public/lib/record-shell.js` | Also sets `rt-tablet` and loads `record-chrome.js` as a fallback for any page that only loads the shell. |
| `public/lib/api-backend.js` | Red "not authorised" bar replaced by a small warning badge (section 6). Loaded by **all** pages, not just records. |
| `public/records/*.html` (131) | `class="rt-tablet"`, early `record-chrome.js`, cache-busted `record-theme.css`. `REC-7.1.6` was outside the shell before; now wired. |
| `public/pages/tablet-test.html` | Throwaway static test page. Safe to delete. |
| `claude/_backup/` | Pre-change copies of every file edited (`*.pre-…`), plus `records-pre-rollout/`. |

**Cache-busters at time of writing:** `record-theme.css?v=tv37`, `record-chrome.js?v=22`, `api-backend.js?v=18`. Bump these on every page after any change, or tablets keep the old copy.

### 3. One place to change sizes

Everything reads these tokens (top of the tablet block in `record-theme.css`):

| Token | px | Used for |
|---|---|---|
| `--fs-title` / `--fs-section` | 16 | top-bar title, section headings |
| `--fs-label` | 14 | field labels |
| `--fs-value` | 16 | input values |
| `--fs-hint` | 13 | hints, units, table headers, the minimum text size |
| `--fs-btn` | 15 | buttons |
| `--fs-table` / `--fs-th` | 14 / 13 | table body / headers |
| `--fs-display` | 20 | big numbers (totals, graded weight) |
| `--fs-icon` | 22 | back arrow |
| `--tap` / `--tap-row` | 48 / 40 | control height / in-table height |
| `--bar-btn-h` / `--rail-h` | 40 / 34 | header + footer buttons / section strip |
| `--fs-bar` / `--fs-bar-btn` / `--fs-bar-title` | 13 / 14 / 15 | header, strip and footer text |
| `--block-radius` | 18 | rounded corners on every white block |

Change a token → every record follows. Bin/pot/number-pad components, the totals tiles and the small-text floor read the same tokens.

**Known gap:** `form-record.js`, `monitoring-log.js`, `job-picker.js`, `signoff-block.js`, `entry-log.js` and `responsive.css` still contain their own hard-coded font sizes underneath. The tablet CSS overrides them and a script lifts anything below 13px, but the numbers were not removed from those files. A brand-new element added there would use its own size until a rule is added.

Sizing applies under one touch query: `@media (pointer: coarse), (max-width: 1099px)`. A mouse desktop wider than 1099px keeps the compact density, so 1180×820 on a mouse desktop does **not** show tablet sizing; a real tablet does.

### 4. Behaviour added by `record-chrome.js`

- **Section blocks.** Every section is its own rounded white block. form-record: title + content wrapped in `.rt-bubble` (nodes moved, not re-created). monitoring-log: one block per group/collapsible; a form with no groups, or a custom-body page, is one block. The sign-off block is its own block.
- **"Sign off".** The engines' "Completed by" section heading reads **Sign off** on screen. Field labels inside (Completed by, Title, Date, Signature) are unchanged, as are saved data and printed sheets. The submit-time message still says "Completed by".
- **Section strip** (under the header) on **every** record. Each section is a button with a tick when complete; tapping scrolls so the block's top edge lands just below the header and strip. Was "four or more sections" in the brief; changed to every record on request.
- **Progress + auto-collapse.** Collapsible sections show "n of m fields done" and a green ✓. A section that has just been completed folds away **once focus leaves it** (never while typing) and the next unfinished one opens. A folded plain section reopens by tapping its title. Sections already complete on load stay open. monitoring-log whole-block sections never fold. Print always shows everything.
- **Roster.** Full-width 56px "+ Add row" (new row scrolls into view and focuses); a row-count line; delete shows a 5-second **Undo** toast and only commits when it expires or the person taps something else. Pot/bin card rows keep the engine's own confirm dialog instead.
- **Save indicator** (top bar, driven by the engine's own toast messages): small green ✓ = ready/saved, red ⌛ = saving, "Draft saved HH:MM", "Offline — will retry", "Error — tap to retry", and a red ⚠ for no access key (section 6). Submit/Save are disabled while a save is in flight.
- **Server-wake banner** if the first API call takes more than 3 seconds.
- **Bottom action bar** (not sticky — it is the last thing in the page): `View submissions` far left | validation note | Clear | Save draft | **Submit and print** | Submit. Every button clicks the engine's own button, looked up at click time.
  - *Submit and print:* presses the engine's Submit, waits for its "submitted" message, then presses that entry's own Print button (newest new row, else the first row). A failed submit prints nothing and does not stay armed. Only the button pressing was tested, not a real printed sheet.
- **Submissions and Verification are off the record.** Both panels are hidden (kept in the DOM, so engine code still works). `View submissions` opens a full-height sheet with a day picker (Today / All days) that drives the engine's From/To filters; closing the sheet clears the filter. **Verification is meant to be done from the separate Awaiting Verification page** (`pages/awaiting-verification.html`, `submissions-log.html`) — confirm that covers every case before this reaches the floor. To bring the panels back: set `window.RT_KEEP_SUBMISSION_PANELS = true` or restore the `*.pre-subs-sheet` backups.
- **Validation note.** After a refused submit, the bar shows "1 field needs attention — tap to go to <field>", built from the engine's own message (first problem only, not a count).
- **Generic floor for self-styled pages.** Custom-body pages (e.g. 7.2.12) draw their own classes with 10–12px text; a class `rt-fs-floor` (screen only) lifts anything below the `--fs-hint` token, and controls get a 48px (40px in tables) minimum.

### 5. Header, strip, footer sizes

Top bar 48px, section strip 35px, footer about 51px (from about 76px each). Header/footer buttons are **40px** and the strip buttons **34px** — below the brief's 48px minimum, deliberately, on request. Form fields are still 48px. If the strip is fiddly on a real tablet, change `--rail-h` / `--bar-btn-h`.

### 6. No access key

When the server answers **401** (no or wrong key):
- The full-width red bar is gone on **every page** (`api-backend.js` change).
- **Record pages:** the top-bar indicator becomes a red ⚠ where the green tick was. Tapping it opens `/pages/api-key.html` (asks to confirm only if something has been typed).
- **All other pages:** a small red ⚠ circle link (`#api-auth-warning`, bottom-right) opens the same page.
- Both appear **only** in that situation and disappear again after the next successful API response. The amber "N records are waiting to sync" bar is a different bar and is untouched.

### 7. Decisions worth knowing about

- Pilot step skipped on request; rolled out to all 131 pages directly.
- `--ok` / `--warn` from the brief measure 4.41 / 4.45 on their own tints (just under 4.5:1); `--ok-ink` / `--warn-ink` added for text on those tints.
- Colour aliases (`--rt-gold` → `--action` etc.) live under `body.rt-tablet`, **not** `:root`, so `job-status.html` (which also loads `record-theme.css`) keeps its colours.
- `--fs-hint` was lowered to 13px, below the brief's 14px minimum, on request (font pass 1px, then more for 7.4.3.1).
- Footer no longer sticky ⇒ brief acceptance item 6 ("Submit visible without scrolling") no longer holds, by design.
- The brief's pilot note named `form-record`; Mortalities Log actually runs on `monitoring-log`.

### 8. Not done

- C8 ⓘ hints (would hide unit labels — units live in `span.hint`).
- C9 "(optional)" marking (monitoring-log does not mark required fields in the page).
- Full-height sheet for Entries beyond the new submissions sheet; sticky table header (the table wrapper scrolls, which breaks sticky).
- Removing the `data-palette` blocks and `--palette-*` set (needs a file list and confirmation first, per the brief).
- Deleting the old breakpoints inside the engine style strings, and the hard-coded sizes noted in section 3.
- Moving the colour aliases up to `:root` (waits on Job Status decision).
- Job search dropdown, browser `confirm()` boxes, real print output, and everything on a real touch tablet.
- 1-section pages show a one-button strip (could be hidden).

### 9. How it was checked

A throwaway script loaded each of the 131 pages in a sandboxed frame at 820×1180 and measured: page renders (no "could not load record"), shell + action bar present, no sideways scroll, no visible text under 13px, no size outside the scale, no control under its minimum height. Last full pass (before the header/footer slimming and the no-key change) was clean on all 131 pages. Pop-ups (hamburger menu, work-instruction bubble, Entries/Verification panels, job-confirm dialog, bin sheet) were opened and measured separately; the job-confirm dialog and bin sheet were off-scale and were fixed. The header/footer heights and the no-key badge were checked on a few pages only. Local API returns 401, so no real save or submit was ever performed.

### 10. Rollback

Restore from `claude/_backup/`: `record-theme.css.pre-*`, `record-chrome.js.pre-*`, `record-shell.js.pre-tablet-v2`, `api-backend.js.pre-warning-badge`, and `records-pre-rollout/` for the page edits. Or remove `class="rt-tablet"` from `<body>` on a page to switch it off (the tablet CSS is entirely gated on that class; only `api-backend.js` is global).

---

## Processing Department — Tablet Record-Entry Redesign Instructions for Claude Code

> **Source:** `claude/layout-redesign-instructions.md`

### Purpose
Redesign the **tablet record-completion experience only** — the individual record pages that
staff open from Record List to fill in and submit data on the processing floor. This is a
**layout/shell change limited to that one part of the system.** Do not change any data logic,
field names, database calls, calculations, or CSV/print export logic on any page.

**Everything else in the system is explicitly OUT OF SCOPE and must be left exactly as it is**,
because it continues to be used by admin and PC users on desktop screens: Home/Dashboard,
Record List (the index/finder page), Job Status Updates, Batch Traceability, Submissions &
Verifications Log, FSMS, and **Handovers** (explicitly confirmed: leave Handovers alone). Do not
add a sidebar, restyle, or otherwise touch any of these pages. Their headers, tables, and layouts
stay pixel-identical to today.

---

### 1. Scope — confirmed boundary (2026-09-09)

**IN SCOPE (gets the tablet redesign):**
- The individual record pages reached by opening an entry from **Record List**
  (`records/record-list.html` → clicking a row opens e.g.
  `records/Mortalities-Log-mortalities-log.html`). This is the "New Entry" form + Entries panel +
  Verification panel pattern confirmed live on the Mortalities Log page, and applies to all
  ~130 records listed there.

**OUT OF SCOPE (leave exactly as-is, no shell, no restyling):**
- Home page / Dashboard (`index.html`, `pages/dashboard.html`) — KPI tiles, Harvest by stream,
  Categories table, the **Trends dashboard** (`pages/dashboard.html` → "Trends"), all stay as
  today.
- **Record List index page itself** (`records/record-list.html`) — the filter box + 130-row table
  stays exactly as today. (Only the pages it links *to* are in scope — not the finder page.)
- Job Status Updates
- Batch Traceability
- Submissions & Verifications Log
- FSMS
- **Handovers** — explicitly confirmed out of scope, leave alone even though it's a data-entry
  flow, because it is used differently from the Record List forms.
- Login modal — no longer in scope for this pass (superseded by the scope narrowing below;
  revisit only if Michaela asks for it separately).

**Needs clarification before Claude Code builds — do not guess:**
- **Quick Abalone Receiving**: is this one of the ~130 records reachable from Record List (→ in
  scope), or is it a separate top-level flow like Handovers (→ possibly out of scope, same as
  Handovers)? Confirm which before applying the redesign to it.
- If any of the 130 Record List entries are themselves things like "Job Status" sub-records or
  traceability-linked forms that overlap with the out-of-scope pages above, flag those specific
  cases back to Michaela rather than assuming they're in scope.

**Shell scope:** The new sidebar/topbar shell from the design artboards appears **only on the
in-scope record pages**. It must not be added to any out-of-scope page. Out-of-scope pages keep
their current header/navigation entirely untouched.

---

### 2. Current state of in-scope pages (confirmed live, e.g. Mortalities Log)

Dark bar header (doc code + title + rev) → **"New Entry" white panel** with a 2-column field grid
(label above input, plain bordered inputs) → Clear / Save draft / Submit buttons (gold Submit) →
collapsed "Entries" panel with a "View entries" toggle → collapsed "Verification" panel with a
"View verification" toggle. No sidebar. No stat tiles. No status dots. No card styling.

Some records (e.g. REC 7.2.12 Double Seam Inspection Report) also carry a **per-record "Trend"
link** next to their "Manage specs" control, and a "Header" sub-section inside the New Entry form
carrying that record's own job/batch identification fields (job no., AG code, date, etc.). See
Section 9 for the redesign treatment of both.

### 3. Target state for in-scope record pages (from the approved design canvas)

Reference: `Abagold Processing UI.dc.html` (OneDrive: `20. Paperless/Abagold Processing Interface
Design/`), specifically **artboard 5 (Data Entry Form)** as the primary pattern, with artboard 4
(Report Detail) elements borrowed for the read-only Verification panel if useful.

- **Persistent left sidebar** (200px, dark `#1d2b38`) with the 8 category items, present only on
  these in-scope pages, collapsing to a bottom tab bar below ~800px viewport width (provisional
  breakpoint — tune once actual tablet model is confirmed).
- **Top bar**: doc code + title + rev (as today) restyled into the navy `#1b2330` bar, plus
  Refresh/CSV/Print-style action buttons if the record has export/print functions already. The
  top bar carries only document identity (doc code, title, rev, rev date) — it must never
  duplicate the record's own job/batch fields (see Job header info block below and Section 9).
- **Job header info block**: this is the record's *own* job/batch identification fields — e.g. on
  REC 7.2.12 that's job no., AG code, date, can size, date produced, Fujian batch codes,
  micrometer serial/verification — laid out as a proper labelled field grid (label above input,
  consistent column widths, no run-on wrapping of label text into the next field) inside a white
  card with a colored left border. This block is **the single source of job/batch identity for
  that record** — do not add a second, separate "record id / date-time / logged-by" summary card
  that repeats the same information in a different shape. If a record's current "Header" or
  equivalent section already has these fields, restyle that section into this pattern rather than
  building a second one alongside it.
- **Repeating-row records** (auto-classified — see Section 5): the current field-grid "New Entry"
  form is replaced by an **inline add-row bar** (ID input / notes input / value input / gold "Add"
  button, all ≥44px tall) plus a **running-tally stat row** (count / total / average tiles) above
  the entries list. Entries render as a table with a small "✕" remove button per row (≥36px tap
  target).
- **Single-submission records**: keep the current field-grid form layout exactly as it is
  (same fields, same order, same validation) — only the surrounding shell (sidebar, top bar,
  card container, button styling, spacing) changes, matching the design tokens. This includes
  measurement-heavy forms like REC 7.2.12 (see Section 9) — the measurement tables keep their
  fields/columns/validation, only the visual layout and grouping are cleaned up.
- **Verification panel**: stays functionally the same (toggle to view), restyled as a card
  consistent with the new shell.
- Clear / Save draft / Submit → restyle as `.btn--outline` / `.btn--outline` / `.btn--primary`
  (gold fill) using the shared tokens below, no functional change.
- **No per-record trend/analytics controls.** Any "Trend" link, button, or chart embedded on an
  individual record page is removed as part of this redesign (see Section 9) — trend viewing for
  all records lives exclusively in the Dashboard → Trends page (`pages/dashboard.html`), which is
  out of scope and already exists.

#### Shared design tokens (confirmed against the live brand palette)
```
--navy-primary:   #1B2330   (top bar, active sidebar state)
--navy-secondary: #1D2B38   (sidebar background)
--slate:          #5C6771   (secondary text, inactive nav)
--border:         #E2E4E3   (dividers, table borders)
--bg:             #F4F1E8   (page background, zebra stripe)
--gold:           #A9763A   (primary action buttons, active accents, brand)
--green:          #15803D   (success/active/on-target status)
--purple:         #7C3AED   (category/tag accent)
--blue:           #1D4ED8   (info/links)
--white:          #FFFFFF
font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
min tap target: 44px (36px acceptable only for small inline icon buttons like row-delete)
```

---

### 4. What changes and what does NOT change

**Changes (visual shell, in-scope record pages only):**
- Add the sidebar + navy top bar shell to in-scope record pages only.
- Restyle the "New Entry" panel per the repeating-row vs. single-submission classification below.
- Restyle each record's own job/batch "Header" fields into the shared labelled-grid pattern
  (Section 3) — fixing cramped/overlapping label-input layout — without removing or duplicating
  any of those fields.
- Remove any per-record "Trend" link/control (Section 9) — trend viewing only happens on the
  Dashboard → Trends page.
- Restyle Clear/Save draft/Submit buttons to the token button styles.
- Restyle the Entries/Verification toggle panels as cards consistent with the new shell.
- Add status dots/colors where a status concept already exists in that record's data.

**Does NOT change, anywhere in the system:**
- No new fields, no new database columns, no new record types.
- No change to what data is calculated, submitted, validated, or exported.
- No change to record file names, routes, or the record-key → source-table mapping.
- No change to CSV export content/column order — visual button style only, and only on in-scope
  pages.
- **No change whatsoever** to Home/Dashboard (including the Trends page), Record List index, Job
  Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, or the
  login modal.

---

### 5. Record classification rule (auto-detect, confirmed)

Any in-scope record whose current page has an "Entries" panel expecting **more than one row per
period** (a repeating log, e.g. Mortalities Log) gets the inline-add-row + running-tally pattern.
Any in-scope record that is a **single-submission form** (one set of fields, submit once per
period) keeps its current field-grid layout, only gaining the new shell, spacing, and button
styling.

Claude Code must output the classification list (which of the ~130 in-scope records fall into
each bucket) before batch-applying, so Michaela can spot-check it.

---

### 6. Build order

1. **Confirm scope edge cases first**: get Michaela's answer on whether Quick Abalone Receiving is
   in scope, and flag any Record List entries that overlap with out-of-scope pages (Job Status,
   Traceability, etc.) before writing any code.
2. **Design tokens + shared shell components**, isolated to a new/extended CSS file (e.g.
   `record-theme.css`), built and visually verified on one throwaway test page before touching a
   real record page. Do not let this CSS leak into out-of-scope pages' existing stylesheets.
3. **One representative repeating-row record** (e.g. Mortalities Log) — rebuild fully to the
   target pattern. Review with Michaela.
4. **One representative single-submission record** — shell + spacing only. Review with Michaela.
   (REC 7.2.12 is a good second single-submission example to check against, since it also
   exercises the job-header-field-grid fix and the Trend-removal rule — see Section 9.)
5. **Batch-apply** the approved patterns to the rest of the in-scope records, grouped by
   classification bucket. As part of batch-apply, scan every in-scope record for any per-record
   "Trend" link/control and remove it (Section 9) — REC 7.2.12 is confirmed to have one; check
   the rest rather than assuming it's the only one.
6. **Responsive check**: verify the sidebar → bottom-tab-bar collapse at ~800px on a resized
   browser window or actual tablet.
7. **Regression check**: confirm every out-of-scope page (Home, Dashboard/Trends, Record List
   index, Job Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS,
   Handovers, login modal) is visually unchanged — diff before/after screenshots if possible.
8. **Final pass** on the in-scope pages only: consistent status-dot coloring, button styling,
   spacing. Cross-check nothing in CSV export / data submission changed.

---

### 7. Instruction to give Claude Code (ready to paste as the task prompt)

> Redesign only the individual record-entry pages reached from Record List (the "New Entry" +
> Entries + Verification pattern seen on pages like Mortalities Log), using the design reference
> `Abagold Processing UI.dc.html` (artboard 5, Data Entry Form, as the primary pattern) and the
> token palette in Section 3 of this document.
>
> **Do not touch any other page in the system.** Home/Dashboard (including the Trends page), the
> Record List index page itself, Job Status Updates, Batch Traceability, Submissions &
> Verifications Log, FSMS, Handovers, and the login modal must remain pixel-identical to their
> current state — no sidebar, no restyling, no shared CSS bleed. This is a visual/layout-only
> change on the in-scope pages — do not alter any database calls, field names, calculations,
> validation, or CSV/print export content anywhere.
>
> Before writing code: confirm with Michaela whether Quick Abalone Receiving is in scope (reached
> via Record List) or out of scope (separate flow like Handovers), and flag any Record List entry
> that overlaps with an out-of-scope page.
>
> Each record's own job/batch identification fields (its "Header" section — job no., date, batch
> codes, etc.) stay on that record's page and get restyled into a clean labelled field grid; do
> not remove them and do not add a second, separate summary card that duplicates the same fields
> in another shape. Remove any per-record "Trend" link or embedded trend control you find (REC
> 7.2.12 has one, confirmed) — all trend viewing lives exclusively on the Dashboard → Trends page,
> which you must not modify.
>
> Follow the build order in Section 6, stopping after step 4 for review before batch-applying to
> the rest of the in-scope records. Classify every in-scope record as repeating-row or
> single-submission per Section 5's rule, and list the classification for review before batch
> application.
>
> Create/extend a shared theme CSS file scoped to the in-scope record pages only — do not import
> or apply it to any out-of-scope page's stylesheet. Confirm before deleting or renaming any
> existing CSS file or class currently in use.

---

### 8. Files referenced
- Design source: `OneDrive - Abagold/20. Paperless/Abagold Processing Interface Design/Abagold Processing UI.dc.html`
- Live system: https://processing-department.onrender.com/ (password-gated; role-based login)
- Related project doc: `claude/drying-report-spec.md` (drying-report.html build spec — if/when
  that page is built, it is itself a Record List entry, so it should follow whichever pattern
  this redesign settles on for its record type)

---

### 9. REC 7.2.12 Double Seam Inspection Report — review feedback (2026-09-09)

Michaela reviewed the live page at
`records/REC-7.2.12-double-seam-inspection-report.html` and flagged four issues. This section
records what was found on the page and the resulting instruction, as a worked example of Section
3's rules for measurement-heavy single-submission records.

**What's on the page today:**
- Top navy bar: doc code (`REC 7.2.12`), title (`Double Seam Inspection Report`), rev (`Rev 11`),
  rev date. Identity only — no job/batch fields here, so there is no overlap to remove at the top
  bar level.
- A "Header" sub-section inside the New Entry form containing this record's own job/batch fields:
  Job no., AG Code, Date, Can size, Date produced, Fujian batch code (cans), Fujian batch code
  (can ends), Micrometer serial number, Micrometer verified (+/-0.02mm) with two tolerance-check
  sub-fields. These labels currently run directly into the next field with no consistent grid —
  e.g. "Date" and "Can size" appear to share a line and wrap unpredictably, and "Fujian batch code
  (can ends)" wraps mid-label before its input box.
- A "Spec profile" selector, "Manage specs" button, and a **"Trend" link** sitting next to it.
- The measurement tables themselves (Can 1 / Can 2, each with Overlap OK, Vacuum kPa, and an
  11-row Measurement × Point 1/2/3 grid), Comments, and Completed by/Title/Date/Signature — dense
  but functionally fine; these just need the shared card/spacing treatment, not a field redesign.
- Confirmed live: Dashboard → Trends (`pages/dashboard.html`) already exists as a separate page
  and is described as covering exactly this kind of trending (it lists chiller/wet storage temps,
  pH, salinity, dry room conditions, canned product pH/salt/brix/vacuum/drained mass, QC issues
  per month, allergen/EMP swabs). This is the intended single home for all trend views.

**Feedback → instruction:**

1. *"The job entry info needs to be here"* — Confirmed: REC 7.2.12's Header fields (job no., AG
   code, date, batch codes, micrometer info) are that record's own data-entry fields, not
   duplicated administrative chrome, so they stay on the page exactly as they are today (same
   fields, same validation) per Section 3/4. Nothing here is removed.
2. *"The header info that overlaps with job entry info can be removed"* — On REC 7.2.12
   specifically, the top navy bar carries no job/batch fields, so there is nothing to remove there
   today. Read as a general rule for the redesign (Section 3): if the new shell's top bar or any
   added summary card ever ends up showing job no. / date / batch identifiers that duplicate the
   record's own Header fields, that duplicate copy is what gets removed — the record's own Header
   section remains the single source. Apply this check on every record during batch-apply, not
   just REC 7.2.12.
3. *"The header fields are not well laid out"* — Rebuild the Header sub-section as a proper
   labelled field grid per Section 3 (label above input, fixed column widths, consistent gap,
   no label text running into the next field or wrapping mid-phrase). Suggested grouping so
   related fields sit together: row 1 — Job no. / AG Code / Date; row 2 — Can size / Date
   produced; row 3 — Fujian batch code (cans) / Fujian batch code (can ends); row 4 — Micrometer
   serial number / Micrometer verified + its two tolerance sub-fields. Exact column count should
   match whatever the shared record-theme grid uses elsewhere — the point is consistency and no
   run-on wrapping, not this specific grouping.
4. *"The trend tab must be removed, trends should be seen only from index home page after login
   on trend dashboard"* — Remove the "Trend" link from REC 7.2.12's New Entry panel entirely (and
   from any other in-scope record found to have the same control during batch-apply). Do not
   replace it with anything on the record page. All trend viewing continues to live only at
   Dashboard → Trends, which is out of scope and must not be touched by this redesign.
5. *"Document not well laid out"* (general) — Apply the standard shell/card treatment from
   Section 3 to the rest of the page: New Entry panel as a card, Spec profile/Manage specs as a
   small toolbar row (with Trend removed per point 4), the Can 1/Can 2 measurement tables and
   Comments/Completed-by block each as their own clearly separated card with consistent spacing —
   without changing which fields exist, their order, validation, or what gets calculated/exported.

---

## Record Pages — Field Alignment & Layout Fix (Instructions for Claude Code)

> **Source:** `claude/record-page-field-alignment-fix-instructions.md`

**Date:** 2026-09-25
**Raised by:** Michaela — "layout of UI pages is scrambled, fields are not in line in rows"
**Type:** CSS / layout-only fix. **No change** to fields, field names, order, validation, calculations, DB calls, CSV/print output.
**Related docs:** `claude/layout-redesign-instructions.md` (the 2026-09-09 tablet shell brief), `claude/repo/mobile-tablet-font-responsiveness.md` (2026-09-07 font/tap-target work).

---

### 1. What is wrong (confirmed on the live site, 1280px desktop, 2026-09-25)

| # | Symptom | Where seen | Root cause |
|---|---|---|---|
| A | **Whole page scrambled** — stage tabs, can tabs, measurement table, Comments and Completed-by sit side by side as tall skinny 258px columns | REC 7.2.12 Double Seam Inspection Report | `record-theme.css` forces `.rt-content .ml-grid-2 { grid-template-columns: repeat(auto-fit, minmax(220px,1fr)) }`. The engine's entry container `#ml_p_modalFields` carries `ml-grid ml-grid-2`, and REC 7.2.12 uses a **custom body renderer** (`customBody.render`) that fills that container with full-width blocks (toolbar, tabs, panels). Each block became one grid cell. |
| B | **Columns don't line up between sections** — Job info has 5–6 columns, the roster has 8, Sign-off has 3 narrow fields, Completed-by has 4 wide fields; none share column edges | REC 7.1.3, 7.1.5, 7.8.1 and most engine records | Every grid uses `auto-fit` / `auto-fill` with `minmax(...)`, so the column count depends on how many fields a section has and how wide the screen is. There is no shared column system. |
| C | **Inputs in the same row sit at different heights** | Job no. (the "Change" link sits between label and input), fields with a hint line e.g. "Chiller temp (°C)", two-line labels e.g. "Size-range whole weight (kg)" | Field = label → (extra line) → input, stacked top-down, grid `align-items` is stretch/start. Anything extra above an input pushes only that input down. |
| D | **Job info fields stacked one per full-width row** on some records while the next section is 6-across | REC 7.8.1 Chiller Batch Control | That section's fields aren't inside a grid wrapper (or the wrapper has no column rule), so each field is a full-width block. |
| E | **Two input sizes on one form** — header inputs 54px tall/16px bold, roster inputs ~30px/13px | All engine records with rosters | `.rt-content .fr-field input {min-height:54px}` vs `.rt-content .fr-roster-row input {min-height:0; padding:6px 8px}` |
| F | Minor: "Spec profile" label wraps to two lines; **Trend link still on REC 7.2.12** (should have been removed per 09-09 brief §9); Completed-by inputs squashed | REC 7.2.12 | Inline `flex-direction:row` on the label; brief not fully applied |
| G | Minor: sidebar nav text is hard to read | All shell pages | `--rt-slate #5C6771` on `#1D2B38` ≈ 2.4:1 contrast (needs ≥4.5:1) |
| H | Inconsistent section headings — "JOB INFO" is a styled header with caret, "SIGN-OFF" / "COMPLETED BY" are tiny grey text | Engine records | Three different heading classes (`fr-section-title`, `ml-grouphead`, sign-off sub-label) styled differently |

**Automated scan (not logged in, default/collapsed state, so treat as a minimum):** 42 of 131 Record List pages had at least one row with misaligned inputs or mixed input heights: Live Leftovers Log, Mortalities Log, QA-01, REC-1, 7.2, 7.2.4, 7.2.10, 7.2.12, 7.2.13, 7.4.1, 7.4.2, 7.4.3.1, 7.4.3.2, 7.4.5, 7.4.6, 7.4.7, 7.5.1, 7.5.2, 7.6.2.2, 7.6.5, 7.6.6, 7.6.7, 7.6.7-a, 7.6.8, 7.6.8-a, 7.7.1, 7.7.4, 7.7.5, 7.7.6, 7.8.1 (canning + dry), 7.8.3, 7.8.7, 7.8.8, 7.8.9, 7.9.1, 7.9.2, 7.9.3.1, 7.9.3.2, 7.10.2, 7.10.3, 7.10.4, 8.1.1. REC 7.1.3 / 7.1.5 were missed by the scan but visibly have problem C (Job no.).

---

### 2. The rule to build to — one column system for every record form

Every field grid inside `.rt-content` uses the **same fixed column tracks**, so field edges line up down the whole page.

| Content width | Form field grids (job info, sign-off, completed-by, verification, general fields) | Roster rows (repeating batches) |
|---|---|---|
| ≥ 1100px (PC) | **4 equal columns** | **8 equal columns** (each = half a form column, so edges still line up) |
| 700–1099px (tablet landscape/portrait) | **2 columns** | **4 columns** |
| < 700px (phone) | **1 column** | **1 column** (stacked card, as today) |

Additional rules:

1. **Tracks are fixed, not auto-fit.** Use `repeat(N, minmax(0, 1fr))`. A section with 3 fields leaves the 4th column empty — that is correct; it keeps edges aligned with the sections above and below.
2. **Wide fields span the full row**: textareas (Comments, Process deviation, Corrective action), any `.fr-field.wide` / `.ml-field.wide`, custom blocks (tables, tab strips, panels, toolbars).
3. **Inputs bottom-align in every row.** Each field is a flex column with `justify-content: flex-end`; each grid has `align-items: end`. Labels can wrap to two lines; the input still sits on the shared baseline.
4. **Nothing sits between a label and its input.** Helper links ("Change" on Job no.) move onto the label line, right-aligned. Hints ("°C", "tol ±0.02mm", "record only") go *below* the input in small text, or in brackets at the end of the label.
5. **One input height per density mode**:
   - Tablet/floor default: **48px** tall, 16px text — header fields AND roster fields.
   - PC mode (`body.rt-pc`): **36px**, 14px — both.
   - Only inputs **inside real `<table>` cells** (measurement tables, entries tables) stay compact (32px).
6. **One section-heading style** for all sub-sections (Job info, Salting batches, Sign-off, Completed by, Verification): 12px, bold, uppercase, slate, bottom border, 16px space above. Collapsible ones add the gold caret.

---

### 3. Changes, file by file

#### 3.1 `public/styles/record-theme.css` (ENGINE RESKIN block — everything stays under `.rt-content`)

1. **Replace** the current field-grid rule (the one listing `.rt-content .fr-grid … .ml-grid-4` with `repeat(auto-fit, minmax(220px,1fr))`) with a fixed-track rule:
   - `.rt-content .fr-grid, .ml-grid, .fr-grid-2/3/4, .ml-grid-2/3/4` → `display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px 18px; align-items: end;`
   - Use a CSS custom property `--rt-form-cols` (4 / 2 / 1 at the breakpoints in §2) so there is one place to change it.
2. **Custom-body container must not be a grid.** Add a rule that neutralises the grid when a record draws its own body:
   - `.rt-content .ml-grid.ml-custom-body, .rt-content .fr-grid.fr-custom-body { display:block; }` (class added by the engine — see 3.3), **and** as a belt-and-braces fallback:
   - `.rt-content .ml-grid > :not(.ml-field):not(.fr-field)`, `.rt-content .fr-grid > :not(.fr-field):not(.ml-field)` → `grid-column: 1 / -1;` (any non-field child — toolbar, tabs, panel, table wrapper, details — spans the full row).
3. **Field alignment**: `.rt-content .fr-field, .ml-field, .cr-field` → `display:flex; flex-direction:column; justify-content:flex-end; min-width:0;`. Make textareas and `.wide` fields `grid-column: 1 / -1`.
4. **Roster rows**: change `.rt-content .fr-roster-row` from `repeat(auto-fill, minmax(170px,1fr))` to `repeat(var(--rt-roster-cols, 8), minmax(0,1fr))` with `align-items:end`; `--rt-roster-cols` = 8 / 4 / 1 at the §2 breakpoints. Keep the remove (✕) button on its own line, right-aligned, as today.
5. **Input sizes**: set header inputs to `min-height:48px; padding:12px 14px; font-size:16px` (was 54px / 15px 16px). Change the roster override (`.rt-content .fr-roster-row input/select`) to the **same** 48px / 16px — remove `min-height:0; padding:6px 8px; font-size:13px` for roster rows. Keep the compact override only for `.rt-content table input/select/textarea`.
6. **PC mode** (`body.rt-pc` block): update its grid rule to `repeat(4, minmax(0,1fr))` (not auto-fill 200px) and make roster inputs the same 36px as header inputs. Leave the existing "roster as a table" behaviour otherwise untouched.
7. **Section headings**: add the sign-off / completed-by sub-heading class the engines emit (check the actual class in `signoff-block.js` — likely a small label div above `completedByHtml` / `verifyFieldsHtml`) to the existing `.fr-grouphead, .ml-grouphead …` heading rule so all section headings look the same.
8. **Sidebar contrast**: change `.rt-sidebar a` colour from `var(--rt-slate)` to `#B9C3CC` (the existing `--palette-dark-muted` value; ≈ 8:1 on the sidebar). Active/hover stay white.
9. Delete the now-redundant `@media (max-width:560px)` grid override inside this block once the custom-property breakpoints cover it (keep the roster remove-button full-width rule).

#### 3.2 Engine `<style>` blocks — `public/lib/monitoring-log.js` and `public/lib/form-record.js`

- Their own `.ml-grid-2/3/4` and `.fr-grid-2/3/4` column rules and `@media (max-width:900px)` collapse rules are fine for **non-shell** rendering; leave them, because the `.rt-content` rules in record-theme.css override them inside the shell.
- Add `.ml-field.wide` (mirror of the existing `.fr-field.wide { grid-column:1/-1 }`) if it doesn't already exist.

#### 3.3 Engine JS — custom body flag (`monitoring-log.js`, and `form-record.js` if it has the same hook)

- In `openForm` where `if (customBody) { container.innerHTML = ''; … customBody.render(container, …) }` runs (monitoring-log.js ~line 1087), add `container.classList.add('ml-custom-body')` before `render`, and `container.classList.remove('ml-custom-body')` in the non-custom branch (the same container is reused).
- No other logic change.

#### 3.4 Job-number picker ("Change" link) — find where the job-no field is built (`public/lib/job-picker.js` and/or the `fr-jobnumber` builder in form-record.js)

- Move the "Change" link out of the space between the label and the input: render it **inside the label line**, right-aligned (label becomes `display:flex; justify-content:space-between`). The input then sits on the row baseline like its neighbours.
- Do not change what the link does.

#### 3.5 Hints / units under labels

- Where an engine field definition has a `hint` (e.g. Chiller temp "(°C)"), render the hint **after** the input (small, 12px, slate) instead of between label and input. If moving it is risky in one engine, append it to the label text in brackets instead — either way nothing sits between label and input.

#### 3.6 Sections without a grid wrapper (problem D)

- Find why REC 7.8.1's Job info fields render one per full-width row (fields not wrapped in `fr-grid`/`ml-grid`, or the collapsible section body lacks the class). Wrap them in the standard grid so they follow the 4/2/1 rule. Check every record whose Job info section is collapsible — the same builder is probably shared.

#### 3.7 REC 7.2.12 Double Seam (`public/records/REC-7.2.12-double-seam-inspection-report.html`) — layout only

1. After 3.1/3.3 the page stacks vertically again. Then:
2. **Remove the Trend link** (`<a class="ds-btn-flat" href="double-seam-trend.html">Trend</a>`, ~line 417) — outstanding from the 09-09 brief §9. Do not delete `double-seam-trend.html` itself without asking Michaela.
3. Spec profile label: drop the inline `flex-direction:row` so it is a normal label-above-select field; toolbar becomes one row: [Spec profile ▾] [Manage specs] [spec-breach status].
4. `.ds-grid` (header fields and Completed-by): make it follow the same 4-column fixed-track rule (`repeat(4, minmax(0,1fr))`, 2 / 1 at the breakpoints, `align-items:end`). Header grouping from the 09-09 brief: row 1 Job no. / AG code / Date / Can size; row 2 Date produced / Fujian batch (cans) / Fujian batch (can ends); row 3 Micrometer serial / Micrometer verified / 1.21mm reading / 3.00mm reading.
5. Stage tabs + Can tabs: one horizontal row of tabs each (natural height, not stretched), then the measurement panel full width, then Comments full width, then Completed by full width.

#### 3.8 Pages that don't use the shell yet

- The scan suggests a number of records from REC 7.4.9 onward may still render without the `.rt-shell` (results were timing-sensitive, so **verify logged in**). Do **not** batch-apply the shell to them in this task. Just list, in the work log, which Record List pages have no `.rt-content` so Michaela can decide on a follow-up. The alignment rules in this doc only apply inside `.rt-content`.

---

### 4. Do NOT change

- No field added, removed, renamed or re-ordered. No change to validation, calculations, `values` keys, DB writes, CSV/JSON export columns, print sheet (`.fr-sheet` / `.ml-sheet`) or `@media print` rules.
- Out-of-scope pages from the 09-09 brief stay pixel-identical: Home, Dashboard/Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, login modal. `job-status.html` also loads record-theme.css — that is why every new rule must stay under `.rt-content` / `.rt-shell`.
- `public/styles/responsive.css` — leave as is unless a rule is proven to fight the new grid (if so, scope the fix, note it in the work log).

---

### 5. Build order

1. Branch: `fix/record-field-alignment`.
2. Before touching code: screenshot REC 7.2.12, 7.1.3, 7.1.5, 7.8.1, Mortalities Log, one PC-mode record (`body.rt-pc`, e.g. an NRCS pack page) at **1280px, 1024px, 768px, 390px**, logged in, all collapsible sections open. Save to `Claude outputs/alignment-before/`.
3. Do 3.1 + 3.3 (grid system + custom-body fix). Re-screenshot REC 7.2.12 and 7.1.3 — **stop and show Michaela.**
4. Do 3.4, 3.5, 3.6 (Change link, hints, missing grid wrappers).
5. Do 3.7 (REC 7.2.12 clean-up) and 3.1 items 5–8 (input size, headings, sidebar contrast).
6. Run the alignment check (§6) on all 131 Record List pages; fix what it flags.
7. Regression screenshots of every out-of-scope page — must be unchanged.
8. Print-preview 3 records (REC 7.2.12, 7.1.3, one monitoring log) — must match the pre-change PDF.
9. Write `claude/record-field-alignment-worklog.md` (what changed, before/after screenshots, pages still without the shell).

---

### 6. Acceptance checks

**Visual (Michaela signs off):**
- [ ] REC 7.2.12 reads top-to-bottom: toolbar → job & equipment info → stage tabs → can tabs → measurement table → comments → completed by. No side-by-side skinny columns.
- [ ] On any record at 1280px, the left edges of fields in Job info, the roster, Sign-off and Completed-by line up on the same 4 (or 8) column lines.
- [ ] In every row, all input boxes sit at the same height and are the same size (Job no. included).
- [ ] Tablet 768–1024px: 2 fields per row, roster 4 per row, nothing overlaps. Phone 390px: 1 per row, no sideways page scroll.
- [ ] All section headings look the same.
- [ ] Sidebar nav text is readable.
- [ ] Trend link gone from REC 7.2.12.
- [ ] Printed PDFs unchanged.

**Automated alignment check** — run in the browser console on each record page (logged in, sections expanded). It must return `[]` on every page:

```js
(() => {
  const bad = [];
  document.querySelectorAll('.rt-content *').forEach(g => {
    if (getComputedStyle(g).display !== 'grid' || g.closest('table')) return;
    const rows = {};
    [...g.children].filter(c => c.offsetParent).forEach(c => {
      const t = Math.round(c.getBoundingClientRect().top);
      (rows[t] = rows[t] || []).push(c);
    });
    Object.values(rows).forEach(cells => {
      const inputs = cells.map(c => c.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select'))
                          .filter(i => i && i.offsetParent);
      if (inputs.length < 2) return;
      const bottoms = inputs.map(i => Math.round(i.getBoundingClientRect().bottom));
      const heights = inputs.map(i => Math.round(i.getBoundingClientRect().height));
      if (Math.max(...bottoms) - Math.min(...bottoms) > 3 || Math.max(...heights) - Math.min(...heights) > 3)
        bad.push((g.id || g.className) + ' bottoms=' + bottoms.join(',') + ' heights=' + heights.join(','));
    });
    // full-width blocks squeezed into a grid column
    [...g.children].forEach(c => {
      if (c.querySelector('table, .ds-panel, .ml-panel, .fr-panel') && c.getBoundingClientRect().width < g.getBoundingClientRect().width * 0.9)
        bad.push('block-in-grid: ' + (g.id || g.className));
    });
  });
  return bad;
})();
```

Claude Code can loop this over all Record List links with Playwright (Chromium is pre-installed) at 1280 / 1024 / 768 / 390 widths and put the pass/fail table in the work log.

---

### 7. Paste-ready prompt for Claude Code

> Read `claude/record-page-field-alignment-fix-instructions.md` and follow it exactly. This is a CSS/layout-only fix for record-entry pages inside `.rt-content`: introduce one fixed column system (form grids 4/2/1, roster rows 8/4/1), bottom-align inputs in every row, one input height per density mode, stop the monitoring-log custom-body container from being a grid (REC 7.2.12 is currently scrambled because of it), move the Job no. "Change" link and field hints out from between label and input, wrap unwrapped Job info sections in the standard grid, unify section headings, raise sidebar text contrast, and remove the Trend link from REC 7.2.12. Do not change any field, validation, calculation, DB call, export or print output, and do not touch the out-of-scope pages listed in §4. Take the §5 step-2 before screenshots first, stop after step 3 to show me REC 7.2.12 and REC 7.1.3, then continue. Finish with the §6 alignment check across all Record List pages and a work log at `claude/record-field-alignment-worklog.md`.

---

## Replace the Left Sidebar with a Top-Right Hamburger Dropdown — Every Record, All UI

> **Source:** `Claude outputs/hamburger-dropdown-menu-instructions.md`

**Date:** 2026-09-29
**Raised by:** Michaela — "all UI, every record. When open, the menu tab on the left should minimise to a 3-line button in the top right corner and open as a drop-down menu on the right."
**Type:** Navigation shell change only. **No change** to fields, validation, calculations, DB calls, CSV/print output.
**Supersedes:** the "persistent left sidebar (200px) → bottom tab bar below ~800px" rule in `claude/layout-redesign-instructions.md` §3, and sidebar item G (contrast) in `claude/record-page-field-alignment-fix-instructions.md`. Everything else in those two docs still stands (tokens, 4/2/1 column system, Trend removal, etc.).
**Use in:** Claude Code (build) — or Claude Design (mock the two states first, see §8).

---

### 1. What the user sees

| State | Behaviour |
|---|---|
| **Page loads / record opened** | No left sidebar. Content spans the full width. A **3-line (hamburger) button** sits at the far right of the navy top bar. |
| **Tap hamburger** | A **dropdown panel drops down from the top-right**, directly under the button, right-aligned to the screen edge. The rest of the page dims slightly behind it. The 3 lines change to an **✕**. |
| **Tap a menu item** | Navigates as today; panel closes. |
| **Tap ✕, tap the dim area, press Esc, or scroll-lock release** | Panel closes, focus returns to the button. |

"Minimise" = the whole menu collapses into that one button. The menu is **closed by default on every page load** (do not remember an open state).

---

### 2. Scope — "all UI, every record"

Apply the same top bar + hamburger + dropdown to **every page that currently shows the left sidebar or a category navigation**:

1. **All ~131 Record List record pages** (every page containing `.rt-shell` / `.rt-sidebar`), including monitoring logs, form records, NRCS packs, REC 7.2.12 (custom body), Mortalities Log, Quick Abalone Receiving.
2. **All other app pages** (Home/Dashboard, Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Canning/Drying reports).

**Important — this widens the 2026-09-09 scope.** Those earlier docs said the out-of-scope pages must stay pixel-identical. Michaela's "all UI" overrides that **for navigation only**. Therefore on the non-record pages:

- Change **only the navigation control** (their current header nav/links → same hamburger + dropdown). Do **not** restyle their tables, tiles, filters, report layouts or print views.
- If one of those pages has no sidebar today and only a header link row (e.g. "← Job status"), keep that link where it is and **add** the hamburger at the far right; do not remove page-specific action buttons.
- Roll out in two waves (§9) so the record pages are reviewed before the rest.

---

### 3. One shared component (build once, reuse everywhere)

Create a single shared nav component — do **not** paste the markup into 130+ pages.

- **One source for the menu items** (a single JS/JSON list or the existing sidebar builder). The hamburger dropdown and any remaining consumer read from it, so adding a menu item later is a one-line change.
- **One shared stylesheet** for the top bar + button + panel (extend `record-theme.css`, all rules under `.rt-shell` / `.rt-topbar` so nothing leaks). For the non-record pages that don't load `record-theme.css`, load a small `nav-menu.css` containing **only** the top-bar-button + dropdown rules, scoped to `.nm-*` classes.
- **One shared script** (`nav-menu.js`) that injects the button, builds the panel from the item list, and handles open/close/keyboard. Pages just include the script; the engine files (`monitoring-log.js`, `form-record.js`) are not touched beyond removing the sidebar mount.
- Delete/hide the old sidebar markup and its CSS **only after** confirming (ask Michaela) that nothing else uses `.rt-sidebar` (e.g. `job-status.html` also loads `record-theme.css`).

---

### 4. Top bar

- Navy `#1B2330`, same doc identity as today on the left: doc code · title · Rev · rev date.
- Right side, left to right: existing action buttons (Refresh / CSV / Print / "← Job status" — whatever the page already has), then the **hamburger as the rightmost item**, always in the same spot on every page.
- Top bar stays visible while scrolling (`position: sticky; top: 0`) so the menu is always one tap away.
- Hamburger button: **48×48px** (tap target ≥44px), 3 white lines 22px wide × 2px, 5px gap, rounded 8px hit area, subtle `rgba(255,255,255,.08)` hover/pressed fill, gold `#A9763A` focus ring. Accessible name **"Menu"**; `aria-expanded` true/false; `aria-controls` points at the panel.
- Hide the hamburger and dropdown in **print** (`@media print`) and in CSV/print sheets. Print output must be unchanged.

---

### 5. Dropdown panel

- **Anchored top-right**: opens directly below the hamburger, right edge aligned to the screen edge (with 8px gap), sliding/fading down ~150ms. Respect `prefers-reduced-motion` (no animation).
- **Width**: 320px on PC/tablet; on phones (<560px) full width minus 16px margins. **Max height** `100vh – top bar – 16px`, scrolls internally if the list is longer.
- **Look**: background `#1D2B38` (same as old sidebar), 12px rounded bottom corners, soft shadow. Items are full-width rows, **min 48px tall**, 16px text, left icon (if the old sidebar had icons keep them) + label. Text colour **`#E6EBEF`** (never the old `#5C6771` — contrast ≥ 4.5:1 required). Hover/pressed: `#26384A`. **Current page** row: gold `#A9763A` left bar + white bold text.
- **Contents**: exactly the same items, same order, same links as the old left sidebar (the 8 categories). Add nothing and remove nothing. If the old sidebar had a user/role label or Log out control, keep it at the bottom of the panel, separated by a divider.
- **Dim layer**: full-screen scrim `rgba(0,0,0,.35)` under the panel and over the page. Tap closes.
- **Sub-items**: if any category expands to a sub-list today, use an inline accordion inside the panel (tap row to expand, one open at a time). Do not open a second flyout.

---

### 6. Behaviour rules

1. Closed by default on every load; opening does not change the URL and does not reload or move page content (no layout shift, form scroll position preserved).
2. **Never lose entered data**: opening/closing the menu must not clear, blur-validate, or submit the form. Tapping a menu link while a form has unsaved input shows the app's **existing** unsaved-changes behaviour if it has one; if it has none, do not add one — just navigate as the old sidebar did.
3. Keyboard: Enter/Space toggles; Esc closes; Tab cycles within the panel while open (focus trap); focus returns to the button on close. Arrow Up/Down move between items.
4. While open, lock body scroll (page behind must not move); unlock on close.
5. Close automatically on navigation, on window resize across a breakpoint, and on browser Back.
6. Works identically with touch (tablet on the floor), mouse (PC) and keyboard. No hover-only behaviour.
7. Same button position and behaviour at every width. **No bottom tab bar, no left sidebar at any width** — remove the ≤800px bottom-tab-bar rule.

---

### 7. Layout consequences (check, don't redesign)

- With the 200px sidebar gone, the content area is 200px wider. The 4 / 2 / 1 form-grid and 8 / 4 / 1 roster-grid rules from the alignment doc stay exactly as written; breakpoints are still based on content width, so verify each page lands in the intended column count (e.g. a 1280px screen is now ≥1100px content → 4 columns).
- Remove any left padding/margin reserved for the sidebar (`margin-left:200px`, grid `200px 1fr` shell, etc.). Content should have even left/right gutters (16px phone, 24px tablet/PC).
- Sticky top bar height must be accounted for in any `scroll-margin` / sticky sub-toolbars (e.g. REC 7.2.12 stage tabs) so nothing hides under it.
- PC mode (`body.rt-pc`): same hamburger; only the density (36px inputs) differs.

---

### 8. If you mock it first in Claude Design

Ask for **two frames** of one record page (Mortalities Log) at 1280px and 768px, and one at 390px:

1. Menu closed — full-width content, hamburger top-right in navy bar.
2. Menu open — dropdown top-right, dimmed page behind, ✕ in place of the hamburger, current item highlighted.

Use the tokens in `claude/layout-redesign-instructions.md` §3. Approve the mock before Claude Code builds.

---

### 9. Build order (Claude Code)

1. Branch `feat/hamburger-menu`. Screenshot before-state of: Mortalities Log, REC 7.2.12, REC 7.1.3, one NRCS pack page, Home, Record List index, Job Status, Batch Traceability, at 1280 / 1024 / 768 / 390px. Save to `Claude outputs/menu-before/`.
2. Locate where the sidebar is built/mounted (search `.rt-sidebar`, `.rt-shell`, the 8-category list). Report the file list and how many pages load it — **before changing anything**.
3. Build the shared component (`nav-menu.js` + styles) reading the existing item list. Test on a throwaway page.
4. **Wave 1 — record pages:** switch the shell (`rt-shell`) so it renders the top bar + hamburger instead of the sidebar. Because the shell is shared this should change all records at once. Show Michaela Mortalities Log + REC 7.2.12 + REC 7.1.3 open/closed at 1280 and 768. **Stop for review.**
5. **Wave 2 — all other pages:** add the same hamburger to Home, Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Canning/Drying reports (navigation only — §2).
6. Remove the dead sidebar CSS/markup/bottom-tab-bar rules (after §3 check).
7. Run acceptance checks (§10) on all 131 Record List pages + every other page.
8. Print-preview 3 records and 2 reports: must match the pre-change PDFs.
9. Write `claude/hamburger-menu-worklog.md`: pages changed, pages that needed exceptions, before/after screenshots.

---

### 10. Acceptance checks

**Visual (Michaela signs off):**
- [ ] No left sidebar and no bottom tab bar on any page at any width.
- [ ] Hamburger visible top-right, same position on every page, ≥44px.
- [ ] Tap → dropdown opens under it on the right; page dims; icon becomes ✕.
- [ ] Menu items identical to the old sidebar, same order, all readable, current page highlighted.
- [ ] Closes on ✕, outside tap, Esc, and after choosing an item.
- [ ] Form content and scroll position unchanged by opening/closing; nothing typed is lost.
- [ ] Content uses the freed width; alignment checks from the alignment doc still return `[]`.
- [ ] Nothing hides under the sticky top bar (REC 7.2.12 tabs, anchors).
- [ ] Print and CSV output unchanged; menu absent from print.

**Automated (Playwright, all pages, 1280 / 1024 / 768 / 390):**
- `.rt-sidebar` count = 0; hamburger exists exactly once; `aria-expanded` toggles; panel bounding box right edge ≤ viewport width and does not overflow; no horizontal page scroll; tab order enters and leaves the panel correctly.
- Put a pass/fail table in the work log.

---

### 11. Do NOT change

No field, validation, calculation, DB call, `values` key, export column, print sheet or `@media print` output. On non-record pages, no table/tile/filter/report restyling — navigation control only. Do not delete `double-seam-trend.html` or any existing page. Do not add menu items.

---

### 12. Paste-ready prompt for Claude Code

> Read `claude/hamburger-dropdown-menu-instructions.md` and follow it exactly. Replace the left sidebar (and the ≤800px bottom tab bar) on every record page with a 48px hamburger button at the far right of the sticky navy top bar that opens a dropdown panel from the top right (320px wide, dimmed page behind, ✕ to close, Esc/outside-tap closes, keyboard + focus trap, closed on every load). Menu items must be exactly the existing sidebar items in the same order with readable contrast. Build it once as a shared component (`nav-menu.js` + scoped styles) and roll it out in two waves: record pages first (stop and show me Mortalities Log, REC 7.2.12 and REC 7.1.3 open/closed at 1280 and 768), then the navigation control only on all other pages. Do not change any field, validation, calculation, DB call, export or print output, and do not restyle non-record pages beyond their nav control. Take before screenshots first, confirm what else uses `.rt-sidebar` before deleting it, and finish with the §10 checks and a work log at `claude/hamburger-menu-worklog.md`.

---

## Home Page — Remove the "Production — this month" Summary

> **Source:** `home-remove-this-month-summary-instructions.md`

**Date:** 2026-10-01
**Raised by:** Michaela — "when opening the index page, at the top there is a summary of what is happening this month — remove that."
**Type:** Removal only. **No change** to data, database calls, record pages, CSV/print, or any other page.
**Use in:** Claude Code (build).

---

### 1. What to remove

On `public/index.html` (Home), the block at the very top headed **"Production — this month"**. It contains:

- the heading and the **month selector** (shows "Loading…" while it fetches)
- the monthly metrics area, including the note "Reported monthly but not captured in any record yet" and its items (dry room occupancy, labour / overtime / absenteeism, rework batch flagging)
- any KPI tiles, "Harvest by stream" figures or delta badges that sit inside this block and are fed by the month selector

When the page opens, the first thing the user sees should be the **Categories** table (and the normal page header / navigation above it).

### 2. How to do it

1. Open `public/index.html` and find the section by its heading text "Production — this month". Remove the whole wrapping container (heading, selector, tiles, notes), not just the visible text.
2. Remove the JS that only serves that block: the month-selector change handler, the month data load, and the render function(s) for the tiles and metrics. Search for the selector's id and any render function names to make sure nothing is left calling a missing element.
3. Remove CSS used only by that block. Do **not** delete shared styles (tiles, badges) if any other page uses them. Check with a search first, e.g. `public/pages/canning-report.html` reuses the dashboard KPI tile pattern.
4. Do **not** delete any shared library function (for example in `data-store.js` or `api-backend.js`) that other pages use. Only remove code that becomes unused inside `index.html`.
5. Leave the Categories table and everything below it exactly as it is.

### 3. What must NOT change

- `pages/dashboard.html` and the **Trends** page. This is the home of all trend and month views.
- Record List, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, canning and drying reports.
- Any database table, API route or stored data. This is a display removal only, and no data is deleted.
- If the home page's top-bar / hamburger navigation exists (see `claude/hamburger-dropdown-menu-instructions.md`), leave it as it is.

### 4. Checks before finishing

- [ ] Home loads with no "Production — this month" heading, no month selector, no "Loading…" text.
- [ ] The Categories table is the first content block and all 12 links still work.
- [ ] Browser console shows **no errors** on Home (no "cannot read property of null" from removed elements).
- [ ] Network tab: Home no longer fires the monthly summary requests, or at least nothing breaks if it still does.
- [ ] Dashboard → Trends still loads and shows data (regression check).
- [ ] Home looks right at tablet width and on a PC (no leftover empty gap or margin at the top).
- [ ] Hard refresh (Ctrl+F5) and re-test, since Render serves static files with caching.

### 5. Open item (only if Michaela wants it)

The removed block mentioned three monthly metrics "not captured in any record yet" (dry room occupancy, labour / overtime / absenteeism, rework batch flags). Removing the block does not capture them anywhere. If they are still wanted, they need a new record type and are a separate task. Do not build anything for this now.

---

## Record Pages — Collapsible Sections, Auto-Focus Job No., Auto-Collapse Job Info (Instructions for Claude Code)

> **Source:** `Claude outputs/record-sections-collapse-and-job-autofocus-instructions.md`

**Date:** 2026-10-01
**Raised by:** Michaela — "all sections to have collapse, start as open. Job info section automatic collapse once job number selected. Immediate select job number on opening."
**Type:** UI behaviour change in the shared record engines. **No change** to fields, field names, order, validation rules, calculations, DB calls, autofill logic, CSV/print output.
**Related docs:** `claude/repo/REC7.1.3andloadperformanceworklog.md` (the opt-in `collapsible` flag already built for REC 7.1.3), `claude/record-page-field-alignment-fix-instructions.md` (grid/heading rules — apply together, do not fight it), `claude/layout-redesign-instructions.md`.

---

### 1. What is wanted (three behaviours)

1. **Every section on a record entry form is collapsible.** All sections start **open**.
2. **The Job info section collapses itself automatically** the moment a job number is selected. It shows a one-line summary in its header so the job is still visible while collapsed (e.g. `JOB INFO — Job 2026-0412 · AG123 · Intake 28 Sep`). Clicking the header re-opens it.
3. **On opening a record page / New Entry, the Job no. field is focused immediately** and its job list is opened, so the first action is to pick a job — no extra click.

### 2. Current state (from the repo notes)

- `public/lib/form-record.js` already supports `collapsible: true` per section (renders `<details class="fr-section-collapsible" open>` + `<summary class="fr-section-title">`, ▸/▾ marker) and `collapsedByDefault: true`. REC 7.1.3 Job info is the only section using it. A `summaryField: 'jobNo'` option was also added on that section.
- `public/lib/monitoring-log.js` (monitoring/log engine) and the custom-body records (e.g. REC 7.2.12 Double Seam) build their own headings (`ml-grouphead`, sign-off sub-label) and are **not** collapsible.
- Job no. is built by `public/lib/job-picker.js` and/or the `fr-jobnumber` builder in form-record.js (the "Job search" picker).

### 3. Changes

#### 3.1 Make collapsible the default (shared engines — not per-page flags)

- In `form-record.js` `openForm()`: treat **every** section as collapsible unless it has `collapsible: false`. Render all as `<details class="fr-section-collapsible" open>`. Remove the need to set the flag page by page. Keep `collapsedByDefault` supported but **do not use it on any page** (Michaela wants all open).
- In `monitoring-log.js`: render each group (`ml-grouphead` + its fields) as the same `<details>/<summary>` component, reusing the same CSS classes so both engines look identical. Sign-off / Completed-by blocks included.
- Custom-body records (REC 7.2.12 etc.): wrap each major block (Header, Stage/Can tabs + measurement panel, Comments, Completed by) in the same `<details>` component. Wrap only — do not change the contents or the custom render code.
- Roster / repeating-row sections collapse like any other; collapsing must **not** remove or reset rows (hide only; keep the DOM and values).
- Summary row styling follows the single heading style from the alignment brief (§H): one heading class for all sections, ▸ closed / ▾ open, whole header row is the click target (min 44px tall for tablet), visible focus ring, keyboard toggle (Enter/Space — native `<summary>` gives this).
- Add a small **"Collapse all / Expand all"** link at the top right of the form. (Small addition; remove if Michaela doesn't want it.)

#### 3.2 Job info — summary line

- Each section may declare `summaryFields: ['jobNo','agCode','intakeDate']` (generalise the existing `summaryField`). Default for any section named "Job info": job no., AG code (if present), intake date (if present).
- Render the values into the `<summary>` as muted text after the title. Update live whenever those fields change. If empty, show nothing extra.
- If the section holds a required field that is empty/invalid (see 3.5), show a small red "Incomplete" tag in the summary.

#### 3.3 Auto-collapse Job info on job selection

- Trigger: the **job-picker's "selected" event** (user picks a job number from the list), i.e. the same point where `autofill` runs. Sequence: autofill runs first → then collapse the Job info `<details>` (`details.open = false`) → then move focus to the first field of the next section (see 3.6).
- Collapse **only on a user selection**, never on page load, never when an existing record/draft is being re-opened for edit (those open fully expanded; the user's job is already chosen and they may want to review the fields).
- Collapse **once per selection**. If the user re-opens Job info and edits something else (not the job number), do not auto-collapse again. If they change the job number to a different job, collapse again after the new autofill.
- Use a short (150 ms) height transition; respect `prefers-reduced-motion` (no animation).
- Applies to every record whose first section contains the job-number picker. Detect by "section contains the job picker", not by section title, so it works on records with differently named sections (e.g. "Header" on REC 7.2.12).

#### 3.4 "Change" link on the job number

Per the alignment brief §3.4 the "Change" link sits in the label line. With the section collapsed, the job number is visible in the summary; clicking the summary re-opens the section where "Change" is available. No extra control needed.

#### 3.5 Validation and collapsed sections

- On Save / Submit, if validation fails inside a collapsed section, **expand that section**, scroll to and focus the first invalid field, and show the message. (Native `required` inside a closed `<details>` auto-expands in browsers, but REC forms with custom validation do not — add an explicit expand step in the shared validate routine.)
- Print, PDF, CSV export and "view record" output must always render **all sections expanded** regardless of on-screen state (`@media print { details > *:not(summary) { display:block } }` plus force `open` before `window.print()`).

#### 3.6 Immediate job-number selection on opening

- When a record page's **New Entry** form opens (first load, after Save & New, after Cancel back to a fresh form): focus the Job no. input and **open its dropdown/list** automatically.
- Do **not** auto-open when: editing an existing record, restoring a saved draft, or the job number already has a value.
- If the picker is a `<select>`: call `.focus()` and `.showPicker()` (feature-detect; fall back to `.focus()` only — Safari/iPad may block programmatic opening, which is fine). If it is the type-ahead "jobsearch" input: `.focus()` and show its result list.
- Don't scroll the page jumpily: focus with `{preventScroll: true}` then scroll the form card into view once.
- After a job is picked, move focus to the first empty required field in the next section (this replaces the default "focus stays on the picker").
- Records with **no** job number (e.g. Live Leftovers Log, Mortalities Log): skip, no change.

#### 3.7 Persistence (keep simple)

- No remembering of open/closed state between visits. Every page load = all open (as requested).
- Within one editing session, if the user manually collapses a section it stays collapsed until they re-open it, except for the validation re-expand in 3.5.

### 4. Out of scope

- Dashboard, Job Status Updates, Canning Report and other non-record pages (they have their own briefs).
- Any change to which fields exist, their order, or autofill mappings.
- Stage/can tab behaviour inside REC 7.2.12 (wrap only).

### 5. Test plan (do before and after, record results in the work log)

1. **REC 7.1.3, 7.1.5, 7.8.1, 7.2.12 + one monitoring-log record + one record with no job no.:** open New Entry → every section shows ▾ and is open; job picker focused with list open (except no-job record).
2. Pick a job → autofill fills as before → Job info collapses → summary shows job no. (and AG code/intake date where present) → focus lands on the next empty required field.
3. Click the Job info header → it re-opens, values intact. Edit a non-job field → no re-collapse. Change the job → autofill → collapses again.
4. Collapse the roster section with rows filled → expand → all rows/values intact.
5. Leave a required field in a collapsed section empty → Save → section expands, field focused, error shown.
6. Open an existing record and a restored draft → all sections open, no auto-focus/auto-collapse, job no. not changed.
7. Print preview and CSV export on a record with sections collapsed → all content present.
8. Tablet portrait + landscape: header tap targets ≥ 44px, no horizontal scroll, soft keyboard doesn't hide the open job list.
9. Keyboard: Tab to a section header, Enter/Space toggles.
10. Bump the script version query strings (`form-record.js?v=…`, `monitoring-log.js?v=…`) on **every** record page, since this is a shared-library change; confirm no page still loads the old copy.

### 6. Questions for Michaela (defaults in brackets — Claude Code should proceed with the default if unanswered)

1. Should the job-number list **auto-open** on page load, or only be focused with the cursor blinking? [Auto-open where the browser allows.]
2. When re-opening an existing record, should Job info be open or collapsed? [Open.]
3. Include the "Collapse all / Expand all" link? [Yes.]

### 7. Paste-ready prompt for Claude Code

> Read `claude/record-sections-collapse-and-job-autofocus-instructions.md` and follow it exactly. This is a UI-behaviour change in the shared record engines (`form-record.js`, `monitoring-log.js`, `job-picker.js`) plus wrapper-only changes on the custom-body records: (1) make every form section collapsible and open by default using the existing `<details class="fr-section-collapsible">` component; (2) when a job number is chosen by the user, run the existing autofill, then auto-collapse the Job info section and show job no./AG code/intake date in its summary line; (3) on opening a New Entry form, focus the Job no. field and open its list. Do not change any field, validation rule, calculation, DB call, autofill mapping, export or print output. Collapsed sections must expand on validation failure and always print/export expanded. Bump the library version strings on all record pages. Show me REC 7.1.3 and REC 7.2.12 after step 3.1–3.3, then continue, run the §5 test plan, and write a work log at `claude/record-collapse-autofocus-worklog.md`.

---

## Record collapse / Job-info auto-collapse / job auto-focus — work log (2026-10-01)

> **Source:** `claude/record-collapse-autofocus-worklog.md`

Brief: `Claude outputs/record-sections-collapse-and-job-autofocus-instructions.md`.
UI behaviour only — no field, validation rule, calculation, DB call, autofill mapping, CSV or print-sheet change.

### What changed
- **form-record.js v65** — every section (incl. rosters, entry-log panels, the Completed-by block) is a `<details class="fr-section-collapsible" open>`; `collapsible:false` opts out. Job-info summary = `Job <no> · <agCode> · Intake <d Mon>` (default for any section holding the jobsearch; `summaryFields` overrides). "Collapse all / Expand all" link. Save/Submit failures expand the section, scroll to and focus the first invalid field (first missing field now drives both toast and focus). Print/PDF opens everything (`beforeprint`/`afterprint`). New Entry focuses the job picker, or the prefix dropdown for a `jobnumber` field (REC 7.1.2).
- **monitoring-log.js v39** — every group (heading + its fields) becomes a `<details class="ml-section-collapsible">` with an inner `ml-grid-2` body; stage "Edit" button inside a heading no longer folds the block; same summary, Collapse/Expand all, validation reveal, print expand, auto-focus. Completed-by block wrapped.
- **job-picker.js v5** — after Confirm: collapse the enclosing section, then focus the next empty editable field. Re-opening an existing record/draft no longer auto-collapses (stays open). `jp-compact`/"Job no. X" label removed (the header summary replaces it). New `focus()` API with retry (the record shell re-parents the form and drops focus).
- **record-chrome.js v24** — sign-off blocks (`fr-signoff-block`, `ml-signoff-block`) keep the "Sign off" rail label and bubble styling; `jumpToProblem` opens collapsed ancestors; ml auto-fold-on-complete limited to `data-autofold` sections (Job info) so ml pages behave as before.
- **REC 7.2.12** (wrap only): Header open by default; stage tabs + measurement panel, Comments, Completed by wrapped in details; Job no. focused on a new entry.
- **Dry NRCS packs**: attachments-checklist code now hides the whole section block (was hiding the title/grid siblings).
- Version strings bumped on all pages: form-record 65 (80 pages), monitoring-log 39 (51), record-chrome 24 (132), job-picker 5 (engine loaders).

### Test results (local dev server; API 401s are the missing access key, unrelated)
| # | Check | Result |
|---|---|---|
| 1 | 7.1.3.1, 7.8.1 (ml), 7.1.2 (roster), 7.2.12, Dry NRCS: all sections open on New Entry | pass |
| 1 | Job picker focused (Can/Dry toggle or search with list open); 7.1.2 prefix focused; 7.2.12 job input focused | pass |
| 2 | Pick + Confirm job → Job info closes, header shows `— Job 3CP2026-0412`, focus lands on next empty field (Date) | pass |
| 4 | Collapse all / Expand all (7.1.3.1) | pass |
| 5 | Submit with required field empty in collapsed sections → Batch info opens, Date focused, toast shown | pass |
| 6 | Existing record/draft stays open (picker no longer collapses on reopen) | by code (no data locally) |
| 7 | `beforeprint` opens all, `afterprint` restores | pass (event simulated) |
| 3 | Re-open Job info after pick; re-pick collapses again | by code (only `choose()` collapses) |
| 8 | Tablet portrait/landscape tap sizes (44px summaries via CSS) | not run on a device |
| 9 | Keyboard toggle — native `<summary>` | by design, not run |

### Not done / notes
- "Incomplete" red tag in a collapsed header: skipped — record-chrome already shows "n of m fields done" in every header.
- No height animation (instant open/close) so reduced-motion is satisfied trivially.
- record-chrome already auto-folds a form-record section when its last field is completed (Tablet UI v2 C2/C3). Unchanged; flag if Michaela wants that off now that every section is collapsible.
- Pages not on the tablet shell and the PC layout (`rt-pc`) were not visually checked.

---

## Mobile & Tablet Font Responsiveness — Work Done

> **Source:** `claude/mobile-tablet-font-responsiveness.md`

**Date:** 2026-09-07
**Scope:** All record pages in the Processing Department system
**Files changed:**

- `public/styles/responsive.css` (shared responsive layer, loaded last on every page)
- `public/lib/form-record.js` (form-record engine — injected `<style>` block)
- `public/lib/monitoring-log.js` (monitoring-log engine — injected `<style>` block)

`public/styles/record-theme.css` was **not** changed — its `--form-fs-*` type-scale
variables are the desktop/print baseline and are now overridden per breakpoint from
`responsive.css`.

---

### Problem

Record forms used an 11–12px type scale everywhere. On phones and tablets that is
unreadable without pinch-zooming, and touch targets (buttons, checkboxes, table
controls) were below the 44px minimum for reliable finger input.

There are three rendering paths for record pages, each with its own typography:

| Path | Count | Typography source |
|---|---|---|
| `monitoring-log.js` engine | ~many | `.ml-*` classes in the engine's injected `<style>` |
| `form-record.js` engine | ~many | `.fr-*` classes in the engine's injected `<style>` |
| Bespoke hand-written pages (7.1.x–7.4.4) | ~28 | inline `<style>`, ideally via `--form-fs-*` vars |

All three had to be addressed.

---

### Changes

#### 1. `public/styles/responsive.css`

**`@media (max-width: 1024px)` — tablets**

- Bumped the bespoke type-scale custom properties:
  `--form-fs-root: 15px`, `--form-fs-input: 16px`, `--form-fs-button: 15px`,
  `--form-fs-small: 13px`, `--form-fs-label: 14px`, `--form-fs-hint: 13px`,
  `--form-fs-panel-head: 14px`.
- `.btn, .ml-btn, .fr-btn, button { min-height: 44px }` — tablets are touch devices
  even though the layout does not yet collapse to one column.
- `input[type=checkbox]`, `input[type=radio]`: `min-width/height: 22px`, `margin: 8px`.

**`@media (max-width: 768px)` — phones / small tablets**

- Type-scale vars raised to the readable-without-zoom minimum:
  `--form-fs-root / --form-fs-input / --form-fs-label: 16px`,
  `--form-fs-button: 16px`, `--form-fs-panel-head: 15px`,
  `--form-fs-small / --form-fs-hint: 14px`.
- Form controls: `font-size: 16px !important` (stops iOS Safari zoom-on-focus),
  `min-height: 44px`. Data-table inputs are exempted (`table input { min-height: 0 }`)
  and stay at 13px — those tables scroll horizontally instead.
- Hand-written page text: `.field` / labels / `.panel-body` (without a table) →
  16px; `.panel-head h2/h3` → 15px; `.hint, .field-hint, small` → 14px.
- Checkbox / radio: 24px box, 10px margin, and a wrapping
  `label:has(> input[type=checkbox])` gets `min-height: 44px` + inline-flex centring
  so the whole label is one 44px tap target.
- Buttons: primary `min-height: 44px` / 16px / `padding: 10px 16px`;
  small buttons keep a compact label but still get `min-height: 44px` via padding;
  buttons **inside table cells** are the deliberate exception — `min-height: 36px`
  so table rows don't blow out.
- `.report-link` (hub navigation): 16px, `min-height: 44px`.

**`@media (max-width: 480px)`** — unchanged except inherited var values; grids already
collapse to a single column here.

**`@media print`**

- Re-pins every `--form-fs-*` var back to 12px. A4 content width (~726px) overlaps the
  768px breakpoint, so without this the mobile scale would leak onto printed PDFs.
- Re-pins `.field` / labels / hints / `.panel-body` to `12px !important` and clears
  button `min-height`, so controlled-copy printouts keep their exact 12px layout.

#### 2. `public/lib/form-record.js` (engine `<style>`)

**`@media (max-width: 1024px)`** — new tablet type scale:
`.fr-app` 14px, `.fr-field` 13.5px, `.fr-field span.hint` 12px,
`.fr-panel-head h2` 13.5px; `.fr-app input/select/textarea` 15px + `min-height: 44px`
(table inputs held at 13px / `min-height: 0`); `.fr-btn` `min-height: 44px`.

**`@media (max-width: 768px)`** — phone bump added on top of the existing input rule:
`.fr-app` 15px, `.fr-field` 14px, `.fr-field span.hint` 12.5px,
`.fr-panel-head h2` 14px, `.fr-section-title` 13px,
`.fr-instructions .instr-item strong` 12.5px;
inputs `min-height: 44px`; `.fr-btn` `min-height: 44px` / 14px.

#### 3. `public/lib/monitoring-log.js` (engine `<style>`)

Same treatment as form-record with `.ml-*` selectors:

**`@media (max-width: 1024px)`** — `.ml-app` 14px, `.ml-field` 13.5px,
`.ml-field span.hint` 12px, `.ml-panel-head h2` 13.5px, inputs 15px + `min-height: 44px`,
`.ml-btn` `min-height: 44px`.

**`@media (max-width: 768px)`** — `.ml-app` 15px, `.ml-field` 14px,
`.ml-field span.hint` 12.5px, `.ml-panel-head h2` 14px, `.ml-grouphead` 13px,
`.ml-instructions .instr-item strong` 12.5px, inputs `min-height: 44px`,
`.ml-btn` `min-height: 44px` / 14px.

Both engines swap the on-screen body for a separate `.fr-sheet` / `.ml-sheet` layout
when printing, so none of these screen bumps reach printed records.

---

### Acceptance criteria

| Criterion | Status |
|---|---|
| Readable without zooming on phones (≥16px base) | Met — vars + label/input rules at 16px on `≤768px` |
| Field values scale for touch; tap targets ≥44px | Met — inputs, buttons, checkbox labels at 44px |
| Section titles stay visually distinct at all sizes | Met — panel heads scale but keep uppercase + letter-spacing + colour |
| Inputs accommodate mobile keyboards without horizontal scroll | Met — grids collapse progressively; 16px inputs prevent iOS zoom |
| Roster/batch rows navigable on phones | Met — engine roster rows stack; wide data tables scroll with visible scrollbar |
| Interactive elements sized/spaced for finger input | Met — 44px buttons, 24px checkboxes with 10px margin |

---

### Verification

Tested in the browser preview (`frontend-dev`, localhost:3000) via DevTools device
emulation:

- **Phone (375×812):** `REC-7.3.3` (form-record engine), `REC-7.9.1` (monitoring-log
  engine), `REC-7.2.4` (bespoke, uses `--form-fs-*`). Labels large and readable,
  inputs tall, Y/N buttons finger-sized, section headers distinct, wide table scrolls
  with a visible indicator, no body horizontal scroll.
- **Tablet (768×1024):** `REC-7.3.3`, `REC-7.9.1`. Clean single/two-column layout,
  44px targets, readable type.
- Console: only expected 401s from the unauthorised records database; no CSS errors.

Print output not re-tested on paper — guarded by the `@media print` re-pin rules and
the engine sheet-swap; behaviour is unchanged by construction.

---

## Instruction: Mobile & Tablet Font Responsiveness

> **Source:** `Claude outputs/mobile-responsive-fonts-instruction.md`

### Requirement
All records must be easy to use on tablet and phone devices. Current font sizes are not compatible with smaller screens and need to be adjusted for better mobile/tablet readability and usability.

### Scope
- Apply to all record pages in the Processing Department system
- Covers both `public/styles/record-theme.css` (global theme) and `public/styles/responsive.css` (responsive overrides)
- Focus on label text, input fields, button text, section titles, and form instructions

### Acceptance Criteria
- Text must be readable without zooming on phones (minimum 16px base font on mobile)
- Labels and field values scale appropriately for touch interaction (tap targets ≥44px)
- Section titles remain visually distinct across all screen sizes
- Form inputs (text fields, dropdowns, number fields) accommodate mobile keyboards without horizontal scroll
- Roster/batch rows remain navigable on phones (either stacked or horizontally scrollable with clear indicators)
- All interactive elements (buttons, links, checkboxes) have sufficient size and spacing for thumb/finger input on mobile

### Implementation Notes
- Tablet breakpoint: typically 600px–1024px width
- Phone breakpoint: < 600px width
- Use CSS media queries in `responsive.css` for mobile/tablet overrides
- Test on actual devices or browser DevTools device emulation before marking complete

---

## Time fields → clock selector

> **Source:** `Claude outputs/time-fields-clock-selector.md`

All record fields whose label is a point-in-time (not a duration) were changed from a plain
text box to a native clock/time picker (`<input type="time">`), or `datetime-local` for the two
combined date+time fields.

### Engine change
- `public/lib/form-record.js`: added `datetime` field-type support (`<input type="datetime-local">`).
  `time` support already existed. `monitoring-log.js` already supported both.

### Data change
- `data/record-definitions.json`: 47 fields changed `type: "text"` → `"time"` (45) or `"datetime"` (2).
- 26 of those fields also live inline in 14 record HTML pages (not yet migrated to DB-only config)
  — edited to match:
  - REC-7.5.2-live-pack-checklist.html
  - REC-7.7.3-glass-breakage-clearance-certificate.html
  - REC-7.7.6-plaster-dressing-inspection.html
  - REC-7.7.6a-first-aid-checklist-record.html
  - REC-7.8.1-chiller-batch-control.html
  - REC-7.8.1-dry-chiller-batch-control.html
  - REC-7.8.10-maintenance-job-card.html
  - REC-7.8.2-daily-waste-removal.html
  - REC-7.8.3-boiler-inspection-report.html
  - REC-7.8.9.1-lha-water-monitoring.html
  - REC-8.1.4-withdrawal-mock-recall-record.html
  - REC-8.1.5-traceability.html
  - REC-8.4.a-emergency-evacuation-attendance-register.html
  - REC-8.4.b-handling-of-emergencies-and-incidences.html
- `node scripts/verify-definitions.mjs` passes clean (0 real differences) after the edits.

### Fields deliberately left as text/number/derived (durations, not clock moments)
bleedingTotalTime, breakTime-as-duration cases already covered above as clock time, cookingTime,
dripTimeOfBags, saltingTotalTime, standardSaltingTime, totalCookingTime, totalDryingTimeDays,
totalTumblingTime, totalWashingTime, purgeDays. Also left alone: `timeOfCheck` where it's a
`select` dropdown, `deliveredOnTime` (yes/no select), and free-text fields that only mention
"time" in a longer label (e.g. "Water temperature at time of checking").

### Still to do (writes to the live Neon DB — not yet run)
```bash
node scripts/seed-definitions.mjs
node scripts/export-record-defs.mjs
```
`seed-definitions.mjs` reloads all 131 record definitions from `data/record-definitions.json`
into Postgres. `export-record-defs.mjs` refreshes the static `public/data/record-defs/*.json`
fallback snapshots used when the API is asleep. Run in that order, then deploy.

---

## Instructions: Move "Edit Template" off record pages into an index section

> **Source:** `claude/EDIT_TEMPLATE_RELOCATION.md`

Repo: `PROCESSING_DEPARTMENT` (Render-hosted app)

### Background

Currently **every** REC record page shows an "Edit Template" button in its header
(gated by `PermissionRules.can('manageTemplates')`). This exists in two engines:

- `public/lib/monitoring-log.js`
  - button render: ~line 1082 (`ml_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~lines 1253–1275
- `public/lib/form-record.js`
  - button render: ~line 587 (`fr_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~line 1238 onward

Both call `window.TemplateEditor.open({ recordKey, engine, currentConfig, ... })` where
`currentConfig` is pulled from that record's own inline config (`entryFields`,
`specFields`, etc. — data that only exists inside each record's own HTML file). That's
why the button currently lives on the record page: it's the only place the current
config is already in memory.

### Recommended approach (minimal duplication, keeps config always in sync)

#### 1. Remove the visible button from both engines
In `monitoring-log.js` and `form-record.js`, delete the header line that renders the
button:
```js
${canManageTemplates ? `<button class="ml-btn ml-btn-ghost" id="ml_editTemplateBtn">Edit Template</button>` : ''}
```
(and the equivalent `fr_editTemplateBtn` line in `form-record.js`).

#### 2. Replace the click-handler with an auto-open-on-load, triggered by a URL param
Instead of wiring a button click, open the same Template Editor automatically when the
page loads with `?editTemplate=1` in the URL:

```js
// ---------- edit template (opened via ?editTemplate=1 from the index, not a button here) ----------
if (canManageTemplates && new URLSearchParams(location.search).get('editTemplate') === '1') {
  function doOpen() {
    window.TemplateEditor.open({
      recordKey: config.recordKey,
      engine: 'monitoring-log', // 'form-record' in form-record.js
      currentConfig: { /* same fields as the old handler already builds */ },
      inlineConfig: null,
      docRevisionStart: config.docRevisionStart,
      onSave: () => location.reload()
    });
  }
  if (window.TemplateEditor) { doOpen(); }
  else {
    const s = document.createElement('script');
    s.src = '../lib/template-editor.js';
    s.onload = doOpen;
    document.head.appendChild(s);
  }
}
```
This keeps `currentConfig` correct (still read live from the page's own config object)
while the entry point moves off the visible record header — the record page itself no
longer shows an edit affordance.

#### 3. Add an "Edit Records" section/column on the index
Best home: `public/records/master-record-index.html` — it already lists every record
(it's the existing document-control register), so add an "Edit Template" action per row
rather than building a new page. Each link just appends the query param:
```html
<a href="REC-7.1-incubator-cans-log.html?editTemplate=1">Edit Template</a>
```

Check `public/lib/master-index-data.js` first — if the record table on that page is
generated from this data file rather than hand-written HTML, add the edit-link
generation there so it's produced once for all ~120 records instead of hand-editing
the table. Gate the column the same way the old button was gated: only render/show it
when `PermissionRules.can('manageTemplates')` is true for the current user, so
non-admin users don't see an "Edit Template" column at all.

Alternative: if `master-record-index.html` feels like the wrong home (it's framed as a
read-only document-control register), add a new "Edit Records" section on
`public/index.html` instead, as its own table/list. Either location satisfies "not on
the record itself, but under the index" — pick whichever fits the site's existing
structure better once you're looking at both files.

#### 4. Test
- Confirm the "Edit Template" button no longer appears on any record page.
- Confirm that, as an admin/manageTemplates user, clicking "Edit Template" from the new
  index section still opens the same Template Editor modal as before, and that
  `onSave` still does `location.reload()` to reflect saved changes.
- Confirm non-admin users see no edit affordance anywhere (neither the old button nor
  the new index link/column).

### Scope check before starting

Search `public/lib/` for other doc engines with the same button pattern:
`policy-doc.js`, `procedure-doc.js`, `sop-doc.js`, `prp-doc.js`. Those render
Policies/Procedures/SOPs/PRPs, not REC records — the instruction was specifically
about "records," so these four files are likely **out of scope**. Confirm with
Michaela before touching them; leave them as-is unless she says otherwise.

---

**Not in scope:** no database/schema design, no other functional changes beyond
relocating this one control.

---
