# Archive System

## Purpose

A permanent, human-readable archive of all completed and versioned documents in the processing system. Everything saved to a shared folder (`PROCESSING ARCHIVE\`) beside the repo on the T drive, accessible to all LAN users via the local server.

---

## What gets archived and when

| Trigger | Content archived |
|---|---|
| Record definition changes (before `export-record-defs.mjs` runs) | Old version of the record-def JSON config |
| Completed record is verified (verification_log key written) | All submission entries for that group |
| Policy or procedure revision saved | Document content at that revision |

---

## Archive folder structure

Lives at `T:\Abagold Processing Facility\20. Paperless\PROCESSING ARCHIVE\` (one level up from the repo — same level as `DB ARCHIVE`). Configured via `ARCHIVE_OUT` env var if a different path is needed.

```
PROCESSING ARCHIVE\
  index.json                          ← central index, read by the browse page
  record-defs\
    <recordKey>\
      <version>_<YYYY-MM-DD>.json     ← machine-readable, used to restore
      <version>_<YYYY-MM-DD>.html     ← human-readable, opened by staff
  completed-records\
    <recordKey>\
      <YYYY-MM>\
        <jobNo>_<YYYY-MM-DD>.json
        <jobNo>_<YYYY-MM-DD>.html
  policies\
    <key>\
      <version>_<YYYY-MM-DD>.json
      <version>_<YYYY-MM-DD>.html
  procedures\
    <key>\
      <version>_<YYYY-MM-DD>.json
      <version>_<YYYY-MM-DD>.html
```

---

## Files to create

### `scripts/archive-writer.js`

Shared utility required by all archive triggers. Exports:

- `writeArchiveEntry({ type, key, label, title, data, html })` — writes `.json` and `.html` to the correct subfolder and appends an entry to `index.json`. Never throws. Resolves archive root from `ARCHIVE_OUT` env var or `../../PROCESSING ARCHIVE` relative to the script.
- `buildHtmlPage({ title, archivedAt, bodyHtml })` — wraps a body block in a minimal self-contained HTML page (inline styles, no external dependencies, prints cleanly). Header bar shows title + archived timestamp.
- `recordDefToHtml(config)` — renders a record definition config object as readable HTML tables (metadata, sections list, field details per section, roster columns).
- `submissionToHtml(recordKey, jobNo, entries, recordConfig)` — renders submission entries as readable HTML field grids. Uses record config to show field labels instead of raw keys. Each entry shows its status badge (draft / submitted / verified).
- `archiveRoot()` — returns the resolved archive root path.

The `index.json` maintains entries newest-first, keyed by `{ type, key, label, archivedAt, htmlPath, jsonPath, title }`. Re-running the same label/key/type replaces rather than duplicates.

---

### `scripts/archive-record-defs.mjs`

Run **before** `export-record-defs.mjs` to archive any record definition that is about to change.

Behaviour:
1. Reads all record keys from the DB via Prisma.
2. For each, reads the current on-disk snapshot from `public/data/record-defs/<key>.json`.
3. Fetches the current config from the DB via `assembleRecordConfig`.
4. If the SHA-256 of the on-disk snapshot differs from the DB version, archives the on-disk version (the old one) using `archive-writer.js`.
5. Label format: `<safever>_<YYYY-MM-DD>` where `safever` comes from `config.version` or `config.docCode`.
6. Safe to re-run. Identical content is skipped.

Usage:
```
node scripts/archive-record-defs.mjs [--archive-out "<path>"]
```

Recommended usage order:
```
node scripts/archive-record-defs.mjs
node scripts/export-record-defs.mjs
```

---

### `src/archive-completed-record.js`

Called by the API after a `verification_log:` key is written. Exports:

- `maybeArchiveOnVerify(prisma, recordKey, entries, { jobNo })` — checks if all entries are `verified`, then calls `archive-writer.js`. Never throws (wraps in try/catch). Loads the record config from the static snapshot in `public/data/record-defs/` (no extra DB call).

Month subfolder (`YYYY-MM`) keeps completed-records directories manageable.

---

### As built (2026-11-10) — differences from the plan above

- **JSON is stored separately.** Pages staff open stay at `<type>\<key>\...\<label>.html`; the machine-readable copy is at `json\<type>\<key>\...\<label>.json` (same path under a `json\` folder).
- **Extra types:** `sops\` and `prps\` alongside `policies\` and `procedures\`.
- **Every archived page has two buttons:** "Print / Save as PDF" and "Download Word document" (a `.doc` Word opens directly). Both are hidden on the printout.
- **Filling the archive is done by scripts run on the office network**, because the API runs on Render and cannot write to the T drive. Run all three; each is read-only against the database and safe to re-run or schedule:

```
node scripts/archive-record-defs.mjs        # old version of any record template about to change (run before export-record-defs)
node scripts/archive-documents.mjs          # current policies, procedures, SOPs, PRPs and record templates
node scripts/archive-completed-records.mjs  # all submitted records
```

### `scripts/archive-pdfs.mjs` — real PDFs, identical to the online print

Run after the two scripts above. One local command; no API or server needs to be running.

1. For every archived record entry it opens the site's own print page (`pages/print-entry.html?...&printonly=1`) in headless Chrome/Edge and saves the PDF; for every policy, procedure, SOP and PRP it prints the document page itself with its print stylesheet. The output is therefore the same PDF a user gets printing online (header block, revision, sign-off rows).
2. PDFs are saved to `pdf\<same path as the page>.pdf` (one per entry) and listed on the item in `index.json` (`pdfPaths`); the browse page shows a PDF button.
3. How it reads the data: for the duration of the run only, it starts a private copy of the API code protected by a random one-time key, with the hourly unverified-records e-mail job switched off, behind a local web server that forwards GET requests only. The run cannot change the database and sends no e-mails. Both stop when the script ends.
4. Skips items whose PDF is already saved and whose content has not changed; `--force` re-makes everything.
   - **Records: only verified entries get a PDF.** A submitted-but-unverified entry has none (any existing one is deleted); it is made on the first run after the entry is verified. Documents have no verification step and always get one.
   - The PDF is saved only when the site's print sheet is really finished (it drives the browser directly and waits for the engine's hand-over and for photos to load), never after a fixed delay.
   - If the site shows "Print not available yet" (print lock on REC 7.4.1 / 7.4.2 until REC 7.4.10 is done for the job), no PDF is saved and it is retried on later runs.
5. Record templates get no PDF (there is no online print of a blank template).

```
node scripts/archive-pdfs.mjs [--type completed-record|policy|procedure|sop|prp] [--record <key>] [--limit N] [--force] [--workers N] [--archive-out "<path>"]
```

### CSV files

`archive-completed-records.mjs` also writes `csv\<recordKey>.csv` (one row per submission, one column per field) and `csv\<recordKey>_rows.csv` (repeating rows such as steams), refreshed on each full run. These are separate from the nightly whole-table exports in `..\DB EXPORTS\`.

### `scripts/full-db-export.cjs` — one-off complete database export

Exports every table and view to CSV, including empty tables (header row only), with `_manifest.csv` listing the row count in the database against rows written. Read-only.

```
node scripts/full-db-export.cjs "..\DB FULL EXPORT <date>"
```

### `scripts/archive-completed-records.mjs`

Archives **all submissions** (drafts excluded), verified or not.

1. Reads every `sub_<recordKey>` table plus the verification log.
2. Writes one page per record + job + submission day: `completed-records\<recordKey>\<YYYY-MM>\<jobNo>_<YYYY-MM-DD>`. Records with no job number get one page per day (`log_<YYYY-MM-DD>`). Days are facility time (UTC+2).
3. Each entry shows a `submitted` or `verified` badge; verified entries carry who verified them.
4. The job number is read from `entry.values[<batchField>]` (entries keep their form fields under `values`).
5. A group already archived with identical content is skipped; a group that changed (new entry, edit, now verified) is rewritten.

```
node scripts/archive-completed-records.mjs [--since YYYY-MM-DD] [--record <recordKey>] [--verified-only] [--archive-out "<path>"] [--dry-run]
```

### `scripts/archive-documents.mjs`

Archives the **current version** of every controlled document and record template.

1. Policies, procedures, SOPs and PRPs: reads the content each page in `public\<folder>\` passes to `<Type>Doc.mount(...)`, then applies edits (`policy_doc:` / `procedure_doc:` / `sop_doc:` / `prp_doc:`) and revision history (`document_revision:`) saved in the database — the same merge the page does. The blank `*-Create.html` pages are skipped.
2. Record templates: every `public\data\record-defs\*.json`.
3. Label: `<doc no.>_rev<N>_<revision date>` for documents, `<docCode>_<date archived>` for templates.
4. Anything already archived with identical content is skipped. An edit or a revision bump produces a new archived copy, so earlier versions are kept.

```
node scripts/archive-documents.mjs [--no-db] [--archive-out "<path>"] [--dry-run]
```

---

### Hook into `src/index.js`

1. Add require at the top:
   ```js
   const { maybeArchiveOnVerify } = require('./archive-completed-record');
   ```

2. Inside `handlePut`, in the `Promise.all` block that runs after the transaction (alongside `syncStockLinks`, `syncGovernanceKey` etc.), add:
   ```js
   k.startsWith('verification_log:') ? safe('archiveOnVerify', async () => {
     const recordKey = k.slice('verification_log:'.length);
     let submissionIds = [];
     try {
       const log = JSON.parse(v);
       if (Array.isArray(log)) submissionIds = [...new Set(log.flatMap(e => Array.isArray(e.entryIds) ? e.entryIds : []))];
     } catch { return; }
     if (!submissionIds.length) return;
     let rows = [];
     try {
       rows = await prisma.$queryRawUnsafe(
         `SELECT id, status, "rawJson" FROM "sub_${recordKey.replace(/-/g,'_')}" WHERE id = ANY($1::text[])`,
         submissionIds,
       );
     } catch { return; }
     const entries = rows.map(r => {
       let parsed = {};
       try { parsed = JSON.parse(r.rawJson) || {}; } catch {}
       return { id: r.id, status: r.status, ...parsed };
     });
     const jobNo = entries[0] ? (entries[0].jobNo || entries[0].job_no || null) : null;
     await maybeArchiveOnVerify(prisma, recordKey, entries, { jobNo });
   }) : null,
   ```

---

### Hook into `server.js`

Add after the OPTIONS handler, before the main file-serving block. Requires a constant for the archive root:

```js
const ARCHIVE_DIR = process.env.ARCHIVE_OUT || path.resolve(__dirname, '..', 'PROCESSING ARCHIVE');
```

Two routes:

**`GET /api/archive/index`** — reads and returns `ARCHIVE_DIR/index.json`. Returns `[]` if the file does not exist yet.

**`GET /api/archive/file/<relpath>`** — serves any file inside `ARCHIVE_DIR`. URL-decode the path, normalise slashes, resolve against `ARCHIVE_DIR`, check the result starts with `ARCHIVE_DIR` (directory traversal guard), serve with correct MIME type.

Also update the startup `console.log` to print `Archive: <ARCHIVE_DIR>` so the operator knows where it is.

---

### `public/pages/archive.html`

Browse page served by `server.js` at `/pages/archive.html`. Links back to `/` (dashboard).

Features:
- Fetches `/api/archive/index` on load.
- Filter bar: free-text search (matches title, key, label), date-from, date-to.
- Type tabs: All / Completed Records / Record Definitions / Policies / Procedures.
- Results table: type badge, key, title, archived date+time, Open (HTML) button, JSON link.
- Empty state and loading state.
- Error message if the index cannot be loaded (server not running / archive not yet created).
- Self-contained — no external scripts or stylesheets.

---

## Cleanup required

The following files were created in error and must be removed from the repo:

```
git rm scripts/archive-writer.js
git rm scripts/archive-record-defs.mjs
git rm src/archive-completed-record.js
git rm public/pages/archive.html
git commit -m "Remove wrongly-committed archive stubs"
```

`src/index.js` and `server.js` were also modified in error — restore them from git before implementing:

```
git checkout src/index.js server.js
```

Then implement cleanly from these instructions.
