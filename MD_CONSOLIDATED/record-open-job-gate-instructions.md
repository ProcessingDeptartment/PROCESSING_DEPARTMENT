# Record Open — Job Search Gate (Instructions for Claude Code)

**Date:** 2026-10-02
**Raised by:** Michaela — "General for full system: open record, immediate job selection pop-up is correct. UI shows only a job search bar that auto drops down. When clicked, maintain pop-up to confirm. Once confirmed, job info section collapses and all other sections appear."
**Scope:** every record page in the system (form-record engine, monitoring-log engine, custom-body records such as REC 7.2.12). Dry (drying) records included; dry-specific changes will follow in a separate brief.
**Type:** UI behaviour change in the shared engines. **No change** to fields, field names, validation rules, calculations, DB calls, autofill mapping, CSV/print output.
**Relationship to earlier brief:** this **amends** `claude/record-sections-collapse-and-job-autofocus-instructions.md`. Where the two disagree, **this document wins**. Everything in the earlier brief not mentioned here still applies (collapsible sections, Job entry = Job no. only, validation re-expand, print/export expanded, version bumps). Specifically this document replaces §3.3 (auto-collapse) and §3.6 (focus on opening) of the earlier brief, and adds a new "gate" behaviour.

---

## 1. What is wanted (the new flow)

1. **Opening a new record shows ONLY the Job search bar.** Nothing else on the form is visible: no other sections, no empty field groups, no sign-off block, no Save/Submit buttons.
2. The search bar is **focused immediately** and its list **drops down automatically** (type-ahead). The user can scroll the list or type to filter.
3. **Clicking (tapping) a job in the list opens the job details pop-up** (read-only details of that job). The pop-up **stays open until the user confirms**. It does not close on outside click, timer, or scroll.
4. **On Confirm:** pop-up closes → job number is set → existing autofill runs → the **Job info section collapses** to a single header line → **all other sections appear** (revealed, all open) → focus moves to the first empty required field of the next section.
5. **On Cancel:** pop-up closes → selection cleared → form still shows only the search bar, refocused with the list open again. Nothing is autofilled, nothing is revealed.

## 2. The gate (core rule)

The record is **locked behind the job** until a job is confirmed.

- State: `jobConfirmed = false` on a new entry. While false, every section **other than the Job search section** is not rendered visibly (`hidden` / `display:none`). Keep them in the DOM (do not rebuild) so values, rosters and calculations initialise normally once revealed.
- Hidden sections must be **inert**: not focusable, not tabbable, not part of validation, and the footer actions (Save draft / Submit / Cancel-record) are hidden too. Only a small **Cancel / Back to list** link remains available so the user is never trapped.
- State changes to `true` **only** on Confirm in the pop-up. Selecting in the list alone does not unlock anything.
- Reveal with a short (150 ms) fade/height transition; respect `prefers-reduced-motion` (no animation).
- Applies to **every record that has a job number picker**. Detect by "form contains the job picker". Records with **no** job number (e.g. Live Leftovers Log, Mortalities Log) are unchanged — they open as normal.

### 2.1 When the gate does NOT apply (open fully, no gate)

- Opening an **existing record** to view or edit.
- Restoring a **saved draft** that already has a job number.
- Any form where the job number already has a value.

In these cases: all sections visible and open, Job info section open (not collapsed), no auto-focus on the search bar, no pop-up.

## 3. The job search bar

- Single input, full width, large touch target (≥ 48 px tall on tablet), placeholder "Search job number…". Label "Job no." above it.
- **Type-ahead filter**: matches anywhere in the job number (and, if available cheaply, AG code / client). Case-insensitive. Results list shows job number plus one muted descriptor so staff can tell similar jobs apart (e.g. intake date) — read from the same job source the picker already uses.
- **Auto-drop-down**: list opens on page load and again on focus/click if closed. Feature-detect: for a native `<select>` use `.focus()` then `.showPicker()` where supported (Safari/iPad may refuse — fall back to focus only); for the type-ahead input show the result list directly. Prefer the type-ahead input everywhere so behaviour is the same on all records.
- Focus with `{preventScroll: true}`, then scroll the form card into view once.
- List behaviour: max-height with scroll, keyboard Up/Down/Enter, tap to select, "No jobs found" empty state, closed jobs excluded exactly as the current picker excludes them (no change to which jobs are offered).
- Do not allow free-typed job numbers that are not in the list.

## 4. The confirmation pop-up (kept, behaviour tightened)

- Opens on selecting a job from the list. Shows read-only job details looked up from the job (same fields the existing pop-up shows: job no., intake date, farm, AG code, processing for, intake weight, etc.).
- Buttons: **Confirm** (primary, right) and **Choose a different job** (secondary, left). Both ≥ 44 px.
- Stays open until one is pressed. **No** close on backdrop click, no timer. Esc = Choose a different job. Enter = Confirm. Focus trapped inside; focus returns to the search bar on cancel.
- Not re-shown for the same job unless the user changes the job number.
- Confirm sequence (in this order, so there is no flicker):
  1. set `jobNo` and run existing autofill;
  2. close the pop-up;
  3. set `jobConfirmed = true`;
  4. collapse the Job info `<details>` (`open = false`);
  5. reveal all other sections (open);
  6. focus the first empty required field in the first revealed section.

