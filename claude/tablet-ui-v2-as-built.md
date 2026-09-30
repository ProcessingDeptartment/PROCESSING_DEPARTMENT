# Tablet UI v2 — as built

Written 2026-09-30. Companion to `tablet-ui-implementation-instructions.md` (the plan). This file records what was actually built, where it lives, what was decided along the way, and what is still open.

**Status:** built and checked on the local copy only (a mouse browser at 820×1180). **Not deployed. Not tried on a real touch tablet. Print PDF not re-tested.** Deploy is held while REC 7.4.1 is unfinished (see the 7.4.1 memory note).

---

## 1. What changed, in one paragraph

Every in-scope record page (131) now opts in with `<body class="rt-tablet">`. That switches on one set of size/colour tokens in `record-theme.css` and a small script, `record-chrome.js`, that adds the shared tablet furniture: section blocks, section strip, slim header/footer, save indicator, submissions sheet, and so on. The two engines (`form-record.js`, `monitoring-log.js`) were **not edited** — their DOM is restyled and, in places, re-parented, never re-created, so every field, calculation, validation, storage key and CSV/print path is the engine's own.

## 2. Files

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

## 3. One place to change sizes

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

## 4. Behaviour added by `record-chrome.js`

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

## 5. Header, strip, footer sizes

Top bar 48px, section strip 35px, footer about 51px (from about 76px each). Header/footer buttons are **40px** and the strip buttons **34px** — below the brief's 48px minimum, deliberately, on request. Form fields are still 48px. If the strip is fiddly on a real tablet, change `--rail-h` / `--bar-btn-h`.

## 6. No access key

When the server answers **401** (no or wrong key):
- The full-width red bar is gone on **every page** (`api-backend.js` change).
- **Record pages:** the top-bar indicator becomes a red ⚠ where the green tick was. Tapping it opens `/pages/api-key.html` (asks to confirm only if something has been typed).
- **All other pages:** a small red ⚠ circle link (`#api-auth-warning`, bottom-right) opens the same page.
- Both appear **only** in that situation and disappear again after the next successful API response. The amber "N records are waiting to sync" bar is a different bar and is untouched.

## 7. Decisions worth knowing about

- Pilot step skipped on request; rolled out to all 131 pages directly.
- `--ok` / `--warn` from the brief measure 4.41 / 4.45 on their own tints (just under 4.5:1); `--ok-ink` / `--warn-ink` added for text on those tints.
- Colour aliases (`--rt-gold` → `--action` etc.) live under `body.rt-tablet`, **not** `:root`, so `job-status.html` (which also loads `record-theme.css`) keeps its colours.
- `--fs-hint` was lowered to 13px, below the brief's 14px minimum, on request (font pass 1px, then more for 7.4.3.1).
- Footer no longer sticky ⇒ brief acceptance item 6 ("Submit visible without scrolling") no longer holds, by design.
- The brief's pilot note named `form-record`; Mortalities Log actually runs on `monitoring-log`.

## 8. Not done

- C8 ⓘ hints (would hide unit labels — units live in `span.hint`).
- C9 "(optional)" marking (monitoring-log does not mark required fields in the page).
- Full-height sheet for Entries beyond the new submissions sheet; sticky table header (the table wrapper scrolls, which breaks sticky).
- Removing the `data-palette` blocks and `--palette-*` set (needs a file list and confirmation first, per the brief).
- Deleting the old breakpoints inside the engine style strings, and the hard-coded sizes noted in section 3.
- Moving the colour aliases up to `:root` (waits on Job Status decision).
- Job search dropdown, browser `confirm()` boxes, real print output, and everything on a real touch tablet.
- 1-section pages show a one-button strip (could be hidden).

## 9. How it was checked

A throwaway script loaded each of the 131 pages in a sandboxed frame at 820×1180 and measured: page renders (no "could not load record"), shell + action bar present, no sideways scroll, no visible text under 13px, no size outside the scale, no control under its minimum height. Last full pass (before the header/footer slimming and the no-key change) was clean on all 131 pages. Pop-ups (hamburger menu, work-instruction bubble, Entries/Verification panels, job-confirm dialog, bin sheet) were opened and measured separately; the job-confirm dialog and bin sheet were off-scale and were fixed. The header/footer heights and the no-key badge were checked on a few pages only. Local API returns 401, so no real save or submit was ever performed.

## 10. Rollback

Restore from `claude/_backup/`: `record-theme.css.pre-*`, `record-chrome.js.pre-*`, `record-shell.js.pre-tablet-v2`, `api-backend.js.pre-warning-badge`, and `records-pre-rollout/` for the page edits. Or remove `class="rt-tablet"` from `<body>` on a page to switch it off (the tablet CSS is entirely gated on that class; only `api-backend.js` is global).
