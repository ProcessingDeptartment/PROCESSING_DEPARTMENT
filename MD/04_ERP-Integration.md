# ERP Integration (Syspro / ERPNext)

Planning and prep for reconciling with the ERP.

_Consolidated from 2 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Syspro → ERPNext → Processing Department — Integration Spec (planning, not yet buildable)](#syspro--erpnext--processing-department--integration-spec-planning-not-yet-buildable) — `claude/erpnext-integration-spec.md`
2. [ERP Reconciliation Prep — Field Types + Job Numbering (the two "do now" items)](#erp-reconciliation-prep--field-types--job-numbering-the-two-do-now-items) — `claude/erp-reconciliation-prep.md`

---

## Syspro → ERPNext → Processing Department — Integration Spec (planning, not yet buildable)

> **Source:** `claude/erpnext-integration-spec.md`

**Status: blocked on external confirmation, not on this app's design.** This spec exists to make
the three open decisions from `claude/consolidated-plan.md` section 3.3 concrete enough to hand to
whoever owns the ERPNext side, and to record what this app's side already assumes so nothing gets
re-litigated once answers come back. **Do not start ETL/sync code from this doc alone** — items 1
and 2 below need an answer first. Item 3 is already decided and just needs restating once ERPNext
is the confirmed target instead of an aspiration.

### Why this replaced the original Dataverse plan

The original architecture (documented in `BACKEND_INTEGRATION.md`) was:

```
SYSPRO → Microsoft Dataverse → (scheduled ETL) → this app's Postgres → this app's API → the forms
```

That path is unbuilt and unowned. The live, owner-mandated alternative is the Syspro→ERPNext
nightly sync (owned by IT/Sales, `T:\Sales Dept\erp-evaluation`), which becomes the company's
system of record on **1 July 2027**. The consolidated plan (2026-09-09) already redirected future
upstream work to target ERPNext instead of Dataverse. This spec is the next step down from that
decision.

**What does NOT change with this pivot:** this app's own architecture. It was already designed to
never hold a live connection to the ERP (Syspro or ERPNext) — it reads a synchronised, read-only
copy into its own Postgres, and any write-back happens only in scheduled batches through one
controlled connection, never per-user or real-time. That design was built to avoid consuming
Syspro's limited concurrent-user licences and to protect live transactional data; the same
reasoning applies unchanged to ERPNext. Swapping the upstream source from "Syspro via Dataverse" to
"ERPNext directly" is a change to *where the sync reads from*, not to *how this app talks to it* —
the seam (`public/lib/api-backend.js`, the one-file storage adapter) already isolates that.

### Open item 1 — what ERPNext actually exposes (blocking)

**Not yet confirmed.** The current docs describe the Syspro→ERPNext nightly sync only as "a live
alternative," not a finished integration spec. Before any sync job is designed:

- Confirm with IT/Sales (owners of `T:\Sales Dept\erp-evaluation`) what ERPNext exposes as of
  1 July 2027: a REST/GraphQL API, a webhook, or a scheduled file export (CSV/SFTP-style).
  ERPNext's own REST API is a known, documented capability of the platform, but whether *this
  company's* ERPNext instance and IT policy will allow this app to call it directly (vs. only
  receiving a scheduled export) needs a real answer from the people running that evaluation, not
  an assumption.
- Confirm which ERPNext doctypes/entities are the actual source of the data this app currently
  captures manually or leaves as a gap — at minimum: Purchase Receipt / Stock Entry (for GRN No.,
  PO No.), Item (for stock code → description, the reference-table gap flagged in
  `claude/canning-report-data-improvement-suggestions.md` section 3), and whatever ERPNext calls
  its yield/valuation figure (the "SYSPRO Yield" comparison point from the same doc, section 1) —
  if it exists at all in ERPNext's data model, or if that comparison becomes moot once ERPNext is
  the source of truth.
- Confirm authentication: API key/secret pair (ERPNext's standard mechanism) vs. some other scheme,
  and whether it's a single shared service credential (matching this app's existing device-level
  `API_KEY` pattern) or something per-integration.

**Owner:** IT/Sales, not Claude Code. This is a scoping conversation, not a build task.

### Open item 2 — sync direction and cadence into this app's Postgres (blocking)

**Currently only assumed, not decided.** The working assumption is: nightly batch, mirroring the
cadence IT/Sales already uses for Syspro→ERPNext itself, landing in this app's existing Postgres
(Neon) rather than a separate database.

Before building against that assumption, confirm:

- **Cadence.** Nightly is the default guess because it mirrors the upstream Syspro→ERPNext job —
  but this app's own data (35 submissions as of 2026-09-14, effectively pilot-scale) doesn't yet
  generate enough volume to tell us whether nightly is fast enough for what the floor actually
  needs (e.g. same-shift GRN/PO lookup vs. next-day is a real UX difference on the Job Details
  form). Confirm cadence against actual floor need, not just infra convenience.
- **Direction and shape.** Land ERPNext data as new tables (an `ErpItem`, `ErpPurchaseReceipt`
  style reference layer) rather than writing into the existing `sub_*` submission tables — those
  are shaped around paper forms filled in by people, not around ERP records. Keep the two
  concerns structurally separate: `sub_*` tables stay "what a person recorded here," a new
  `Erp*` layer becomes "what the ERP says," and any field that needs both (e.g. Cost per Kg on
  the Canning Report) reads from the ERP layer and displays it, rather than requiring manual
  re-entry — this directly closes the gap flagged in `claude/canning-report-layout-spec.md`
  (GRN No., PO No., Cost per Kg currently have no upstream data source).
- **Idempotency and conflict handling.** A nightly job needs a clear upsert key (ERPNext's own
  document name/ID, not this app's `jobNo`, since the two numbering schemes may not match 1:1 —
  see Open item 3) and a defined behaviour when a record changes on the ERPNext side after this
  app has already displayed or referenced it.

**Owner:** whoever builds the sync job, once item 1's answer defines what there is to sync from.

### Item 3 — write-back rule (decided, restate only)

Already settled and unaffected by the ERPNext pivot — reconfirming explicitly here so it's stated
against the actual target system, not just the retired Dataverse diagram:

- **Syspro is read-only forever.** No write path to Syspro exists or should be built, regardless
  of the ERPNext integration.
- **Approved records from this app go to ERPNext, never Syspro.**
- **Batched, not real-time.** Same reasoning as the read side: no per-user or live connection to
  the ERP from any device on the floor. One controlled, scheduled write-back job, same cadence
  discussion as Open item 2.
- Nothing about this rule needs IT/Sales confirmation — it's this app's own governance decision,
  already made. It only needs restating so a future implementer doesn't accidentally build the
  old Dataverse-diagram's reverse arrow against Syspro directly.

### What this app should tighten now, independent of item 1/2 answers

Two things are worth doing before the sync exists, because they reduce rework once it does:

1. **Type the fields that will need to reconcile against ERPNext's typed data.** Right now nearly
   every column in the generated `sub_*` tables is `String?` (weight, counts, percentages all
   stored as text). That's fine for permissive paper-form capture, but ERPNext will hand back
   typed, validated values (numeric quantities, dates, currency) — reconciling a string-typed
   `intakeWeight` against a numeric ERPNext stock quantity means parsing on every comparison.
   Scope a typing pass on the fields most likely to touch the ERP layer first (job number,
   weights, quantities, costs) rather than the whole schema at once.
2. **Confirm the job-numbering convention matches what ERPNext will use as its own key.** This
   app already treats `jobNo` as the de facto reconciliation key across records
   (`RecordLink.linkField`, `SubmissionDateField`, the Job Status page). If ERPNext identifies the
   same physical job by a different number or format, that mismatch needs a mapping table, not a
   string-equality join — better to find that out now than after a sync job is built assuming a
   1:1 match.

### Status

Not ready for Claude Code. Blocked on IT/Sales answering Open item 1 (what ERPNext exposes).
Once that answer exists, Open item 2 (cadence/shape) can be decided in a single follow-up
conversation and this doc updated with the resolution — at that point it converts into a build
spec in the same format as `claude/drying-report-spec.md`.

---

## ERP Reconciliation Prep — Field Types + Job Numbering (the two "do now" items)

> **Source:** `claude/erp-reconciliation-prep.md`

This is the two items flagged in `claude/erpnext-integration-spec.md` under "What this app should
tighten now, independent of item 1/2 answers." Both are prep work only — neither requires or
waits on IT/Sales confirming what ERPNext exposes. Checked against the live schema and repo on
2026-09-14.

### 1. Field types — reference doc, not a schema change

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

#### `sub_abalone_receiving` — the core intake record, and its `_Row` child
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNo` | String | **string, but see Section 2** | Reconciliation key — free text today, no enforced format |
| `receivingDate` | String | Date | ISO-ish string from an `<input type="date">`; safe to cast |
| `intakeWeight` | String | Numeric (kg, likely decimal) | Header-level total |
| *(row)* `wholeWeight` | String | Numeric (kg, decimal) | Per-basket weight |
| *(row)* `farmCount` | String | Integer | |
| *(row)* `mortalityCount` | String | Integer | |

#### `sub_stock_loading` — the record that currently holds ad hoc "stock" data (see spec item 1, the reference-table gap)
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNo` | String | see Section 2 | |
| `jiIntakeWeight` | String | Numeric (kg) | Carried in from Job Info block |
| `canPieces` | String | Integer | |
| `drainedWeight` | String | Numeric (kg or g — confirm unit before casting) | |
| `numberOfCans` | String | Integer | |

#### `sub_cans_produced` — Canning Report's main data source
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | Note: **this table uses `jobNumber`, not `jobNo`** — see the naming-inconsistency note below |
| `jiIntakeWeight` | String | Numeric (kg) | |
| `canPieces` | String | Integer | |
| `drainWeight` | String | Numeric | |
| `numberOfCans` | String | Integer | |
| `damagedCans` | String | Integer | Feeds the dashboard's "can damage rate" tile |
| `totalDamagedCans` | String | Integer | |

#### `sub_qc_report` — quality figures that would sit next to an ERP yield/valuation figure
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | |
| `canPieces` | String | Integer | |
| `nettMassMin` | String | Numeric | |
| `drainMassMin` / `drainMassMax` | String | Numeric | |
| `ph`, `brix`, `saltPercent` | String | Numeric (decimal) | |

#### `sub_drying_process` + `sub_grading_production_log_cultivated` — Drying Report's data sources
| Field | Stored as | Should be treated as | Notes |
|---|---|---|---|
| `jobNumber` | String | see Section 2 | |
| `wholeWeight`, `cookingWeight`, `dryWeight` | String | Numeric (kg) | |
| `totalDryingTimeDays` | String | Integer | |
| `estimateYield` / `yield` | String | Numeric (percent, decimal) | |
| `actualDriedWeight`, `driedWeightReceived` | String | Numeric (kg) | |
| every `g8to10` … `g60plus` size-grade field | String | Numeric (kg) | 16 fields, all same treatment |

#### Fields still with no upstream source at all (from `claude/canning-report-layout-spec.md`)
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

#### One thing this pass surfaced: `jobNo` vs `jobNumber` naming is inconsistent
Not a typing issue, but worth flagging since it was found while doing this: `sub_abalone_receiving`
and most Job-Info-carrying records use `jobNo`, but `sub_cans_produced`, `sub_qc_report`,
`sub_drying_process`, and `sub_grading_production_log_cultivated` use `jobNumber` for the same
concept. `RecordLink.linkField` and the app's own join logic already handle this (it's declared
per-record, not assumed to be one column name), so it isn't broken today — but anyone writing a
sync/reconciliation job against these tables needs to know both spellings exist, or a query that
only checks `jobNo` will silently miss half the records.

### 2. Job-numbering convention vs. ERPNext — open question, not yet answerable

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

### Status

Both items are now concrete and unblocked from this app's side. Section 1 is a reference for
whoever builds the ERPNext sync or any reconciliation report — no code change needed, no
migration, nothing to approve. Section 2 stays an open question until someone with ERPNext access
checks the three questions above; recorded here so it's asked as soon as that access exists,
instead of being rediscovered mid-build.

---
