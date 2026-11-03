# TABLES_AUTHORITATIVE — what it does and when to turn it on

Added 2026-10-19 (steps 1-3 of the storage overhaul). **Off by default.** Setting the Render environment variable
`TABLES_AUTHORITATIVE=1` on the API service changes how every save works:

| | Off (today) | On |
|---|---|---|
| Table update (`sub_*` rows) | after the save commits; a failure is logged and swallowed | **inside the save's transaction**; if it fails the whole save rolls back, so the tables can never lag the list |
| What the guards compare against (drying-process, crate numbers, dry-stock stages) | the saved list (`KeyValue`) | the entries rebuilt from the tables in exact saved order (`position` column), falling back to the list if the tables lack positions |
| Per-entry save merge (`PUT /api/submissions/...`) | merges into the saved list | merges into the entries rebuilt from the tables |

The saved list is still written on every save either way, so switching back is just removing the variable.

## Already live whatever the switch says
- Drying-process guard now runs inside the locked transaction (like crate numbers and dry-stock) — closes a race between two tablets.
- Save transactions get a 30 s timeout (the 5 s default could silently drop table updates on big records).
- Per-entry audit trail: table `SubmissionHistory`, `GET /api/submissions/<record>/<id>/history`.
- `position` column on every `sub_*` table; `node scripts/backfill-positions.mjs --apply` refills it.
- `node scripts/audit-submission-parity.mjs` checks count, order and per-entry content, table vs list.

## Before turning it on
1. `node scripts/backup.js`, then `node scripts/audit-submission-parity.mjs` — all rows must say OK for ok / order / content.
2. Turn it on, do one save on a form-record record, one on a monitoring-log record and one on drying-process, re-run the audit.
3. Watch the Render logs for `entriesInOrder failed` or a save failing with 500. A 500 now means the table update failed
   and nothing was saved (the browser then falls back to the whole-list write, which hits the same error and shows "Save failed").
4. To go back: delete the variable (Render redeploys). Nothing else to undo.

## Not done on purpose
The saved list is not dropped, and `KeyValueHistory` (whole-list before/after) is still written. After the per-entry
trail has run cleanly for a few weeks, stop storing whole-list snapshots for record keys to cap history growth.
