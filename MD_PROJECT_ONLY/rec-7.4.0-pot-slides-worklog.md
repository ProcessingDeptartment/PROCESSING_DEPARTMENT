# REC 7.4.0 pot slides — work log

Date: 2026-10-02. Spec: `rec-7.4.0-pot-slides-blanching-stage-instructions.md`. Status: **built and tested locally; NOT deployed, no database touched.**

## What was built

| Build step | Done | Where |
|---|---|---|
| 1. Database | migration written, not run | `prisma/migrations/20261002130000_dry_cooking_slides/migration.sql`, `prisma/schema.prisma` (`blanchTempC`, `blanchTime`, `potNoOld`, index `(parentId, position)`); data script `scripts/migrate-dry-cooking-slides.mjs` (dry run + `--apply`, per-job check, backup, idempotent) |
| 2. Definition | done | `scripts/apply-dry-cooking-slides.mjs` edits `data/record-definitions.json`; snapshot regenerated with `snapshot-one-def.mjs`; R2/R3 removed from `public/data/business-rules.json` |
| 3. Slide engine | done | `public/lib/form-record.js` v72, behind roster option `slides: true` (only REC 7.4.0 has it) |
| 4. Additions pop-up | done | same file, `openAddition` |
| 5. Sticky batch codes | done | `stickyGet/stickySet`, localStorage `fr_sticky:dry-cooking:<salt\|sugar\|vinegar>`, try/catch wrapped |
| 6. Weight rules | done | `jobWeights.cookFromOosw`: available to cook = OOSW − all Cooking kg; "OOSW not found" when no OOSW record; R1 untouched |
| 7. Print / trace | done | print title `Blanching` / `Pot n — Cooking`; `src/index.js` + `public/records/batch-trace.html` list slides in order with blanching time/temp/salt batch and additions with batch codes |
| CSS | done | `public/styles/record-theme.css` (v tv45), page `REC-7.4.0-dry-cooking.html` bumped to form-record v72 |

Also: `src/validate-submission.js` no longer reports a required roster column as "empty" when its `showWhen` hides it (it was flagging blanching fields on every Cooking row); `src/dry-weight-override.js` keeps R2/R3 ids for old overrides.

## Decisions / deviations from the spec

- **`seq_no`**: not a new column. `sub_dry_cooking_row.position` already is the slide order; the view `dry_cooking_pot` exposes it as `seqNo` (= `rowNo`). Index added.
- **Open items** (defaults used): A = Blanching time is time of day with a "Now" button; B = vinegar in kg; C = sticky codes per device; D = °C; E = cooking salt is an optional addition only.
- Old Blanching cards no longer print the greyed "Temp 20 min after: N/A" line (the column is Cooking-only now).
- Legacy blanching columns are labelled "(old)" and shown read-only only when a stored value exists.
- `abaloneKg` uses `showWhen {Cooking, orNonEmpty}` so old Blanching cards still show their kg, new Blanching slides never ask for it.
- Next on an earlier slide moves forward to the next existing slide (still needs the current slide complete); on the last slide it adds a new one.
- `capRowsAgainstRows` code is left in the engine (generic, unused now).
- Mistake caught and undone: running `scripts/generate-submission-sql.mjs --help` rewrote `prisma/migrations/20260910000000_submission_tables/migration.sql` (the script ignores flags). Restored from git; nothing else changed.

## Tested locally (tablet width 820 px, local static server, no API)

Checklist items 1–6, 8 (screen part), 12, 16 and parts of 7, 11, 15: stage choice; Blanching shows exactly 5 fields in order; Next disabled with hint until complete; chip bar `B, Pot 1, Pot 2, B, Pot 3` for sequence B, C, C, B, C; removing a middle cooking slide renumbers pots; incomplete chip shows a dot; additions pop-up (Save disabled until both values, Esc cancels, backdrop click does not close, Enter saves, untick confirms and clears, sticky batch pre-fills); draft save drops the untouched blank slide and does not block; reopening a draft lands on the first incomplete slide with the page at the top; submit refuses an incomplete slide; available-to-cook arithmetic (500 − 100 − 150 = 250; null without OOSW); another record (REC 7.1.5) still renders its normal roster.

## Not tested yet — needs the real API / database

1. Deploy order: `prisma migrate deploy` → `node scripts/seed-definitions.mjs` → `node scripts/migrate-dry-cooking-slides.mjs` (dry run, check per-job lines say OK) → `--apply` → `node scripts/export-record-defs.mjs`. Beware the Neon advisory-lock P1002 trap on `migrate deploy`.
2. Live OOSW figure and the R1 soft gate against a real job; second entry on the same job; edit of a submitted entry not double counted.
3. A full submit, then PDF/print of an entry with Blanching + Cooking + ticked additions; the `dry_cooking_pot` / `v_dry_job_weights` rows; REC 7.4.1 cooking weight and REC 7.4.2 cooking date for a migrated job (both filter on `process = 'Cooking'` and `abaloneKg`, which the migration leaves unchanged).
4. Portrait tablet (768 px) and on-device keyboard behaviour for the pop-up; Chrome/Safari on the actual tablets.
