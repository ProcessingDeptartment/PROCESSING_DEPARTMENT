# REC 7.4.3.1 and 7.4.3.2: Totals section starts collapsed (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.3 'totals and sign off' always collapse". Clarified: **only the Totals section starts collapsed.** Sign off stays open like every other section.
**Scope:** REC 7.4.3.1 and REC 7.4.3.2 (the two grading records) only. Display behaviour only. No change to fields, keys, labels, calculations, validation, DB columns, CSV or print content.
**Related:** `record-sections-collapse-and-job-autofocus-instructions.md` (all sections collapsible, all open on load; this is the one agreed exception), `rec-7.4.2-job-info-section-split-instructions.md`.

## 1. Rule

1. On both records, the **Totals** section loads **collapsed** on a new entry, every time. All other sections, including **Sign off**, load **open** as per the collapse brief.
2. This is the only page-level use of `collapsedByDefault: true`. The collapse brief said not to use it anywhere; this brief overrides that for these two records, Totals section only.
3. Totals remains **calculated and read-only**. Collapsing hides it, it does not stop it calculating. Values keep updating while folded.

## 2. Collapsed header shows a one-line summary

So the user can see the result without opening it, the Totals header shows the key figure(s) as muted text, updated live, for example `TOTALS: dried weight 842.5 kg`. Use the figures the section already calculates (confirm which: total dried weight, yield % if present). Blank until values exist, never NaN or 0. If there is no number yet, the header shows only `TOTALS`.

## 3. When it must open

- **User tap on the header:** opens, stays open until the user closes it. Do not re-collapse on recalculation, on typing in other sections, or when a job is picked.
- **Validation failure inside Totals** (if the section has any required or checked field): expand it, scroll to and focus the first problem, show the message.
- **Existing entry or restored draft opened for edit or view:** Totals **open**, same as the other sections (the collapse is for new entries only). Say so back to Michaela if she wants it collapsed there too.
- **Print, PDF, CSV, submitted read-only view:** Totals always **expanded and printed**, regardless of on-screen state.

## 4. Safety checks

- Add the setting in the record definition for these two records (a section flag such as `collapsedByDefault: true` on the Totals section), not a hard-coded section title check in shared code.
- Confirm the Job info auto-collapse still acts only on the job picker section and does not touch Totals (guard from the 7.4.2 brief).
- If a record has no section named Totals, stop and report back. Do not guess another section.
- Bump the `?v=` script strings on both record pages (and `form-record.js` / `monitoring-log.js` if shared code is touched).

## 5. Test

1. New entry on 7.4.3.1 and 7.4.3.2: Totals folded (▸), every other section open (▾), Sign off open and enterable.
2. Enter grading values: folded header summary updates live, no NaN, no 0 placeholders.
3. Open Totals by tap: stays open while typing elsewhere and after recalculation.
4. Pick or change the job: Totals state is not changed by it.
5. Submit with Totals closed: saved totals identical to when it is open. CSV unchanged.
6. Print preview and the submitted read-only view: Totals shown in full.
7. Open an existing entry and a saved draft: Totals open.
8. Tablet width: header tap target at least 44px, no horizontal scroll.

## 6. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.3-totals-section-start-collapsed-instructions.md` and follow it. On REC 7.4.3.1 and 7.4.3.2 only, make the Totals section load collapsed on new entries (Sign off stays open), with a live one-line summary in its header. Use a section flag in the record definition. Totals still calculates while folded, opens when tapped and stays open, always prints and exports expanded, and opens normally for existing entries and drafts. Do not change fields, calculations, DB columns or exports. Bump the `?v=` strings, run section 5 and write a short work log.
