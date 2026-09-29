# REC 7.4.0 Dry Cooking — "Blanching or Cooking" selector

Status: instructions only, no code written. For Claude Code (or Claude Design for the layout part).
Date: 2026-09-29

## 1. What is changing

Add one selector to REC 7.4.0 (record key `dry-cooking`) so the operator states whether this
entry is a **Blanching** run or a **Cooking** run.

## 2. The field

Add near the top of the entry section, directly after the job number / date, before any weights or times:

```js
{ key: 'processType', label: 'Process', type: 'select', required: true,
  options: ['Blanching', 'Cooking'] }
```

- Required for finalize. Draft saves are never blocked.
- Type is a single-choice select (two large tap targets / radio buttons are better than a dropdown on the tablet; follow whatever `mobile-tablet-font-responsiveness.md` recommends).
- No default: the operator must choose, so it can never silently record the wrong process.
- Store the value as plain text `Blanching` or `Cooking` (exact spelling, so it can be grouped and filtered in the database).

## 3. What the selector should drive (confirm before building)

I have not seen the current field list of REC 7.4.0, so these are assumptions to verify against the live page:

1. **Labels.** Any label that says "cooking" (cooking time, cooking temperature, cooking weight, "Total cooking time") should read "Blanching …" when Blanching is selected. Underlying field keys do NOT change, so existing data and REC 7.4.1's link to the cooking date/weight keep working.
2. **Fields that apply to only one process.** If some fields belong to only one process, show/hide them by selector value. Hidden fields are not required and are saved empty.
3. **Targets / limits.** If blanching and cooking have different time or temperature targets, set them per process (in the definition, not hard-coded).
4. **Title on print/PDF.** Print the chosen process on the sheet header so the paper copy shows it.

## 4. Database and traceability

- Add one column on the dry-cooking submission data: `process_type` (TEXT, values `Blanching` / `Cooking`, indexed). Keep it as a real column, not only inside `rawJson`, so trends can be queried directly (e.g. yield by process, weight by process per month).
- Old entries have no value. Do not guess. Show them as "Not recorded", and let the operator set it if they reopen an old draft.
- Trace view (`window.Traceability.trace(jobNo)`): show the process next to the REC 7.4.0 entry (e.g. "Dry Cooking — Blanching").
- Business rule vs REC 7.1.5 OOSW (`capAgainstOtherRecord`) stays as is. Open point: should blanching and cooking weights add together toward the OOSW cap for the job? Default assumption: yes, both draw from the same OOSW total. Do not change the rule unless told.
- Export/migration: `process_type` is one plain text column, so it moves to any other format without conversion.

## 5. Downstream checks

- REC 7.4.1 Drying Process reads cooking date and cooking weight from 7.4.0. Confirm it still picks up blanching runs (same field keys, so it should).
- REC 8.1.7 mock recall and the drying report: decide whether they should display the process type. Not required for v1.

## 6. Do not touch

Other records, the OOSW rule parameters, and the field keys of existing 7.4.0 fields. Bump the `form-record.js` version query string only if the shared library is changed (it should not need to be).

## 7. Testing checklist

1. New entry: selector empty; Finalize is refused until chosen; Draft saves fine.
2. Pick Blanching: labels and visible fields switch as agreed in section 3; pick Cooking: they switch back with no data lost.
3. Submit, reopen, print: process shown correctly on screen and on the PDF.
4. Database: `process_type` populated on the new row; old rows show "Not recorded".
5. Trace a job with a 7.4.0 entry: process appears; REC 7.4.1 still links.
6. OOSW cap warning still fires correctly.
7. Tablet width: selector is easy to tap and does not overflow.

## 8. Open questions for Michaela

1. Are blanching and cooking done on the same batch (both steps, one after the other), or is each batch one or the other? If both can happen on one job, the record may need the selector per batch row rather than once per entry.
2. Which existing fields, if any, apply to only one process?
3. Do they have different time/temperature targets?
4. Should blanching weight count toward the OOSW cap the same way as cooking?
5. Should old entries be backfilled as "Cooking"?