## 5. Job info section after confirm

- Collapsed header shows **job no. only**: `JOB INFO — 2026-0412` (▸ closed / ▾ open marker, whole row is the tap target, ≥ 44 px).
- Clicking the header re-opens it, showing the confirmed job no. as a read-only value with a **Change** link.
- **Change job after confirm:** Change → search bar reappears with list open → pick → pop-up → Confirm. If the new job differs, run autofill for the new job and re-collapse. Warn first with a plain message if the record already has entered data that autofill would overwrite ("Changing the job will replace auto-filled values. Continue?") — only for fields that autofill actually writes. If Cancel is pressed on the pop-up during a change, keep the **original** job and leave everything as it was (do not re-lock the form).
- Auto-collapse happens once per confirmed selection; editing other things in Job info later does not re-collapse it.

## 6. Traceability and data integrity

- The saved record must still store `jobNo` as the key exactly as today. No schema change.
- A record can only be created with a confirmed `jobNo` (the gate makes this structural). Keep the existing server-side/required validation as a backstop; do not rely on the UI gate alone.
- Do not store any new fields. Optional (only if trivial and already available): log in the existing audit/trace mechanism that the job was confirmed in the pop-up. If no such mechanism exists, skip it — do not add a table.
- Drafts: a draft saved after the gate is passed restores with the gate open (see §2.1). A draft cannot exist without a job.

## 7. Validation, print, export

- Because other sections are hidden until confirm, there is no validation on them before confirm. After confirm, the earlier brief §3.5 applies (expand collapsed sections on validation failure).
- Print / PDF / CSV / "view record" always render all sections expanded (earlier brief §3.5).

## 8. Out of scope

- Dashboard, Job Status Updates, Canning Report and other non-record pages.
- The job details content and which fields it shows (unchanged).
- Dry-record-specific field changes (coming in later briefs).
- The start record (REC 7.1.2 Abalone Receiving, to be confirmed) keeps its full job fields per the earlier brief; if it **creates** the job there is nothing to search for, so the gate does **not** apply to it. Confirm which records create jobs and list them in the single `JOB_START_RECORDS` config constant.

## 9. Test plan

1. Open New Entry on REC 7.1.3, 7.1.5, 7.8.1, 7.2.12, one monitoring-log record, and one record with no job number. With a job picker: only the search bar is visible, focused, list open. No other section, no footer buttons. No-job record: opens normally.
2. Type to filter; keyboard and tap selection both work; closed jobs absent.
3. Select a job → pop-up appears and **stays** (try clicking outside, waiting 30 s, scrolling). Esc/Choose different job → search bar refocused, form still locked, nothing autofilled.
4. Select a job → Confirm → autofill runs, Job info collapses to job no. only, all other sections appear open, focus lands on first empty required field.
5. Tab key while locked: cannot reach any hidden field.
6. Reopen Job info → Change → pick a different job → Confirm → autofill replaces, warning shown when data would be overwritten; Cancel at pop-up keeps the original job and does not re-lock.
7. Open an existing record and a restored draft: no gate, all sections open, no pop-up, job unchanged.
8. Save/Submit after confirm stores `jobNo`; list columns, CSV, print, trends unchanged.
9. Tablet portrait and landscape: search bar and list usable with the soft keyboard open, pop-up buttons ≥ 44 px, no horizontal scroll.
10. Bump script version query strings (`form-record.js?v=…`, `monitoring-log.js?v=…`, `job-picker.js?v=…`) on **every** record page; confirm none loads an old copy.

## 10. Defaults if unanswered

- Search matches job number, plus AG code if the job source already includes it. [Yes.]
- Footer actions hidden while locked, a small "Back to list" link kept. [Yes.]
- Changing job after confirm warns before overwriting autofilled values. [Yes.]

## 11. Paste-ready prompt for Claude Code

> Read `claude/record-open-job-gate-instructions.md` and `claude/record-sections-collapse-and-job-autofocus-instructions.md`; where they conflict, the gate document wins. Implement in the shared engines (`form-record.js`, `monitoring-log.js`, `job-picker.js`) and wrapper-only on custom-body records: on opening a NEW record that has a job picker, show only the Job search bar (type-ahead, focused, list auto-open) and keep every other section and the footer buttons hidden/inert in the DOM; selecting a job opens the existing job details pop-up, which stays until Confirm (Cancel/Esc clears the selection and keeps the form locked); on Confirm set `jobNo`, run existing autofill, close the pop-up, collapse Job info to a header showing the job no. only, reveal all other sections open, and focus the first empty required field. Existing records and restored drafts bypass the gate and open fully. Records without a job number and the job-creating start record are unchanged. Do not change fields, validation, calculations, DB calls, autofill mapping, exports or print. Bump version strings on every record page. Show me REC 7.1.3 and REC 7.2.12 first, then run the §9 test plan and write a work log at `claude/record-open-job-gate-worklog.md`.
