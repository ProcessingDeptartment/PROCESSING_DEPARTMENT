# REC 7.4.2 Dry Monitoring: field changes (build summary)

Status as of 2026-09-30: **built and browser-tested locally; NOT deployed or reseeded.** Held until REC 7.4.1 ships (the trolley count reads REC 7.4.1 entries).

## Decisions (Michaela)

| Ref | Decision |
|---|---|
| D-A | Job cooked over several days: use the **newest** cooking date as final (no "cooked on N dates" note). |
| D-B | Dry room areas: **Main dry room, Dry container, Grading room**. |
| D-C | 22 days is the same for every product, farm and season. |
| D-E | Old dry room area text: the table had 0 rows, so nothing to map. |
| D-F | A red answer **prompts** for a comment; it never blocks Submit. |
| Yes/No | Surface shine: Yes = red. Only **Trolleys clearly marked** has Yes = good (green), No = red. |

## The seven changes as built

1. **Date removed.** Replaced by a read-only **Entry date**, stamped when the entry is submitted (Johannesburg date). It heads the print sheet. Old typed Date is kept as `dateOld`, shown "(old)" on old entries.
2. **Cooking date** read-only, from the latest submitted REC 7.4.0 **Cooking** card (Blanching never counts, drafts ignored). No source: amber note, field unlocks, entry flagged `cookingDateTypedManually`.
3. **Dry room area** is a required dropdown with the three areas. Old free text is kept as saved.
4. **No. of trolleys** read-only, from the latest submitted REC 7.4.1 entry that has a count. No source: amber note, unlocks, flagged `trolleysTypedManually`.
5. **Estimated drying date** = cooking date + 22 calendar days, read-only, blank until a cooking date exists. `dryingDaysEstimate` lives in the record definition; changing it affects new entries only. Examples: 2026-09-01 gives 2026-09-23; 2026-12-15 gives 2027-01-06; 2027-01-31 gives 2027-02-22.
6. **QC check and Supervisor removed.** Old values kept as `qcCheckOld` / `supervisorOld`, shown "(old)".
7. **Yes/No colouring.** Per-field `good` flag in the definition (`"No"` = Yes is the problem). Problem answers are red, bold, carry a warning mark and print with a border. Old answers are coloured at display time. Comment field relabelled "Comment / corrective action".

Submit checks: hard block on job number and dry room area; soft "Missing: ..." notice for cooking date, trolley count, estimate.

## Files

| File | Change |
|---|---|
| `Claude outputs/rec-7-4-2-dry-monitoring-columns.sql` | Backups, 8 new columns, old-value copy, 3 views. **Already run in Neon (2026-09-29).** |
| `scripts/apply-dry-monitoring-changes.mjs` | Rewrites the definition (idempotent). |
| `data/record-definitions.json`, `public/data/record-defs/dry-monitoring.json` | Updated definition and offline snapshot. |
| `public/lib/monitoring-log.js` | v38. Stamped dates, `fromRecord` autofill, `addDays`, hidden and legacy fields, red styling and prompt, entry-date sort and filter. |
| `src/index.js` | New `GET /api/dry-monitoring/job-facts/:jobNo`. |
| `public/records/REC-7.4.2-dry-monitoring.html` | Script cache-buster `?v=38`. |
| `prisma/schema.prisma`, `prisma/submission-models.prisma` | New columns added by hand (no migrate). `prisma validate` passes. |

Neon views: `v_dry_monitoring_trolley_check` (now on entry date), `v_dry_monitoring_estimate` (`days_to_estimated_drying`), `v_dry_monitoring_flags` (one row per problem answer). Backups: `bak_sub_dry_monitoring_20260929`, `bak_recordfielddef_dry_monitoring_20260929`, `bak_recorddefinition_dry_monitoring_20260929`.

## Test results (local, stubbed storage and API)

Passed: no Date field; entry date on list and print; cooking date and trolleys autofill; amber notes and unlocking; manual flags; estimate maths; area dropdown and required refusal; job switch clears a copied value; Yes/No colours (all four cases); comment prompt; submit and soft warning; old-format entry opens, lists and prints with "(old)" rows.

Not tested: `dryingDaysEstimate` change, tablet width, a CSV opened in Excel, the real endpoint against Neon, the Neon 22-day query (needs real entries).

## Deploy order (when REC 7.4.1 is live)

1. Deploy the code (files above).
2. `node scripts/seed-definitions.mjs` (loads the new definition and bumps its version). Do this only after step 1: the old engine cannot use the new definition.
3. Write and run the column-drop SQL for `date`, `qcCheck`, `supervisor` (table is empty, so safe).
4. Run: `SELECT "jobNo", "cookingDate", "estimatedDryDate", "estimatedDryDate" - "cookingDate" AS days FROM sub_dry_monitoring ORDER BY "createdAt" DESC LIMIT 10;` and expect 22 on every new row.

## Notes

- Entry date is stamped by the browser (Johannesburg time), because the monitoring-log engine has no server-side stamp.
- Drafts have no entry date until submitted.
- Trolleys will show the amber "fill in REC 7.4.1 first" note until 7.4.1 entries exist.
