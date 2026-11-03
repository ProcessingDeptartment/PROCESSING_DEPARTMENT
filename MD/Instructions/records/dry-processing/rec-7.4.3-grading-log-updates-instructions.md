# REC 7.4.3 — Grading Production Log: Update Instructions

**Applies to:** `grading-production-log-cultivated.json` (REC 7.4.3.1) and `grading-production-log-ranched.json` (REC 7.4.3.2)

---

## 1. Bin barcodes — fixed IDs, submit-and-reset logic

Bin barcodes (the `binCode` field, e.g. `Under 8g-1`) are **permanent and never change** — the same physical bin always carries the same code.

However, the data associated with that bin **must reset** each time a full box is released from it:

- When a full box weight is logged in `fullBoxWeight` (numlist), that box is considered released.
- On release, the job numbers that contributed to that box are recorded and the box entry is "committed" — it cannot be altered.
- The bin then resets: `binWeightStart` for the next entry carries forward from `finalBinWeight` of the just-completed entry (this is already handled by `carryPrev`).

**Important timing rule:**
- A box may become full mid-day while grading continues.
- Full boxes are **only submitted** (committed to the record) at:
  - End of the current grading record (record submission), OR
  - End of day if grading is ongoing across multiple records.
- Do **not** auto-submit a full box mid-session; it must wait for one of the two trigger points above.

**What "submitted" means for a box:**
- The job numbers present in the bin when the box was filled are captured and stored against that box entry.
- After submission the box entry is locked (read-only).
- The bin resets for the next box within the same grading session.

---

## 2. Dried weight received (with strings) — source field

The field `driedWeightReceived` ("Dried weight received (with strings)") in the **Batch details** section must be **auto-filled** from the **Dry Stock Control** record.

- Source record: `dry-stock-control`
- Source value: **total weight of crates** for the matching job number
- Match key: `jobNo`
- This is the gross weight including hanging strings; `actualDriedWeight` is entered manually as the net weight after strings are removed.

Implement as an `autofill` entry on the record config:

```json
{
  "watch": "jobNo",
  "source": "dry-stock-control",
  "matchField": "jobNo",
  "fill": {
    "driedWeightReceived": "<totalCrateWeight field name in dry-stock-control>"
  }
}
```

Confirm the exact field key in `dry-stock-control.json` before wiring this up.

---

## 3. Date into grading room — pulled from Drying Process

The field `dateIntoGradingRoom` ("Date into grading room") in the **Batch details** section must be **auto-filled** from the **Drying Process** record (`drying-process`).

- Source record: `drying-process`
- Match key: `jobNo`
- Source field: the date the job was moved out of the drying room / completed drying — confirm the exact field key in `drying-process.json` (likely the final steam date or a "date out of drying room" field).

Add to the `autofill` array:

```json
{
  "watch": "jobNo",
  "source": "drying-process",
  "matchField": "jobNo",
  "fill": {
    "dateIntoGradingRoom": "<drying completion date field>"
  }
}
```

---

## 4. Grading date — timestamp of record

The field `gradingDate` ("Grading date") must be set to the **timestamp of the record itself** — i.e. the date/time the grading record was created or first saved.

- This should default to `now` on record creation (same behaviour as a `timestamp` field).
- It should **not** be a manually entered date; it is derived from the record's own creation time.
- Update the field definition:

```json
{
  "key": "gradingDate",
  "label": "Grading date",
  "type": "date",
  "defaultNow": true,
  "readOnly": true
}
```

Confirm that `form-record.js` supports `defaultNow: true` on a `date` field, or use `type: "timestamp"` if that is the correct type for auto-populated creation time.

---

## 5. Size grade weights — field names: lowercase `g`

All size grade option strings, field labels, and `sumRosterWhere` values must use **lowercase `g`** (not uppercase `G`).

**Current state (JSON files):** Labels and options already use lowercase `g` correctly in the exported JSON.

**Action required:** Verify the `RecordFieldDef` and `RosterColumnDef` rows in the Neon DB also use lowercase `g` in all stored strings (option lists, labels). If any rows contain uppercase `G` (e.g. `"8G-10G"` or `"Under 8G"`), update them to lowercase.

After any DB correction:
1. Run `node scripts/export-record-defs.mjs`
2. Commit and push both JSON files
3. Verify in browser that grade labels display with lowercase `g`

---

## Deployment checklist (after all changes)

- [ ] Update `autofill` entries in `RecordDefinition` (or directly in JSON if DB access unavailable)
- [ ] Confirm `driedWeightReceived` source field key in `dry-stock-control`
- [ ] Confirm `dateIntoGradingRoom` source field key in `drying-process`
- [ ] Update `gradingDate` field to auto-populate from record timestamp
- [ ] Verify lowercase `g` in all DB option strings
- [ ] Run `node scripts/export-record-defs.mjs`
- [ ] Commit and push `grading-production-log-cultivated.json` and `grading-production-log-ranched.json`
- [ ] Test in browser: grading record, bin reset logic, autofill fields, grade labels
