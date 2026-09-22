# Time fields → clock selector

All record fields whose label is a point-in-time (not a duration) were changed from a plain
text box to a native clock/time picker (`<input type="time">`), or `datetime-local` for the two
combined date+time fields.

## Engine change
- `public/lib/form-record.js`: added `datetime` field-type support (`<input type="datetime-local">`).
  `time` support already existed. `monitoring-log.js` already supported both.

## Data change
- `data/record-definitions.json`: 47 fields changed `type: "text"` → `"time"` (45) or `"datetime"` (2).
- 26 of those fields also live inline in 14 record HTML pages (not yet migrated to DB-only config)
  — edited to match:
  - REC-7.5.2-live-pack-checklist.html
  - REC-7.7.3-glass-breakage-clearance-certificate.html
  - REC-7.7.6-plaster-dressing-inspection.html
  - REC-7.7.6a-first-aid-checklist-record.html
  - REC-7.8.1-chiller-batch-control.html
  - REC-7.8.1-dry-chiller-batch-control.html
  - REC-7.8.10-maintenance-job-card.html
  - REC-7.8.2-daily-waste-removal.html
  - REC-7.8.3-boiler-inspection-report.html
  - REC-7.8.9.1-lha-water-monitoring.html
  - REC-8.1.4-withdrawal-mock-recall-record.html
  - REC-8.1.5-traceability.html
  - REC-8.4.a-emergency-evacuation-attendance-register.html
  - REC-8.4.b-handling-of-emergencies-and-incidences.html
- `node scripts/verify-definitions.mjs` passes clean (0 real differences) after the edits.

## Fields deliberately left as text/number/derived (durations, not clock moments)
bleedingTotalTime, breakTime-as-duration cases already covered above as clock time, cookingTime,
dripTimeOfBags, saltingTotalTime, standardSaltingTime, totalCookingTime, totalDryingTimeDays,
totalTumblingTime, totalWashingTime, purgeDays. Also left alone: `timeOfCheck` where it's a
`select` dropdown, `deliveredOnTime` (yes/no select), and free-text fields that only mention
"time" in a longer label (e.g. "Water temperature at time of checking").

## Still to do (writes to the live Neon DB — not yet run)
```bash
node scripts/seed-definitions.mjs
node scripts/export-record-defs.mjs
```
`seed-definitions.mjs` reloads all 131 record definitions from `data/record-definitions.json`
into Postgres. `export-record-defs.mjs` refreshes the static `public/data/record-defs/*.json`
fallback snapshots used when the API is asleep. Run in that order, then deploy.
