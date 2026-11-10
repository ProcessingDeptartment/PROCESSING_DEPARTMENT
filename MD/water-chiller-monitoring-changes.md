# Water & Chiller Monitoring — Record Definition Changes

## Records affected
- `water-monitoring.json` (REC 7.8.9)
- `lha-water-monitoring.json` (REC 7.8.9.1)
- `chiller-temperature-monitoring.json` (REC 7.9.1)

## Changes applied (all three records)
- Removed `month` field
- Removed `date` field
- Removed `time` / `timeOfCheck` entry fields
- Removed `checkedBy` field
- Submission timestamp now serves as the date/time/month log

## Additional changes — Chiller Temperature Monitoring only
- Removed `shift` selector
- Replaced the 5 individual unit fields (`chiller1DialTemp`, `chiller1ProductTemp`, `chiller2DialTemp`, `chiller2ProductTemp`, `freezerDialTemp`) with:
  - `chillerUnit` — dropdown: Chiller 1 / Chiller 2 / Freezer
  - `dialTemp` — number, °C
  - `productTemp` — number, °C (spec-linked, NC threshold)
- Updated `ncThresholds` to reference new `productTemp` field

## Note
JSON files are static snapshots read by the browser. No DB change was needed — only the JSON files were updated and committed.
