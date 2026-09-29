# Finish the Sign-off → "Completed by" migration

## Status

**Already done and safe** (nothing below touches this again):
- Neon DB: 39 `sub_*` submission tables migrated. Old sign-off fields (supervisor, QC,
  checkedBy, verifiedBy, comments, process deviation, etc.) replaced with one `completedBy`
  TEXT column per table. Existing data was copied into `completedBy` before the old columns
  were dropped, so nothing was lost.
- `prisma/schema.prisma` and `data/record-definitions.json` already reflect the new shape.

**Not done yet** — the live app's form engine reads its field config from the
`RecordDefinition` / `RecordSectionDef` / `RecordFieldDef` tables (not from the JSON file
directly), and those haven't been reloaded. Until the 3 steps below run, the app still shows
the *old* Sign-off fields.

## Why this needs a real terminal

`scripts/seed-definitions.mjs` does a full wipe-and-reload of 4 tables (~800+ rows across all
131 records) inside one transaction. It's not something to hand-translate into pasted SQL —
too large and too easy to get wrong by hand. It needs to run as the actual Node script, with
`DATABASE_URL` from `.env` (already in the repo, nothing to configure).

## Steps

Run these from `T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT`, in order:

```bash
npx prisma generate
```
Regenerates the Prisma client to match the already-updated `schema.prisma`. Codegen only,
touches nothing in the database.

```bash
node scripts/seed-definitions.mjs
```
**This is the one that matters.** Reloads `data/record-definitions.json` into the
`RecordDefinition` tables on Neon — this is what makes the live app actually render
"Completed by" instead of the old fields. Expected output looks like:
```
seeded 131 definitions
db now: 131 definitions, ~<N> sections, ~<N> fields, ~<N> autofills
```
If it errors, stop and don't proceed to the next step — send me the error output.

```bash
node scripts/export-record-defs.mjs
```
Reads the just-reseeded tables back out and rewrites `public/data/record-defs/*.json`
(131 files) — this is the offline fallback cache the app serves from while the API wakes up.
Expected output: something like `exported 131 record defs`.

## Cleanup

Two scratch scripts were added for the DB migration and are no longer needed — safe to delete:
```bash
rm scripts/_merge-signoff-models.mjs scripts/_signoff-migration.mjs
```

## Do NOT run

- `npx prisma migrate dev` / `npx prisma db push` / `npx prisma migrate reset` — the live
  schema has some unrelated drift (a few `time`-typed columns stored as TEXT, some extra
  columns on `sub_dry_export_pack_front_page`) that predates this task and is out of scope.
  Those commands would try to "fix" that drift too and could drop/alter columns you don't
  want touched right now.

## After it's done

Spot-check REC 7.1.5 (Salting OOSW), REC 7.1.3 (Salting and Tumbling), and REC 7.1.4
(Washing Control Sheet) in the app — the Sign-off section on each should show a single
"Completed by" text field and nothing else.
