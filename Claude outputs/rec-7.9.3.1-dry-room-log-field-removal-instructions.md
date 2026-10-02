# REC 7.9.3.1 Dry Room Temp/Humidity Log: remove Week, Shift, Date

**For:** Claude Code (no design work needed, this is a small field change)
**Record:** REC 7.9.3.1, slug `dry-room-temp-humidity-log`, table `sub_dry_room_temp_humidity_log`
**Save this file in the repo `MD/` folder.**

## 1. The change

Remove these three fields from REC 7.9.3.1:

- Week
- Shift
- Date

Keep only these three:

- Room
- Temperature
- Humidity

Nothing else on the record changes: the Completed by block (Completed by / Title / Date / Signature), Comments, Deviations and the work instruction text stay as they are.

## 2. Rules (traceability and data safety come first)

- **Do not delete any stored data.** Entries already saved keep their Week, Shift and Date values. Move them to `week_old`, `shift_old`, `date_old` (same types as before), shown labelled "(old)" on view and print of old entries only. Never on new entries.
- **Do not lose the date of a reading.** Removing the typed Date must not remove the ability to see trends over time. Add a server-stamped `entry_date DATE` and `entry_time TIMESTAMPTZ` (set when the entry is created, not typed). The date and time stamp is automatic (decided): the user never types or edits it. Show Entry date and time read-only on screen and print. If a reading needs a date or shift later, it comes from these, so no information is lost, only the typing is.
- **Old entries:** backfill `entry_date` from the old typed Date where it parses as a date, otherwise from `createdAt`. List any old Date values that could not be read so Michaela can fix them by hand. No guessing.
- The Completed by Date is the sign-off date and is **not** the removed Date. Leave it alone.

## 3. What to do, in order

1. List the current fields and keys of REC 7.9.3.1 back to Michaela (key, label, type, required) so we agree exactly which three are being removed. Do not assume the keys.
2. Check what else reads the three removed keys: lists sorted or filtered by date, the Traceability view, any report, CSV export, thresholds, and the Temp/Humidity warning logic. Switch every one to `entry_date`.
3. Write one SQL file for the Neon SQL Editor, in one transaction, safe to re-run (`ADD COLUMN IF NOT EXISTS`). First take a backup copy of `sub_dry_room_temp_humidity_log` and the `RecordFieldDef` rows for `dry-room-temp-humidity-log`. Then add `week_old`, `shift_old`, `date_old`, `entry_date`, `entry_time`. Copy the old values across, and backfill `entry_date`. Show before and after row counts.
4. Update the record definition: remove the three fields, keep Room, Temperature, Humidity. Bump `version` on the `RecordDefinition` row, update `data/record-definitions.json`, update the two `prisma` schema files by hand (no migrate), and run `node scripts/export-record-defs.mjs` for the offline cache. Raise the `?v=` cache-buster on the scripts loaded by this page. **Stop here for review.**
5. Page and print: only Room, Temperature, Humidity (plus the system Entry date and the unchanged Completed by block). Old entries still open fine and show the old values labelled "(old)".
6. Run the checklist below and report pass or fail per item.

## 4. Testing checklist

1. Open REC 7.9.3.1 and click New: only Room, Temperature, Humidity are asked. No Week, Shift or Date field on screen, on print, or in the list.
2. Submit a new entry: it saves, Entry date is today and read-only, and the existing Temperature range check (25 to 32 degrees C) still warns on a deviation.
3. Submitting with Room, Temperature or Humidity empty behaves as it did before (same required rules).
4. Open an entry saved before this change: it opens, old Week, Shift and Date show labelled "(old)", and nothing is lost.
5. In Neon: `SELECT entry_date, room, temperature, humidity, week_old, shift_old, date_old FROM sub_dry_room_temp_humidity_log ORDER BY "createdAt" DESC LIMIT 20;` shows every old row with its old values intact and a filled `entry_date`.
6. Row count before equals row count after.
7. Trends still work: `SELECT entry_date, room, AVG(temperature), AVG(humidity) FROM sub_dry_room_temp_humidity_log GROUP BY entry_date, room ORDER BY entry_date;` returns sensible rows for old and new entries.
8. Completed by block (Completed by / Title / Date / Signature) is unchanged and still the last block.
9. Print and CSV export open cleanly, no removed columns, dates in ISO format.
10. REC 7.9.3.2 Grading Room is untouched (see D-A).
11. Tablet width readable, fields easy to tap.

## 5. Decisions for Michaela (defaults used if no answer)

- **D-A** Apply the same change to REC 7.9.3.2 Grading Room Temp/Humidity Log? Default: no, only 7.9.3.1 as asked.
- **D-B** Room: is it already a dropdown with the agreed room list, or free text? Default: leave it as it is now.
- **D-C** Several readings a day per room used to be separated by Shift. Without Shift, two readings in one day look the same except for their entry time. Default: allowed, told apart by `entry_time`. Say if you want a rule of one reading per room per day.
- **D-D** DECIDED by Michaela: the date and time stamp is automatic. The typed Date goes and the system stamps `entry_date` and `entry_time` on every new entry. Nobody types or edits them.
