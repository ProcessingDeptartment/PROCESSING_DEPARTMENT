# Draft-source warning on job-scoped record forms

**Date:** 2026-09-07
**Engines:** `form-record.js` v22 → v23, `monitoring-log.js` v21 → v22

## Request

When an operator selects a job on a job-scoped record form, but the Abalone
Receiving document (REC 7.1.2) that opened that job is still a **draft**,
highlight the affected fields yellow and show a warning note.

## Background — what already existed

Both engines already had a "provisional value" mechanism:

- `wireAutofill` looks up the job's source record. If `found.__status` is not
  `'submitted'`, any value it copied in was marked with `markProvisional()` —
  `data-provisional="1"` + the `.fr-provisional` / `.ml-provisional` class
  (pale-yellow background `#fdf7ea`, amber border).
- `renderProvisionalNotice` prepended a notice to the form.
- `refreshProvisional` (on save) re-pulled those values and **blocked Submit**
  while the source was still a draft; draft saves were always allowed.

## The gap

The yellow highlight and the notice only appeared for fields the autofill
**actually filled on that pick**. They did not fire when:

- the read-only Job info snapshot fields (`jiReceivingDate`, `jiReceivedFrom`,
  `jiProcessingFor`, `jiIntakeWeight`) already carried the job's values, or
- the page was one of the ~18 dedupe pages where the `ji*` field + its `fill`
  entry were removed and nothing new gets filled.

So on many forms, picking a job whose receiving record was still a draft gave
**no visible warning at all**, even though Submit was still (silently) blocked.

## Change

`wireAutofill` in both engines — inside the `rule.fill` loop:

- Still autofills empty targets exactly as before.
- Now **also** flags a target provisional when the source record's
  `__status !== 'submitted'` **and** the target is either `readOnly` (the Job
  info snapshot fields) or was just filled — regardless of whether a fresh value
  was written this pick.
- A field the operator typed into themselves (not read-only, already has a
  value) is left untouched, so nothing they entered gets overwritten by
  `refreshProvisional` on save.
- When the source flips to `submitted`, the flag is cleared on all targets.

Warning-notice copy rewritten in both engines to name the situation:

> Warning: the Abalone Receiving record (REC 7.1.2) for this job is still a
> draft. The highlighted fields are provisional — they will be refreshed when
> you save. This entry can be saved as a draft, but not submitted as final
> until that receiving record is submitted.

`refreshProvisional` and the Submit block are unchanged — they already keyed off
`data-provisional="1"`, which is now set on the whole Job info block.

## Files touched

| File | Change |
|---|---|
| `public/lib/form-record.js` | `wireAutofill` fill loop; notice text |
| `public/lib/monitoring-log.js` | `wireAutofill` fill loop; notice text |
| `public/records/*.html` (129 pages) | cache-bust bump: `form-record.js?v=23`, `monitoring-log.js?v=22` |
| `scripts/wire-jobinfo.js` | left as-is (historical migration constants) |

## Verification

- `node -c` passes on both engine files.
- No end-to-end browser check: requires a seeded draft REC 7.1.2 plus the
  `/api/lookup/...` backend, and another session's dev server currently occupies
  the working folder.

## Follow-ups / watch-outs

- The trigger is "source record `__status` is not `submitted`". It relies on the
  autofill `fill:` map still listing the read-only Job info fields (or the
  page's own equivalent field on dedupe pages). Pages with no `fill` targets at
  all would still show nothing — none are expected in the current rollout.
- Deferred forms (REC 7.1 incubator-cans-log, 8.1.x mock-recalls) were out of
  scope for the Job info block and are unaffected.
