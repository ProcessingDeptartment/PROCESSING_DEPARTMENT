# Task: Skip unchanged records during export

## Goal
`scripts/export-record-defs.mjs` currently re-exports every record definition on every run. After this change, it should skip any record whose existing JSON snapshot is **at least as recent** as the record's `updatedAt` timestamp in the DB — i.e. don't overwrite a file that already reflects the current DB state.

## How it works
- `RecordDefinition` has an `updatedAt` field (auto-updated by Prisma on every edit)
- The exported JSON lives at `public/data/record-defs/<recordKey>.json`
- If that file exists and its `mtime ≥ record.updatedAt`, the record hasn't changed since the last export → **skip it**
- If the file is older than `updatedAt`, or doesn't exist → **write it** (existing behaviour)
- A `--force` flag bypasses the check and writes everything (useful for full re-exports)

## Changes to `scripts/export-record-defs.mjs`

1. **Select `updatedAt`** in the `findMany` query:
   ```js
   const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true, updatedAt: true } });
   ```

2. **Check mtime before writing**, inside the loop:
   ```js
   const force = process.argv.includes('--force');
   // …inside the loop…
   const outPath = path.join(OUT, encodeURIComponent(recordKey) + '.json');
   if (!force) {
     try {
       const stat = fs.statSync(outPath);
       if (stat.mtimeMs >= updatedAt.getTime()) {
         console.log('skip (up-to-date)', recordKey);
         continue;
       }
     } catch {
       // file doesn't exist — fall through to write
     }
   }
   ```

3. **Update summary log** to distinguish skipped vs written:
   ```js
   console.log(`wrote ${n} / ${defs.length} definitions (${defs.length - n} up-to-date) to ${path.relative(ROOT, OUT)}`);
   ```

## Notes
- The `--force` flag should appear in the script's header comment so it's discoverable.
- Do not change the output format or file naming — only the skip logic is new.
- Skipped records still count toward `defs.length` in the summary but not toward `n`.
