# REC 7.4.0 Dry Cooking — Remove Temporary OOSW Entry Flow

**Status:** Done — applied 2026-10-13  
**Raised by:** Michaela  
**Scope:** `public/data/record-defs/dry-cooking.json` — no code changes required

---

## What changed

The temporary `ooswKg` manual-entry field has been removed from REC 7.4.0.

Jobs now **always start from REC 7.1.2 Abalone Receiving** (or a bulk upload). The OOSW weight that was previously typed manually comes from the linked REC 7.1.5 record via `capSource: "salting-oosw"`, which was already wired in.

Dry Cooking now behaves like every other record: select a job, autofill fires, continue.

### Fields removed

| Location | What was removed |
|----------|-----------------|
| `sections[0].summaryFields` | `{"key":"ooswKg","label":"OOSW:","suffix":" kg"}` |
| `sections[0].fields` | `{"key":"ooswKg","label":"OOSW weight (kg)","type":"number","unit":"kg"}` |
| `roster.jobWeights` | `"manualField":"ooswKg"` |

### What stays unchanged

- `roster.jobWeights.capSource: "salting-oosw"` — the weight cap still reads from REC 7.1.5
- `roster.jobWeights.cookFromOosw: true` — cooking weight is still capped against OOSW
- All autofill from `abalone-receiving` (farm, intake weight, intake date, processing-for)
- All pot/roster columns, blanching and cooking fields

---

## Supersedes

`MD/rec-7.4.0-temporary-entry-flow-instructions.md` — that temporary flow is now fully retired.

---

## No migration needed

The `oosw_kg_manual` column on existing database rows is left in place (null-safe). Any rows that had a value there were entered during the temporary period and are still queryable. No data is lost.
