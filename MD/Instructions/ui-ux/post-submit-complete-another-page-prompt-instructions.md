# Post-Submit Prompt — "Complete another page?" (Another page / Records list / Log out) (Instructions for Claude Code)

**Date:** 2026-10-01 (revised after Michaela's clarification)
**Raised by:** Michaela — "when record submit, pop up question. Complete another page. Go back to records." Clarified: "Complete another page means another page of the record the user is currently on. If no it goes back to record list. Third option log out."
**Type:** UI behaviour change in the shared record engines. **No change** to fields, validation, calculations, DB calls, autofill, CSV/print output, or what is saved.
**Related docs:** `claude/tablet-ui-optimisation-brief.md` (§5.7 submit confirmation), `claude/record-sections-collapse-and-job-autofocus-instructions.md` (pop-up, focus and keyboard rules to match; New Entry opening behaviour), `claude/repo/SIGNOFF-LOGIN-FIX-2026-09-22.md` (Auth / sign-in-out behaviour), `claude/hamburger-dropdown-menu-instructions.md`.

---

## 1. What is wanted

When a record is **submitted successfully**, a pop-up appears with the question **"Complete another page?"** and three choices:

| Choice | Result |
|---|---|
| **Yes — another page of this record** | Stay on the same record and open a **fresh New Entry** form (the next page of the same record). |
| **No — back to Records** | Go to the Records list (Record List page). |
| **Log out** | Sign the user out, then go to the sign-in / login screen. |

"Page" here means **another entry of the record the user is on** (e.g. another sheet of REC 7.1.3), not a different record.

The pop-up appears **only after the submit has actually succeeded** (server/DB confirmed). It never appears on Save draft, Clear, Cancel, or a failed/offline submit.

## 2. Current state (confirm in the repo before editing)

- Submit is handled in the shared engines `public/lib/form-record.js` and `public/lib/monitoring-log.js`, plus custom-body records (e.g. REC 7.2.12) with their own submit handler.
- After a successful submit today the form resets (or shows a toast / success sheet) and the user stays on the record page. This already approximates "Yes"; the new pop-up just makes the choice explicit.
- Find the **single point where "submit succeeded" is known** in each engine (the `.then` / `await` after the API save returns OK) and hook there — not on the button click.
- Find the Records list URL and put it in one shared constant (`RECORDS_LIST_URL`). Do not hard-code per page.
- Find the **existing sign-out function** in the Auth module (`window.Auth`, see SIGNOFF-LOGIN-FIX doc and the login modal). **Reuse it** — do not write a second logout path. If none exists as a callable function, stop and tell Michaela before inventing one (it must clear the same session/role/username the sign-off and "Completed by" pre-fill read from).

## 3. Behaviour

### 3.1 Trigger
- Fire once per successful submit, after the existing success handling (data saved, entries list refreshed). The record must be safely stored before the question is shown.
- Do **not** fire when: validation fails; the save errors; the app is offline and the entry is queued for retry (show "Offline — will retry" instead — see Q2); an existing entry is being edited and re-saved (see Q3).

### 3.2 The pop-up
- Modal, centred, page dimmed. Does **not** close on a timer or outside click — the user must choose.
- Title: **"Submitted"** with a confirmation line (e.g. "REC 7.1.3 · 10:43 saved").
- Question: **"Complete another page?"**
- Three buttons, stacked full width, ≥ 48px tall, in this order:
  1. **Yes — another page** (primary, gold, focused by default)
  2. **No — back to Records** (secondary)
  3. **Log out** (tertiary/outline, visually separated at the bottom so it is not tapped by accident)
- Accessibility: focus trapped inside the dialog, `role="dialog"` + `aria-modal="true"` labelled by the title, Enter = Yes, **Esc = Yes-equivalent safe close is NOT allowed** — Esc does nothing (the user must pick), Tab cycles the three buttons. Reuse the same dialog component/styling as the job details pop-up.
- Disable the Submit button while saving so the pop-up cannot appear twice from a double tap.

### 3.3 Yes — another page of this record
- Close the pop-up and reset to a **fresh New Entry form** for the same record.
- Apply the New Entry opening rules from the collapse/auto-focus brief: all sections open, Job no. picker focused with its list open (records with a job number), "Completed by" and Title pre-filled from the signed-in user, no restored-draft banner.
- Clear the local autosaved draft for the just-submitted entry so it is not offered again.
- Scroll to the top of the form.

### 3.4 No — back to Records
- Navigate to `RECORDS_LIST_URL` with normal navigation (not `history.back()`).
- Clear the local draft for the submitted entry. No browser "unsaved changes" prompt may appear.

### 3.5 Log out
- Call the existing Auth sign-out, clear any local draft for the submitted entry, then navigate to the sign-in / login screen (the normal signed-out landing). Confirm after logout that opening a record page asks for sign-in again and that no previous user's name/title pre-fills.
- Because the user has just submitted, nothing unsaved can be lost; **no extra "are you sure?" step**.
- If other draft entries exist locally for other records, **leave them in place** (they belong to the user and are restored on next sign-in only if the existing draft logic already allows that; do not change draft logic).

### 3.6 Remember-nothing
No "don't ask again" box and no stored preference. It asks after every successful submit.

## 4. Where it applies

- **All record pages** (~131 on the Record List), in both shared engines and the custom-body records. Implement once as a shared helper (`postSubmitPrompt.show({ recordCode, onAnother, onRecords, onLogout })` in new `public/lib/post-submit-prompt.js`) and call it from each success point. For custom-body records add the single call to their existing submit-success code only.
- **Out of scope:** Dashboard, Job Status Updates, Canning Report, Traceability, login modal, any non-record page. Verification / sign-off actions are not "submits" for this purpose unless Michaela says otherwise (Q4).

## 5. Do NOT change

No field, validation, calculation, DB call, saved `values` key, export column, print sheet or `@media print` output. Do not change how or when data is saved. Do not alter the sign-in / sign-off / passkey logic — only **call** the existing sign-out. No database changes. Do not delete any existing page.

## 6. Test plan

1. REC 7.1.3, 7.1.5, 7.8.1, 7.2.12, one monitoring-log record, one record with no job no.: fill and Submit → entry appears in Entries → pop-up shows with record code and three buttons.
2. **Yes** → same record, fresh form, job picker focused and open (job records), Completed by/Title pre-filled, no draft banner; submit a second entry → pop-up appears again; both entries saved.
3. **No — back to Records** → lands on the Records list; reopen the record → entries present.
4. **Log out** → signed out, on sign-in screen; open a record → asked to sign in; sign in as a different role → Completed by/Title show the new user, not the old.
5. Failed validation → no pop-up; section expands and focuses first invalid field.
6. API error / sleeping Render server → "Connecting…" state, no pop-up until success, no duplicate submit if tapped twice.
7. Offline submit → "Offline — will retry", no pop-up at that point.
8. Edit and re-save an existing entry → per Q3 default, no pop-up.
9. Keyboard: Enter = Yes, Esc does nothing, Tab stays inside dialog; screen-reader label reads the question.
10. Tablet portrait + landscape: three buttons ≥ 48px, Log out clearly separated, nothing hidden under sticky top bar/hamburger, no horizontal scroll.
11. Print preview and CSV export unchanged; pop-up never in print.
12. Bump script version query strings (`form-record.js?v=…`, `monitoring-log.js?v=…`, new `post-submit-prompt.js?v=…`) on **every** record page; confirm none loads an old copy.

## 7. Questions for Michaela (Claude Code proceeds with the bracketed default if unanswered)

1. Button wording OK: "Yes — another page" / "No — back to Records" / "Log out"? [As written.]
2. If a submit was queued offline and succeeds later, ask then? [No — skip for queued submits.]
3. Ask after **editing** an existing entry too? [New entries only.]
4. Should sign-off / verification actions also ask? [No.]
5. After Log out, which screen? [The normal signed-out landing / sign-in screen.]

## 8. Paste-ready prompt for Claude Code

> Read `claude/post-submit-complete-another-page-prompt-instructions.md` and follow it exactly. Add a shared post-submit pop-up (`public/lib/post-submit-prompt.js`, same dialog style as the job details pop-up) asking **"Complete another page?"** after a record is **successfully** submitted, with three buttons: **Yes — another page** (stay on the same record and open a fresh New Entry form using the existing New Entry opening rules, clearing the submitted entry's local draft), **No — back to Records** (navigate to one shared `RECORDS_LIST_URL` constant), and **Log out** (call the existing Auth sign-out — find it first, do not write a second one — then go to the sign-in screen). Hook it at the single "submit succeeded" point in `form-record.js` and `monitoring-log.js`, and add one call to each custom-body record's own submit-success code (e.g. REC 7.2.12). Do not show it on Save draft, Clear, validation failure, errors, offline-queued submits or edits of existing entries. Esc must not dismiss it. Disable Submit while saving. Do not change any field, validation, calculation, DB call, saved value, sign-in/sign-off logic, export or print output. Bump the library version strings on all record pages. First show me REC 7.1.3 and REC 7.2.12, then roll out to all records, run the §6 test plan, and write a work log at `claude/post-submit-prompt-worklog.md`.
