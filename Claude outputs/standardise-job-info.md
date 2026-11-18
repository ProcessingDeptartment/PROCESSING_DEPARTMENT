# Standardise Job Info Sections Across All Record Definitions

## Goal

Every printed record's job info table must show **exactly these 4 fields in this order**:

1. **Job number** — label: `Job number`
2. **Harvest farm** — label: `Harvest farm`
3. **Intake date** — label: `Intake date`
4. **Whole weight (Kg)** — label: `Whole weight (Kg)` (capital K)

Apply to **all** `public/data/record-defs/*.json` files.

---

## Field key mappings

| Canonical label | Known field keys in existing files |
|---|---|
| Job number | `jobNo` |
| Harvest farm | `harvestFarm`, `jiReceivedFrom`, `receivedFrom` |
| Intake date | `intakeDate`, `jiReceivingDate`, `receivingDate` |
| Whole weight (Kg) | `jiIntakeWeight`, `intakeWeight` |

---

## Two JSON formats — handle both

### Format A — `sections` array

Files have a `sections[]` array. Find the section with `"title": "Job info"`.

- Keep only the 4 canonical fields (matched by key from table above)
- Fix the `label` on each kept field to the canonical label
- Sort kept fields in the order: job number → harvest farm → intake date → whole weight
- Remove any other fields:
  - If `readOnly: true`, `hidden: true`, or `type: "timestamp"` → drop silently
  - Otherwise → move to a new section called `"Process details"` inserted immediately after `"Job info"`
- Clean `summaryField` on the Job info section: remove any keys that were dropped/expelled; if empty afterwards, set to `["jobNo"]`

### Format B — `entryFields` array

Files have an `entryFields[]` array where fields carry `"group": "Job info"`.

- For fields with `group: "Job info"`:
  - If the key is one of the 4 canonical keys → keep it, fix its label, keep the `group`
  - Otherwise → remove the `group` property (field stays in the form, just no longer in the job info panel)
- Also fix labels on any of the 4 canonical keys that appear **without** `group: "Job info"` (they may appear elsewhere in entryFields)

---

## Skip list

Do **not** modify `canning-inspection.json` — its "Job info" section contains production codes (Date of Production, Production Code, Product Description), not farm/job info. Leave it completely unchanged.

---

## Detection: does a Job info section contain standard fields?

Before modifying any "Job info" section/group, check that it actually contains at least one of the harvest/intake/weight keys. If a "Job info" section exists but contains none of those keys, leave it untouched (it's a different kind of job info for that record type).

---

## After modifying files

1. Run `node scripts/export-record-defs.mjs` if `DATABASE_URL` is available — this re-exports from the DB and would overwrite the JSONs. **Skip this step** — the JSONs ARE the source of truth being fixed here; do not overwrite them.
2. `git add public/data/record-defs/`
3. `git commit -m "Standardise job info sections across all record definitions"`
4. `git push` → Render auto-deploys in ~30 seconds

---

## Expected changes per file (reference)

Files where extra fields should be **dropped** (readOnly/hidden):
- `drying-process.json` — drop `jiProcessingFor`, `entryDate`, `cookedWeight`
- `dry-cooking.json` — drop `jiProcessingFor`, `ooswKg`, `cookingDate`
- `dry-monitoring.json` — remove group from `jiProcessingFor`, `cookingDate`, `cookingDateSourceIds`, `cookingDateTypedManually`, `noOfTrolleys`, `trolleysSourceSubmissionId`, `trolleysTypedManually`
- All other records with `jiProcessingFor` as readOnly — drop it

Files where extra fields should be **expelled to "Process details"** (data-entry fields):
- `abalone-receiving.json` — expel `toBeProcessedFor`, `lotBarcode`
- `salting-and-tumbling.json` — expel `date`, `processingFor`, `lotBarcode`
- `basket-removal-shucking-gutting.json` — expel `processingFor`
- `scrubbing-checklist-qc.json` — expel `date`
- `salting-oosw.json` — expel `processingFor`
- `gonad-inspection-report.json` — expel `processingFor`

---

## Verification

After the script runs, spot-check these files in the browser at `https://processing-department.onrender.com`:
- Open any record form → Print preview → confirm job info table shows exactly the 4 fields with correct labels
- Check `drying-process.json` (had most extra fields)
- Check `abalone-receiving.json` (had expelled fields — Process details section should now appear in the form)
