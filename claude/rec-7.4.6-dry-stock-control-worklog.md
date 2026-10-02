# REC 7.4.6 Dry Stock Control: work log (2026-10-02)

Spec: `MD_CONSOLIDATED/rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` (the `claude/` path in the prompt does not exist).

## Built
- **Definition** (`scripts/apply-dry-stock-control-merge.mjs`, idempotent): one section "Dry stock control", Job no. first (`jobEntry:'merged'`, required). `jiReceivedFrom/jiProcessingFor/jiIntakeWeight/intakeDate` hidden (not deleted, still in CSV, autofill unchanged). `month` hidden and no longer required. `wholeWeight`, `cookingDate`, `noOfTrolleys`, `weightIn`, `weightOut` read-only with `fromRecord` autofill; unlock plus amber note if the source is missing; 10 hidden source-id / typed-manually fields. Definition keys: `progressive`, `financeSignOff`, `signOffTrigger`, `signOffRule: anyHasValue`, `completionFields`. Updated `data/record-definitions.json` and the static mirror `public/data/record-defs/dry-stock-control.json`. Backups in `data/backups/*before*merge*`.
- **Autofill lookups** (`src/index.js`, `/api/dry-monitoring/job-facts`): new sources `dry-cooked-weight` (`v_dry_job_weights.cooked_kg`, Cooking only), `dried-transfer-weight` (sum of `totalDriedWeight`, submitted 7.4.10), `receiving-weight` (`job_info`). Added "Cooked on N dates" / "Trolleys changed" notes.
- **Server guard** (`src/dry-stock-guard.js`, wired into the storage PUT with an advisory lock): submitted stages immutable, `stage_no`/previous/status/`signoff_required`/submitted by+at set server-side, sign-off rule enforced (422), Complete job refuses new stages (409), dropped stages restored.
- **Engine** (`public/lib/monitoring-log.js` v46): Finance representative block (`_fin_` ids) inside the Sign off section, live trigger banner, progressive load (data only, earlier values locked "Entered in stage n", sign-offs always blank), "changed since last submission" chip, draft warning (confirm), status line, one-line-per-job list with stage expander, print of the whole job ("Job so far" plus each stage with its own sign-offs), CSV `stage_no/completion_status/signoff_required` + finance name/date last. `job-picker.js` v8: `merged` sections do not fold or split. `record-chrome.js` v26: progress counter counts autofilled values (7.4.6 only).
- **Database**: migration `prisma/migrations/20261002190000_dry_stock_control_stages` (columns, unique/indexes, 4 views) + `scripts/dry-stock-control-stages-backfill.sql` (dry run, backfill, checks). Prisma models updated; `prisma validate` passes. `src/submission-store.js` writes the stage columns (only if they exist) and numbers old submissions as stages in the projection.

## NOT run / NOT done
- **No SQL was run against Neon, and the definition was not seeded.** Order: backup, `prisma migrate deploy`, run the backfill SQL, deploy code, `node scripts/seed-definitions-only.mjs dry-stock-control` (seeding before the migration would break table sync).
- I could not export the live definition (no DB access here); the JSON edited was the repo copy. Compare before seeding.
- **Admin correction / admin reopen of a Complete job (spec 4.6, 4.11, test 13): not built.** Complete jobs are refused server-side.
- Weight-in/out source-id and typed-manually are stored per stage; "Entered in stage" locking relies on the stored entry, not a DB lookup.
- Old entries whose typed `wholeWeight` differs from receiving were not audited (needs the live data).
- Month readers (trends / period grouping) not audited; Month data kept.

## Fixed on the way
`makeLogController` used an undefined `config` (introduced with REC 7.9.3.1), so every non-custom monitoring-log save threw ReferenceError. Fixed with `const config = traceConfig || {}`. Other monitoring-log pages still load v45 until their `?v=` is bumped.

## Tests (local mock API running the real guard; not Neon)
- `node scripts/test-dry-stock-guard.js`: 28/28 (triggers, 0 counts, dates never trigger, partial sign-offs, immutability, stage numbers, complete lock, drafts, legacy numbering).
- Browser: checklist 1, 2, 3, 4, 5, 6, 7, 9 (direct API), 10, 11, 14 (list/expander), 15 (cooked weight logic is the existing view), 17 (print), 19 (768px, no horizontal scroll); 7.4.2 spot-check unchanged (no finance block, no errors).
- Not tested: 8, 12 (draft warning, written but not exercised), 13, 16 (backfill on real data), 18 beyond 7.4.2.
