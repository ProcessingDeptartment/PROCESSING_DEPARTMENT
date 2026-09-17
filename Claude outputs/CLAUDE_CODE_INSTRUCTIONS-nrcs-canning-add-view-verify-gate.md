# Instruction file for Claude Code

**Task:** Change how roster rows work on "Production Information NRCS (Canning)" so each row goes
through an explicit **Add record → View record → verification status shown** flow, and make the
NRCS record itself impossible to finalize/submit while any required record is missing or its
verification status is not "Verified."

This is a follow-up to the two prior instruction files already applied to this page
(`claude/nrcs-canning-batch-search-instructions.md` and
`claude/nrcs-canning-production-codes-roster-instructions.md`). Read those first — this task
builds directly on the `recordpick`/`jobtrace` roster columns they added (the "Records for this
job" roster and the new "Production codes" roster).

## What "verified" already means in this codebase — use it, don't invent a new status

Checked `public/lib/monitoring-log.js` and `public/lib/form-record.js`: a submission is not simply
"submitted" or "not submitted" — a **separately signed verification** (`sub.verification`, an
object with `verifiedBy`/`verifiedSig`/`verifiedDate`/`verifiedSignature`) is applied after
submission, by a second person, tracked per entry:
- `isSubmitted(sub)` (`form-record.js` ~line 928) — true once submitted/finalized.
- `!sub.verification` — true while it is still awaiting verification, per
  `pendingForVerification()` in `monitoring-log.js` and the `verification-queue.html` /
  `verifier-assignments.html` pages that already surface this exact "waiting for verification"
  state org-wide.

So "note if not verified" means: **submitted but `sub.verification` is falsy** — not "not yet
submitted at all" (that's a separate, more basic missing state). Both states need to be shown
distinctly on each roster row, because they mean different things to the person filling in NRCS
Canning:
- **Not attached** — no record picked for this row yet.
- **Attached, not submitted** — picked, but the underlying record is still a draft.
- **Attached, submitted, not verified** — the actual "note if not verified" case.
- **Attached, submitted, verified** — the only state that should count toward "all needed records
  are attached and verified."

Do not build a new verification concept for this page. Read the real status off the actual picked
submission (see engine change below) and reuse the codebase's existing three-state model above.

---

## Engine change 1: `jobTraceOptions()` / the trace index must expose submission status

Confirmed in `public/lib/traceability.js`: the trace index row (`baseRow` in `indexSubmission()`)
currently stores only `record_key`, `submission_id`, `stage`, `occurred_on`, `href`, `summary` —
**no status or verification flag**. Status lives on the actual submission object in its own
`formrecord:*`/`monitoring_log:*` store, not in the trace index.

Extend `indexSubmission()`'s `baseRow` to also carry:
```js
status: isSubmitted(sub) ? 'submitted' : 'draft',
verified: !!(sub.verification),
verifiedDate: (sub.verification && sub.verification.verifiedDate) || null
```
(`isSubmitted` already exists in `form-record.js` — reuse the same logic, don't reimplement it;
`monitoring-log.js`'s controls have their own equivalent, reuse whichever applies to the record
being indexed.) This keeps the index as the single place both this feature and anything else
built later can read status from, instead of every consumer having to separately fetch full
submissions just to know verification state.

Re-index existing data: `indexSubmission()` runs automatically on every future save, but rows
already in the index from before this change won't have the new fields until they're resaved.
Check `public/pages/backfill-traceability.html` (already exists in the repo) — if it re-runs
`indexSubmission()` over existing submissions, use it to backfill the new fields after this change
ships; if it doesn't cover this, extend it to, rather than leaving old rows silently missing
`status`/`verified` (they'd otherwise read as "not verified," which happens to be a safe default,
but should be confirmed, not accidental).

## Engine change 2: roster rows need an explicit Add → View → Status lifecycle, not just a picker

Today's `recordpick` column is a single `<select>` — picking a value both "adds" and "views" in
one motion (the roster row's cells fill in), with no separate view step and no visible status.
Change the roster column rendering for `type: 'recordpick'` (in `wireRecordPick`/the field-render
function `form-record.js` ~line 415 area, and the field-HTML-building function that currently
emits `<select id="${id}" data-recordpick="1">...</select>`) to render three things per row
instead of one:

1. **Add / change button** — opens the existing picker (`<select>`, or a small modal listing the
   same `jobtrace` options if a dropdown reads as too cramped for this — reuse whichever pattern
   this codebase already uses elsewhere for "pick one of several items," don't invent a new picker
   UI). Behavior on pick is unchanged from today: still fills whatever `fillCode`/`fillName`/
   `fillMap` columns are configured (per the production-codes-roster instructions).
2. **View link** — once a row has a value, show a "View" link/button using the option's `href`
   (already present in `jobTraceOptions()`'s returned `href` field) that opens the actual picked
   record in a new tab, exactly the way `verification-queue.html`'s "Record" column already links
   out (`<a class="rec" href="...">`) — reuse that same link pattern, don't build a new one.
3. **Status note** — a small inline label/badge next to the row reading exactly one of: "Not
   attached" (no value picked), "Draft — not yet submitted", "Awaiting verification", or
   "Verified (12/03/2026)" (using the new `verifiedDate` from engine change 1). Style it using
   whatever this codebase's existing status-badge classes already are (`submissions-log.html` has
   `.badge-warn`/`.badge-ok`/`.badge-muted`/`.badge-info` — reuse those classes and their existing
   color meaning: warn = awaiting verification, ok = verified, muted = not attached, info = draft,
   rather than inventing new colors).

Add a `required: true` option on a roster column config (e.g. `{ key: 'submissionRef', type:
'recordpick', ..., required: true }`) so each roster (the "Records for this job" roster and the
"Production codes" roster) can independently declare whether it's mandatory for this record. Set
it `true` on both existing recordpick roster columns on this page, since Michaela's instruction is
that NRCS Canning cannot be submitted until all needed records are attached and verified.

## Engine change 3: block finalize/submit until every required roster row is attached + verified

In `saveForm(finalize)` (`form-record.js` ~line 1446), alongside the existing `finalize`-gated
checks (`missingRequired`, `invalidJobNumber`, `routeConflict` — see the existing pattern at
~lines 1451–1473), add an equivalent roster-completeness check:

```js
let rosterIncomplete = null;
(config.rosters || (config.roster ? [config.roster] : [])).forEach(r => {
  (r.columns || []).forEach(col => {
    if (col.type !== 'recordpick' || !col.required) return;
    // read every rendered row's stored status for this column
    const rows = rosterRowsFor(r.key || 'roster'); // use whatever the engine's existing roster-row
                                                     // accessor is called — don't add a second one
    const bad = rows.find(row => {
      const val = row[col.key];
      if (!val) return true;                         // not attached
      const meta = row['__' + col.key + '_meta'];     // wherever the picked option's status data
                                                        // ends up stored per row — wire this to
                                                        // match however fillMap/fillCode already
                                                        // persist per-row data today
      return !(meta && meta.verified);
    });
    if (bad) rosterIncomplete = r.title || 'a required record';
  });
});
if (rosterIncomplete && finalize) {
  toast(`All records in "${rosterIncomplete}" must be attached and verified before this can be submitted.`);
  return;
}
```

Treat the pseudocode above as intent, not literal code to paste — match it to this engine's real
internal names for "the rendered roster rows" and "where a recordpick column's picked-option
status is stored per row" (follow whatever pattern `fillCode`/`fillName`/`fillMap` already use to
persist values from the picked option onto the row, and extend it to also persist `verified`/
`status` the same way, rather than inventing a separate storage path).

Critically: this check must only block **finalize** (the actual Submit action), exactly like the
existing `missingRequired`/`routeConflict` checks — a plain "Save draft" must still work with
incomplete or unverified rosters, since the whole point of a draft is to save partial progress
while waiting on other records to be filed and verified. Confirm this by testing both buttons (see
checklist below).

---

## File to update: `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

Add `required: true` to the `submissionRef` column on both existing rosters on this page:

```js
roster: {
  title: 'Records included — ...',
  columns: [
    { key: 'submissionRef', label: 'Record for this job', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName: 'recordName', required: true },
    ...
  ]
}
```

and on the Production codes roster added in the prior instruction file:

```js
{
  key: 'productionCodes',
  title: 'Production codes for this job — ...',
  columns: [
    { key: 'submissionRef', label: 'Cans Produced record', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', sourceRecordKey: 'cans-produced', fillMap: { productionCode: 'productionCode', nrcsAgCode: 'nrcsAgCode', productDescription: 'brineOrBraised' }, required: true },
    ...
  ]
}
```

Also update the page's `instructions` array to state the new rule plainly for whoever fills this
in, e.g.:

```js
{ label: 'Submitting this record', text: 'Every row in the records tables below must be attached (a specific record picked, not just a record type) and show "Verified" before this NRCS record can be submitted. You can still save a draft at any point while records are still being filed or verified elsewhere.' }
```

---

## Testing checklist

1. Start a new NRCS Canning entry, enter a job number with at least one record already filed but
   **not yet verified** against it. Add that row via the picker. Confirm the row shows "Awaiting
   verification" (not "Verified", not blank).
2. Try to Submit (finalize). Confirm it is blocked with a clear message naming which table is
   incomplete, and no partial data is lost.
3. Click "Save draft" in the same state. Confirm the draft saves successfully — drafts must not be
   blocked by this rule.
4. Go verify that underlying record (via the existing verification queue / sign-off flow), then
   reopen the NRCS Canning draft. Confirm the row's status now reads "Verified" with a date.
5. With every required roster row now verified, confirm Submit succeeds.
6. Test the "not attached at all" case (a required roster with zero rows, or a row with no value
   picked) — confirm it blocks Submit with an appropriate message, distinct from the "attached but
   unverified" case.
7. Confirm the "View" link on an attached row opens the correct underlying record in a new tab.
8. Re-run one of the already-applied prior fixes' test steps (from
   `claude/nrcs-canning-production-codes-roster-instructions.md`) to confirm this change didn't
   regress the fillMap/fillCode auto-population behavior.
