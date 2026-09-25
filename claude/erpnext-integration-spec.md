# Syspro → ERPNext → Processing Department — Integration Spec (planning, not yet buildable)

**Status: blocked on external confirmation, not on this app's design.** This spec exists to make
the three open decisions from `claude/consolidated-plan.md` section 3.3 concrete enough to hand to
whoever owns the ERPNext side, and to record what this app's side already assumes so nothing gets
re-litigated once answers come back. **Do not start ETL/sync code from this doc alone** — items 1
and 2 below need an answer first. Item 3 is already decided and just needs restating once ERPNext
is the confirmed target instead of an aspiration.

## Why this replaced the original Dataverse plan

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

## Open item 1 — what ERPNext actually exposes (blocking)

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

## Open item 2 — sync direction and cadence into this app's Postgres (blocking)

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

## Item 3 — write-back rule (decided, restate only)

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

## What this app should tighten now, independent of item 1/2 answers

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

## Status

Not ready for Claude Code. Blocked on IT/Sales answering Open item 1 (what ERPNext exposes).
Once that answer exists, Open item 2 (cadence/shape) can be decided in a single follow-up
conversation and this doc updated with the resolution — at that point it converts into a build
spec in the same format as `claude/drying-report-spec.md`.
