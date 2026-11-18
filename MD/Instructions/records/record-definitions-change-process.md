# Changing a record definition (REC forms)

Applies to every form whose config lives in `public/data/record-defs/<recordKey>.json`.

## The rule

The **database is the only place a record definition is changed**. The JSON files are generated from it. Never hand-edit a JSON file, and never commit one that was not produced by the export.

Why: the forms read the committed JSON, but the export overwrites those files from the database. Edits made in only one place get lost. Examples that have already happened:

- the NC auto-close rule (`ncResolutionCondition`) disappeared when a "spec updates" commit regenerated the file from an older copy
- the `scoring` block was removed from the database and auto NC stopped
- 30 committed definitions no longer matched the database

## Steps for any change

1. **Make the change in the database** (Neon console). Run the SQL yourself. Keep it in a `.sql` file in the repo so the change can be repeated.
2. **Export** from the project folder:

   ```bash
   node scripts/export-record-defs.mjs
   ```

   This needs `DATABASE_URL` set. It rewrites every file in `public/data/record-defs/`.
3. **Check what changed** before committing:

   ```bash
   git status --short -- public/data/record-defs
   ```

   If files you did not mean to change are listed, the database has drifted from git. Commit them only if the database is correct; otherwise investigate first.
4. **Commit the JSON the export wrote**, together with any SQL file, in one commit.
5. **Push** to `main` (Render deploys from `main`, about 30–60 seconds).
6. **Test** the form on the live site. Use a hard refresh (Ctrl+Shift+R).

## Do not

- Edit `public/data/record-defs/*.json` by hand.
- Commit a record-def JSON that the export did not produce.
- Run a `scripts/apply-*.mjs` or `scripts/_add-*.mjs` script. Many of them write to `data/record-definitions.json`, which does not exist in this repo, and the others bypass the database.
- Remove a block such as `scoring`, `ncResolutionCondition` or `redPrompt` from the database without checking what reads it. The NC log, PDF and form behaviour depend on them.

## Hiding without removing

To keep a value that the logic needs but not show it, set `"hidden": true` on the field in the database (`extraJson`). Example: score output fields, the NC reference. Do not delete the field.

## Checking the database and files agree

Run the export and then `git status`. A clean result means the committed files match the database.

## Related

- `CLAUDE.md` (project root): architecture, the record definition structure and deployment.
