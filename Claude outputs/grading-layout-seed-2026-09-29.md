# Grading log layout: seeded to Neon (2026-09-29)

REC 7.4.3.1 (cultivated) and 7.4.3.2 (ranched) Collection bins card layout is now live in the database.

## Verification
- `node scripts/verify-definitions.mjs` **fails: 25 records** (sign-off sections / fields on the page but not in the definition, e.g. factory-maintenance-inspection, supplier-questionnaire, 7.6.x cleaning records, 7.7.x registers).
- The same 25 fail against the HEAD version of `data/record-definitions.json`, so they **predate the grading edits**. Neither grading record is among them.

## What differs from HEAD in `data/record-definitions.json`
| Record | Source |
|---|---|
| grading-production-log-cultivated | grading bin-card layout (this work) |
| grading-production-log-ranched | grading bin-card layout (this work) |
| drying-process | recent drying-process work (NOT seeded) |
| dry-monitoring | recent drying-process work (NOT seeded) |

The other 127 records are unchanged.

## What was seeded
- Full `seed-definitions.mjs` was **not** run (it wipes and reloads all 131 definitions and would have pushed the unfinished drying-process changes and the 25 mismatching records).
- Instead `scripts/seed-grading-only.mjs` (untracked one-off) deleted and reloaded only the two grading records in one transaction.
- Result: `seeded 2 definitions`; DB still 131 definitions, 224 sections, 1780 fields, 45 autofills.

## Live check
`GET /api/record-def/grading-production-log-{cultivated,ranched}`: one roster each with `cardLayout: true`, 8 columns, every column has a `layoutRow`.

## Follow-ups
- Hard-refresh (Ctrl+Shift+R) the grading pages on each device.
- Nothing committed or pushed.
- drying-process / dry-monitoring still need seeding once the 7.4.1 entry-log work ships; the 25 verify failures still need fixing before a full reseed.
- Cleanup stopped four Node processes, including any `npm run dev` you had running; restart it.
