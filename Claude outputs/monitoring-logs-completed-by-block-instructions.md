# Give every monitoring log the same COMPLETED BY block

**Goal:** every record in the system ends with the same block: **Completed by / Title / Date / Signature**, and the name lands in that record's `completedBy` TEXT column in Neon. Form-style records (79) already do this. This file covers the **52 monitoring logs**, which do not.

Status when this was written (2026-09-29): the Neon definitions, `data/record-definitions.json`, the 42 changed offline cache files and `src/submission-store.js` were already updated for the form-style records. Nothing below has been applied yet.

Do the steps in order. Do NOT run `prisma migrate` or `prisma db push` (unrelated schema drift, see SIGNOFF_MIGRATION_TODO.md).

## What the block is

The form-record engine (`public/lib/form-record.js`, around line 1438) renders it with `window.SignOffBlock.completedByHtml({ byId, titleId, dateId, signatureId, gridClass, fieldClass })` (`public/lib/signoff-block.js`). On submit it saves `entry.completedBy = { by, title, date, signature }` and clears the four inputs after saving. It pre-fills "Completed by" from `window.Auth.getCurrentUsername()` (`suggestCompletedBy`). Copy that behaviour exactly.

## Step 1 - Database: add the column to the 52 monitoring-log tables

Run `add-completedby-to-monitoring-log-tables.sql` (sits next to this file) in the Neon SQL Editor. It is `ADD COLUMN IF NOT EXISTS "completedBy" TEXT` per table, in one transaction, and safe to re-run. Two tables (REC 7.2.12, REC 7.6.8) already have the column.

Then keep the schema files in step **by hand, without migrating**: add `completedBy String?` to each of the 52 `sub_*` models in `prisma/submission-models.prisma` and `prisma/schema.prisma` (a few already have it). If `scripts/generate-submission-schema.mjs` builds these models from the definitions, add a rule there so every record gets one `completedBy String?` column, regenerate, diff, and merge only that change. Run `npx prisma generate` afterwards (codegen only).

## Step 2 - Add the block to the monitoring-log page (`public/lib/monitoring-log.js`)

1. **Markup.** In `logBlockHtml(ns, blockTitle, inline)`, inside `fieldsAndActions`, insert between `<div id="${ns}_modalFields" ...></div>` and the `.ml-actions` div:

   - a small label "Completed by" (same style as form-record: `ml-muted`, 10.5px uppercase), then
   - `window.SignOffBlock.completedByHtml({ byId: ns + '_cb_by', titleId: ns + '_cb_title', dateId: ns + '_cb_date', signatureId: ns + '_cb_signature', gridClass: 'ml-grid ml-grid-4', fieldClass: 'ml-field' })`.

   `fieldsAndActions` is shared by the modal and inline layouts and by `customBody` pages (REC 7.2.12, 7.2.4), so one insert covers all 52.

