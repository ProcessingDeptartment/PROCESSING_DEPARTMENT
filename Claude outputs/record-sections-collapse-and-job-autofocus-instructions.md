# Record Pages — Collapsible Sections, Auto-Focus Job No., Auto-Collapse Job Info (Instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela — "all sections to have collapse, start as open. Job info section automatic collapse once job number selected. Immediate select job number on opening."
**Type:** UI behaviour change in the shared record engines. **No change** to fields, field names, order, validation rules, calculations, DB calls, autofill logic, CSV/print output.
**Related docs:** `claude/repo/REC7.1.3andloadperformanceworklog.md` (the opt-in `collapsible` flag already built for REC 7.1.3), `claude/record-page-field-alignment-fix-instructions.md` (grid/heading rules — apply together, do not fight it), `claude/layout-redesign-instructions.md`.

---

## 1. What is wanted (three behaviours)

1. **Every section on a record entry form is collapsible.** All sections start **open**.
2. **The Job info section collapses itself automatically** the moment a job number is selected. It shows a one-line summary in its header so the job is still visible while collapsed (e.g. `JOB INFO — Job 2026-0412 · AG123 · Intake 28 Sep`). Clicking the header re-opens it.
3. **On opening a record page / New Entry, the Job no. field is focused immediately** and its job list is opened, so the first action is to pick a job — no extra click.

## 2. Current state (from the repo notes)

- `public/lib/form-record.js` already supports `collapsible: true` per section (renders `<details class="fr-section-collapsible" open>` + `<summary class="fr-section-title">`, ▸/▾ marker) and `collapsedByDefault: true`. REC 7.1.3 Job info is the only section using it. A `summaryField: 'jobNo'` option was also added on that section.
- `public/lib/monitoring-log.js` (monitoring/log engine) and the custom-body records (e.g. REC 7.2.12 Double Seam) build their own headings (`ml-grouphead`, sign-off sub-label) and are **not** collapsible.
- Job no. is built by `public/lib/job-picker.js` and/or the `fr-jobnumber` builder in form-record.js (the "Job search" picker).

## 3. Changes

### 3.1 Make collapsible the default (shared engines — not per-page flags)

