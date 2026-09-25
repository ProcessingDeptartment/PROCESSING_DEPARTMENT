# ERP Reconciliation Prep — Field Types + Job Numbering (the two "do now" items)

This is the two items flagged in `claude/erpnext-integration-spec.md` under "What this app should
tighten now, independent of item 1/2 answers." Both are prep work only — neither requires or
waits on IT/Sales confirming what ERPNext exposes. Checked against the live schema and repo on
2026-09-14.

## 1. Field types — reference doc, not a schema change

**Decision: document only, don't change the schema.** The all-`String?` typing in every `sub_*`
table turned out to be a deliberate, documented design choice, not an oversight —
`scripts/generate-submission-schema.mjs` states it explicitly:

> Every field becomes a nullable String column (the canonical storage type for all form data — the
> engine always reads/writes strings). Typed columns (Int, Float, DateTime) are NOT used: the
> overhead of type coercion + null-vs-empty handling across 1800 fields isn't worth it when every
> query that needs typed access already knows the field and can cast. The definition layer owns
> the type metadata; the submission table is a flat store.

Changing that means fighting the generator (which regenerates all 175 tables and says "do not edit
by hand") on every future record addition, for the sake of a handful of fields that matter to one
integration. Not worth it. Instead: below is the concrete list of fields on the records already
named in the ERPNext integration spec, with the type each should be **cast to at query/sync time**
by whoever builds the ERPNext sync job or any report that reconciles against it.

### `sub_abalone_receiving` — the core intake record, and its `_Row` child
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNo` | String | **string, but see Section 2** | Reconciliation key — free text today, no enforced format |
| `receivingDate` | String | Date | ISO-ish string from an `<input type="date">`; safe to cast |
| `intakeWeight` | String | Numeric (kg, likely decimal) | Header-level total |
| *(row)* `wholeWeight` | String | Numeric (kg, decimal) | Per-basket weight |
| *(row)* `farmCount` | String | Integer | |
| *(row)* `mortalityCount` | String | Integer | |

### `sub_stock_loading` — the record that currently holds ad hoc "stock" data (see spec item 1, the reference-table gap)
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNo` | String | see Section 2 | |
| `jiIntakeWeight` | String | Numeric (kg) | Carried in from Job Info block |
| `canPieces` | String | Integer | |
| `drainedWeight` | String | Numeric (kg or g — confirm unit before casting) | |
| `numberOfCans` | String | Integer | |

### `sub_cans_produced` — Canning Report's main data source
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | Note: **this table uses `jobNumber`, not `jobNo`** — see the naming-inconsistency note below |
| `jiIntakeWeight` | String | Numeric (kg) | |
| `canPieces` | String | Integer | |
| `drainWeight` | String | Numeric | |
| `numberOfCans` | String | Integer | |
| `damagedCans` | String | Integer | Feeds the dashboard's "can damage rate" tile |
| `totalDamagedCans` | String | Integer | |

### `sub_qc_report` — quality figures that would sit next to an ERP yield/valuation figure
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | |
| `canPieces` | String | Integer | |
| `nettMassMin` | String | Numeric | |
| `drainMassMin` / `drainMassMax` | String | Numeric | |
| `ph`, `brix`, `saltPercent` | String | Numeric (decimal) | |

### `sub_drying_process` + `sub_grading_production_log_cultivated` — Drying Report's data sources
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | |
| `wholeWeight`, `cookingWeight`, `dryWeight` | String | Numeric (kg) | |
| `totalDryingTimeDays` | String | Integer | |
| `estimateYield` / `yield` | String | Numeric (percent, decimal) | |
| `actualDriedWeight`, `driedWeightReceived` | String | Numeric (kg) | |
| every `g8to10` … `g60plus` size-grade field | String | Numeric (kg) | 16 fields, all same treatment |

### Fields still with no upstream source at all (from `claude/canning-report-layout-spec.md`)
These don't exist yet anywhere in the schema — they're the ones an ERPNext sync is actually meant
to fill, not just retype:
- **GRN No., PO No., Cost per Kg, Delivery note no.** — currently proposed as manual entry on
  Job Details (`claude/job-details-modal-design-brief.md`); once ERPNext exposes Purchase
  Receipt/Stock Entry data (spec item 1), these should be read from there instead of typed by a
  person, and stored as: PO No./GRN No./Delivery note no. as **string** (document numbers,
  not arithmetic), Cost per Kg as **numeric (currency, decimal)**.
- **"SYSPRO Yield" comparison figure** (`claude/canning-report-data-improvement-suggestions.md`
  section 1) — numeric (percent), pending confirmation of whether ERPNext has an equivalent
  figure at all (see the integration spec's Open item 1).

### One thing this pass surfaced: `jobNo` vs `jobNumber` naming is inconsistent
Not a typing issue, but worth flagging since it was found while doing this: `sub_abalone_receiving`
and most Job-Info-carrying records use `jobNo`, but `sub_cans_produced`, `sub_qc_report`,
`sub_drying_process`, and `sub_grading_production_log_cultivated` use `jobNumber` for the same
concept. `RecordLink.linkField` and the app's own join logic already handle this (it's declared
per-record, not assumed to be one column name), so it isn't broken today — but anyone writing a
sync/reconciliation job against these tables needs to know both spellings exist, or a query that
only checks `jobNo` will silently miss half the records.

## 2. Job-numbering convention vs. ERPNext — open question, not yet answerable

**This one cannot be resolved from this app's side alone** — confirmed with Michaela this hasn't
been checked against ERPNext yet. What's true today, so whoever checks it knows exactly what
they're comparing against:

- **No enforced format.** `jobNo`/`jobNumber` is a free-text field, typed by a person on Abalone
  Receiving. Nothing in the schema or the UI validates its shape.
- **The only structure that exists is a prefix convention used to route reports**, defined in
  `claude/drying-report-spec.md` and implemented in `job-status.html`:
  - Canning jobs: prefix `3CP` or `CPR` (e.g. `CPR01156`)
  - Drying jobs: prefix `3DP` or `DPR` (e.g. `DPR01156`)
  - Matching is case-insensitive prefix check; a job number matching neither prefix set is
    excluded from both reports' dropdowns (silently, by design — "don't guess").
- **Real examples currently in the live database** (from the Neon audit,
  `claude/neon-db-live-audit.md`): `CPR002045`, `3CP0001112`, `CPR001598` — so both prefix
  families are genuinely in use, not just theoretical.
- **This is used as the reconciliation key across the whole app** — `RecordLink.linkField` can be
  `'jobNo'`, and the Job Status page, Traceability page, and every downstream report all join on
  this string, case-normalized (trim + uppercase, per `RecordLink.linkValue`'s own comment in the
  schema).

**What needs to be checked once someone can see ERPNext's actual data** (this is the concrete
version of Open item 2 in the integration spec):

