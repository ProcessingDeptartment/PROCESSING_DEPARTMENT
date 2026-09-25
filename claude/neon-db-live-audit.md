# Neon Database — Live Audit (2026-09-14): Operations Comparison vs Syspro, Corrected

**Why this doc exists.** Michaela asked for an evaluation of the site against Syspro on the
operations side, specifically asking that the live Neon database be checked before drawing any
conclusion. The first pass of this evaluation was based on the schema (pulled from GitHub) and the
live app UI only, and it drew conclusions about traceability/trend-viewing "gaps" that turned out
to be an artifact of near-zero data, not a structural weakness. This doc corrects that, with the
actual query results as evidence, so the correction doesn't get lost.

## What was actually checked

Direct SQL access to the Neon database was not available from the cloud sandbox (raw Postgres on
port 5432 is not proxied through this session's egress, and Neon's HTTPS/serverless driver hit an
org-level host allowlist block). The Neon console's own SQL editor was used instead — Michaela ran
four queries and pasted back the results, reproduced in full below.

## Query 1 — row counts per table (busiest first, capped at 40)

Only 9 of the 40 busiest tables have any rows at all. The rest (31 of the 40 shown, and it gets
worse further down the list) are at zero: traceability, mock recall, water monitoring, maintenance,
chemical stock, medicals, training register, and more.

| table | rows |
|---|---|
| sub_abalone_receiving_row | 14 |
| sub_salting_and_tumbling_row | 6 |
| sub_cans_produced | 3 |
| sub_salting_and_tumbling | 3 |
| sub_abalone_receiving | 3 |
| sub_basket_removal_shucking_gutting | 2 |
| sub_precooking_check_sheet | 2 |
| sub_qc_report | 1 |
| sub_gonad_inspection_report | 1 |
| *(31 more tables in the top-40, all at 0 rows)* | 0 |

## Query 2 — whole-database total

| total_tables | empty_tables | total_rows |
|---|---|---|
| 175 | 166 | **35** |

**175 record submission tables exist. 166 of them (95%) have never received a single submission.
The entire database holds 35 rows, full stop.**

## Query 3 — traceability/linking layer

| table | count |
|---|---|
| RecordLink | 19 |
| SubmissionDateField | 28 |
| RecordDefinition | 131 |

`RecordDefinition` at 131 is fully seeded — that's the design-time metadata layer (one row per
record type), populated once by `scripts/extract-definitions.mjs`, independent of usage. The other
two scale with the 35 real submissions: roughly one date-index row per submission (28 vs 35, since
not every record type has a classified date field) and about one link row per two submissions (19
vs 35, since only job-numbered records — receiving, salting, canning — currently populate
`linkField`).

## Query 4 — sample of the core intake record (`sub_abalone_receiving`)

| jobNo | receivingDate | receivedFrom | toBeProcessedFor | intakeWeight | createdAt |
|---|---|---|---|---|---|
| CPR002045 | 2026-09-10 | Bergsig | Can | 93.35 | 2026-09-10 14:47:49 |
| 3CP0001112 | 2026-09-11 | Third Party | Can | 582.15 | 2026-09-10 11:22:05 |
| CPR001598 | 2026-09-10 | Bergsig | Can | 37.45 | 2026-09-10 06:41:40 |

All 3 receiving records fall inside a single 24-hour window (2026-09-10 to 2026-09-11), from two
source farms, all routed to canning. This is pilot/test data from one or two days of use, not a
production history.

## Corrected conclusion

The earlier version of this evaluation (before live data was checked) described traceability as
"real but shallow" and trend-viewing as "basic," based on the batch trace page showing "6 batch
numbers indexed" and several dashboard tiles reading "No data." That framing was wrong in emphasis:
those weren't thin features, they were close to the entire dataset. With 35 total rows across 175
tables, there is currently nothing to trend and almost nothing to trace — not because the schema
can't support it, but because the facility hasn't yet run real production volume through the
system.

This matters for how "operations vs Syspro" should actually be read:

- **The structural gaps identified from the schema still stand** — no stock/inventory ledger, no
  work-order costing, no live Syspro connection (by design). Those are true regardless of row
  count, because they're about what tables and relations exist, not how many rows are in them.
- **The traceability/trend gaps are not structural** — the `RecordLink` join-table design and the
  `SubmissionDateField` date-index design are both sound and already working correctly at the
  scale that exists (19 links / 28 dated fields against 35 submissions is the right ratio). They
  simply have almost nothing to operate on yet.
- **The practical priority is rollout, not schema work.** Every traceability and trend-viewing goal
  in the project brief depends on real shift-level data flowing through the system at volume. No
  amount of further database design will produce a trend line from 3 canning jobs recorded on two
  days. Getting the floor onto full, sustained use of the system is the highest-leverage next step
  for the "traceability is vital" and "must be able to view trends" requirements — ahead of any
  further schema or reporting work.

## Evidence trail

Queries were run directly against the live Neon instance via its own SQL editor
(`postgresql://...@ep-long-pond-aydj6pgg-pooler.c-5.us-east-2.aws.neon.tech/neondb`) on
2026-09-14. Note: the connection string was shared in chat during this session and should be
rotated in the Neon dashboard if it hasn't been already, since it grants full read/write access to
the whole database.