2. **openForm(id).** After the fields are rendered: if editing an entry that has `existing.completedBy`, fill the four inputs from it; for a new entry clear them and pre-fill "Completed by" from `window.Auth.getCurrentUsername()` (add a `suggestCompletedBy` like form-record's, and re-run it on `authSuccess`). When `locked` (submitted entry) disable the four inputs together with the other inputs.

3. **saveForm(finalize).** Read the four inputs into `completedBy = { by, title, date, signature }` (trimmed).
   - Logs with `submitFlow`: only require the block when `finalize` is true. If `window.AUTH_GATES_ENABLED === true` and any of the four is empty, `toast('Completed by, title, date and signature are required to submit.')` and return. Store it on the entry only when `finalize` is true, same as form-record.
   - Logs without `submitFlow` (plain "Save entry"): every save is the completion, so apply the same required check on save and always store it.
   - Set `savedEntry.completedBy = completedBy` in both branches (edit-existing and new entry), next to where `submittedAt` is set.
   - Clear the four inputs in `closeForm()`/after a successful save, like form-record does.

4. **Printed sheet.** In `buildEntrySheet`, the "Completed by:" row currently shows the `operator` role field and leaves Title and Signature blank. Change it to `entryRow.completedBy` (by, title, date, signature), falling back to the old `operator` value and `submittedAt` date for entries saved before this change. Leave the Verified by row alone. `customBody.sheetHtml` pages (7.2.12) must show the same row.

5. **Entry list / CSV / JSON export.** No change needed: the block is stored on the entry, not in `values`. Optionally add "Completed by" as a last column in CSV export.

## Step 3 - Feed the column (`src/submission-store.js`)

`completedByText(entry, values)` and the `blockCompletedBy` check already exist. Change the condition in `getSchema` from `def.engine === 'form-record'` to also include `'monitoring-log'`. It checks `information_schema` for the column once per record, so a table without it can never break saving. Keep the `values.completedBy` fallback so REC 7.2.12 / 7.6.8 values already stored are kept.

## Step 4 - Remove the two old "Completed by" fields on monitoring logs

- **REC 7.2.12** (`double-seam-inspection-report`): entry fields `completedBy` ("Completed by") and `completedDate` ("Completed date"). This is a `customBody` page, so also check `public/records/*7.2.12*.html` for its own inputs and remove them, so it does not show two sign-offs.
- **REC 7.6.8** (`allergen-cleaning-verification`): entry field `completedBy` ("Completed by").

Remove them from the definitions everywhere: `data/record-definitions.json`, the Neon tables (`DELETE FROM "RecordFieldDef" WHERE "recordKey" IN ('double-seam-inspection-report','allergen-cleaning-verification') AND key IN ('completedBy','completedDate')`, then bump `version` on both `RecordDefinition` rows; take a backup copy of `RecordFieldDef` first), and re-export the two files in `public/data/record-defs/` (`node scripts/export-record-defs.mjs`). Only do this after Step 2 is deployed, otherwise those two logs briefly have no sign-off at all. `completedDate` is dropped because the block already has a Date.

## Step 5 - Bump cache-busting

Raise the `?v=` on the `monitoring-log.js` script tag in every monitoring-log page (or wherever the shared shell loads it) so browsers fetch the new file.

## Step 6 - Test before telling anyone it is done

1. Open REC 7.2 (a plain log), REC 7.4.2 (a `submitFlow` log if any), REC 7.2.12 and REC 7.6.8. Each must show the COMPLETED BY block once and no other sign-off.
2. Add an entry, save, reload: the four block values come back when you edit the entry.
3. In Neon: `SELECT "completedBy", "rawJson"->'completedBy' FROM sub_<table> ORDER BY "createdAt" DESC LIMIT 3;` shows the name in the column and the full object in `rawJson`.
4. Print an entry sheet: the Completed by row shows name, title, date, signature.
5. Confirm a form-style record (for example REC 7.1.5) still saves and its `completedBy` column fills.

## The 52 monitoring logs and their tables

- Live Leftovers Log — `live-leftovers-log` → `sub_live_leftovers_log`
- Mortalities Log — `mortalities-log` → `sub_mortalities_log`
- QA1 — `qa1-damaged-cans-and-lids` → `sub_qa1_damaged_cans_and_lids`
- REC 01 — `cans-released-form` → `sub_cans_released_form`
- REC 1 — `gonad-inspection-report` → `sub_gonad_inspection_report`
- REC 7.1 — `incubator-cans-log` → `sub_incubator_cans_log`
- REC 7.1.00 — `fixed-reader-checks` → `sub_fixed_reader_checks`
- REC 7.1.6 — `scrubbing-check-supervisor` → `sub_scrubbing_check_supervisor`
- REC 7.10.2 — `ph-verification` → `sub_ph_verification`
- REC 7.10.3 — `thermometer-verification` → `sub_thermometer_verification`
- REC 7.10.4 — `thermometer-correction-factors` → `sub_thermometer_correction_factors`
- REC 7.2 — `sampling-log` → `sub_sampling_log`
- REC 7.2.10 — `stock-loading` → `sub_stock_loading`
- REC 7.2.12 — `double-seam-inspection-report` → `sub_double_seam_inspection_report`
- REC 7.2.4 — `abalone-packing-specification` → `sub_abalone_packing_specification`
- REC 7.4.1 — `drying-process` → `sub_drying_process`
- REC 7.4.2 — `dry-monitoring` → `sub_dry_monitoring`
- REC 7.4.5 — `boxing-and-labelling` → `sub_boxing_and_labelling`
- REC 7.4.6 — `dry-stock-control` → `sub_dry_stock_control`
- REC 7.4.7 — `labelling-of-dry-boxes` → `sub_labelling_of_dry_boxes`
- REC 7.4.9 — `dry-stock-transfers` → `sub_dry_stock_transfers`
- REC 7.5.1 — `live-production-pack` → `sub_live_production_pack`
- REC 7.5.2 — `live-pack-checklist` → `sub_live_pack_checklist`
- REC 7.5.5 — `receiving-live-returns` → `sub_receiving_live_returns`
- REC 7.6.2.2 — `dispatch-cleaning-inspection` → `sub_dispatch_cleaning_inspection`
- REC 7.6.4 — `chemical-stock-issue-register` → `sub_chemical_stock_issue_register`
- REC 7.6.5 — `internal-pest-sightings-log` → `sub_internal_pest_sightings_log`
- REC 7.6.8 — `allergen-cleaning-verification` → `sub_allergen_cleaning_verification`
- REC 7.7.5 — `glove-issuing-register` → `sub_glove_issuing_register`
- REC 7.7.6 — `plaster-dressing-inspection` → `sub_plaster_dressing_inspection`
- REC 7.7.6a — `first-aid-checklist-record` → `sub_first_aid_checklist_record`
- REC 7.7.7 — `salt-issuing-register` → `sub_salt_issuing_register`
- REC 7.8.1 — `chiller-batch-control` → `sub_chiller_batch_control`
- REC 7.8.1 — `dry-chiller-batch-control` → `sub_dry_chiller_batch_control`
- REC 7.8.11 — `water-tank-inspection` → `sub_water_tank_inspection`
- REC 7.8.2 — `daily-waste-removal` → `sub_daily_waste_removal`
- REC 7.8.3 — `boiler-inspection-report` → `sub_boiler_inspection_report`
- REC 7.8.4 — `seamer-inspection-report` → `sub_seamer_inspection_report`
- REC 7.8.5 — `incoming-ppe-inspection` → `sub_incoming_ppe_inspection`
- REC 7.8.5.1 — `incoming-goods-inspection-log` → `sub_incoming_goods_inspection_log`
- REC 7.8.6 — `cans-incoming-inspection` → `sub_cans_incoming_inspection`
- REC 7.8.6.1 — `lids-incoming-inspection` → `sub_lids_incoming_inspection`
- REC 7.8.6.2 — `lids-incoming-inspection-internal` → `sub_lids_incoming_inspection_internal`
- REC 7.8.7 — `incoming-goods-inspection` → `sub_incoming_goods_inspection`
- REC 7.8.8 — `dispatch-loading-inspection-checklist` → `sub_dispatch_loading_inspection_checklist`
- REC 7.8.8.1 — `dispatch-receiving-checklist` → `sub_dispatch_receiving_checklist`
- REC 7.8.9 — `water-monitoring` → `sub_water_monitoring`
- REC 7.8.9.1 — `lha-water-monitoring` → `sub_lha_water_monitoring`
- REC 7.9.1 — `chiller-temperature-monitoring` → `sub_chiller_temperature_monitoring`
- REC 7.9.2 — `incubator-temperature-check` → `sub_incubator_temperature_check`
- REC 7.9.3.1 — `dry-room-temp-humidity-log` → `sub_dry_room_temp_humidity_log`
- REC 7.9.3.2 — `grading-room-temp-humidity-log` → `sub_grading_room_temp_humidity_log`

## Known limits

- Entries saved before this change have no block. Their column stays as it was (empty, except 7.2.12 / 7.6.8 where it holds the old field value) until the entry is saved again.
- Title, date and signature are kept in `rawJson`, not in their own columns. If you want to query them, add three more TEXT/DATE columns later.