1. Does ERPNext identify the equivalent physical job/work order by the *same* string this app
   already uses (e.g. is `CPR002045` itself a field somewhere in ERPNext, carried through from
   Syspro), or does ERPNext mint its own document name/ID for the same job?
2. If ERPNext has its own ID, is there already a 1:1 mapping available anywhere (e.g. a Syspro job
   number field preserved on the ERPNext document), or does a new mapping table need to be built
   and maintained by hand?
3. Do the `3CP`/`CPR`/`3DP`/`DPR` prefixes mean anything on the ERPNext side, or are they purely
   an artifact of this app's own report-routing logic that ERPNext has never seen?

**Recommendation:** don't build a mapping table speculatively — the shape of it depends entirely
on the answer to question 1. If it turns out ERPNext already carries this app's job number
verbatim, no mapping table is needed at all, just a straight string join (case-normalized, same as
today). Flag this as the first thing to check as soon as item 1 of the integration spec (what
ERPNext exposes) is answered — it's a five-minute check once someone has ERPNext access, not a
design task.

## Status

Both items are now concrete and unblocked from this app's side. Section 1 is a reference for
whoever builds the ERPNext sync or any reconciliation report — no code change needed, no
migration, nothing to approve. Section 2 stays an open question until someone with ERPNext access
checks the three questions above; recorded here so it's asked as soon as that access exists,
instead of being rediscovered mid-build.