- In `form-record.js` `openForm()`: treat **every** section as collapsible unless it has `collapsible: false`. Render all as `<details class="fr-section-collapsible" open>`. Remove the need to set the flag page by page. Keep `collapsedByDefault` supported but **do not use it on any page** (Michaela wants all open).
- In `monitoring-log.js`: render each group (`ml-grouphead` + its fields) as the same `<details>/<summary>` component, reusing the same CSS classes so both engines look identical. Sign-off / Completed-by blocks included.
- Custom-body records (REC 7.2.12 etc.): wrap each major block (Header, Stage/Can tabs + measurement panel, Comments, Completed by) in the same `<details>` component. Wrap only — do not change the contents or the custom render code.
- Roster / repeating-row sections collapse like any other; collapsing must **not** remove or reset rows (hide only; keep the DOM and values).
- Summary row styling follows the single heading style from the alignment brief (§H): one heading class for all sections, ▸ closed / ▾ open, whole header row is the click target (min 44px tall for tablet), visible focus ring, keyboard toggle (Enter/Space — native `<summary>` gives this).
- Add a small **"Collapse all / Expand all"** link at the top right of the form. (Small addition; remove if Michaela doesn't want it.)

### 3.2 Job info — summary line

- Each section may declare `summaryFields: ['jobNo','agCode','intakeDate']` (generalise the existing `summaryField`). Default for any section named "Job info": job no., AG code (if present), intake date (if present).
- Render the values into the `<summary>` as muted text after the title. Update live whenever those fields change. If empty, show nothing extra.
- If the section holds a required field that is empty/invalid (see 3.5), show a small red "Incomplete" tag in the summary.

### 3.3 Auto-collapse Job info on job selection

- Trigger: the **job-picker's "selected" event** (user picks a job number from the list), i.e. the same point where `autofill` runs. Sequence: autofill runs first → then collapse the Job info `<details>` (`details.open = false`) → then move focus to the first field of the next section (see 3.6).
- Collapse **only on a user selection**, never on page load, never when an existing record/draft is being re-opened for edit (those open fully expanded; the user's job is already chosen and they may want to review the fields).
- Collapse **once per selection**. If the user re-opens Job info and edits something else (not the job number), do not auto-collapse again. If they change the job number to a different job, collapse again after the new autofill.
- Use a short (150 ms) height transition; respect `prefers-reduced-motion` (no animation).
- Applies to every record whose first section contains the job-number picker. Detect by "section contains the job picker", not by section title, so it works on records with differently named sections (e.g. "Header" on REC 7.2.12).

### 3.4 "Change" link on the job number

Per the alignment brief §3.4 the "Change" link sits in the label line. With the section collapsed, the job number is visible in the summary; clicking the summary re-opens the section where "Change" is available. No extra control needed.

### 3.5 Validation and collapsed sections

- On Save / Submit, if validation fails inside a collapsed section, **expand that section**, scroll to and focus the first invalid field, and show the message. (Native `required` inside a closed `<details>` auto-expands in browsers, but REC forms with custom validation do not — add an explicit expand step in the shared validate routine.)
- Print, PDF, CSV export and "view record" output must always render **all sections expanded** regardless of on-screen state (`@media print { details > *:not(summary) { display:block } }` plus force `open` before `window.print()`).

### 3.6 Immediate job-number selection on opening

- When a record page's **New Entry** form opens (first load, after Save & New, after Cancel back to a fresh form): focus the Job no. input and **open its dropdown/list** automatically.
- Do **not** auto-open when: editing an existing record, restoring a saved draft, or the job number already has a value.
- If the picker is a `<select>`: call `.focus()` and `.showPicker()` (feature-detect; fall back to `.focus()` only — Safari/iPad may block programmatic opening, which is fine). If it is the type-ahead "jobsearch" input: `.focus()` and show its result list.
- Don't scroll the page jumpily: focus with `{preventScroll: true}` then scroll the form card into view once.
- After a job is picked, move focus to the first empty required field in the next section (this replaces the default "focus stays on the picker").
- Records with **no** job number (e.g. Live Leftovers Log, Mortalities Log): skip, no change.

### 3.7 Persistence (keep simple)

- No remembering of open/closed state between visits. Every page load = all open (as requested).
- Within one editing session, if the user manually collapses a section it stays collapsed until they re-open it, except for the validation re-expand in 3.5.

## 4. Out of scope

- Dashboard, Job Status Updates, Canning Report and other non-record pages (they have their own briefs).
- Any change to which fields exist, their order, or autofill mappings.
- Stage/can tab behaviour inside REC 7.2.12 (wrap only).

## 5. Test plan (do before and after, record results in the work log)

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

## 6. Questions for Michaela (defaults in brackets — Claude Code should proceed with the default if unanswered)

1. Should the job-number list **auto-open** on page load, or only be focused with the cursor blinking? [Auto-open where the browser allows.]
2. When re-opening an existing record, should Job info be open or collapsed? [Open.]
3. Include the "Collapse all / Expand all" link? [Yes.]

## 7. Paste-ready prompt for Claude Code

> Read `claude/record-sections-collapse-and-job-autofocus-instructions.md` and follow it exactly. This is a UI-behaviour change in the shared record engines (`form-record.js`, `monitoring-log.js`, `job-picker.js`) plus wrapper-only changes on the custom-body records: (1) make every form section collapsible and open by default using the existing `<details class="fr-section-collapsible">` component; (2) when a job number is chosen by the user, run the existing autofill, then auto-collapse the Job info section and show job no./AG code/intake date in its summary line; (3) on opening a New Entry form, focus the Job no. field and open its list. Do not change any field, validation rule, calculation, DB call, autofill mapping, export or print output. Collapsed sections must expand on validation failure and always print/export expanded. Bump the library version strings on all record pages. Show me REC 7.1.3 and REC 7.2.12 after step 3.1–3.3, then continue, run the §5 test plan, and write a work log at `claude/record-collapse-autofocus-worklog.md`.
