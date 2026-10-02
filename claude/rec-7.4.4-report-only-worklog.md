# REC 7.4.4 report-only: work log (2026-10-02)

Brief: REC 7.4.4 is a pure read-only report. Stays on the record list; no form, submit, draft, submission row or sign-off.

## Done
- `src/box-report.js` (new): `GET /api/report/boxes` (wired in `src/index.js`) returns every `closed_box` row (= "+ Full box") joined to `stock_link` (jobs + per-job kg), REC 7.4.5 inspection, REC 7.4.8 (NRCS AG code, shipment), plus legacy 7.4.4 entries and warnings. One call, read-only, nothing written.
- `public/records/REC-7.4.4-grading-boxing-traceability.html` rewritten as the report (same filename, so the record list, SOP-12/55 and REC 8.1.7 links still resolve). Filters: job, box, size grade, status, date range. Blended bins show a badge expanding to per-job weights. Print = A4 landscape with generated-on, user and active filter header; CSV = one row per box, Yes/No text. Legacy submissions listed read-only at the foot.
- Status rule: Shipped = on a *submitted* 7.4.8; Labelled (draft) = on a draft 7.4.8; In stock = 7.4.5 inspected and approved; otherwise Boxed.
- Warnings: bin graded into but no box closed; box on 7.4.8 with no grading record; box sourced from a still-draft grading log. Mass balance = 7.4.5 nett minus graded kg per box.
- Register: `master-index-data.js` REC 7.4.4 details -> "Withdrawn as entry form; superseded by system-generated traceability report" (+ `reportOnly: true`). Number, title, href, list position unchanged. The record list links straight to the page, so there is no "New entry" action to remove.
- Tests: `scripts/test-box-report.mjs` (passes) and existing `test-stock-link.mjs` (passes). Page checked in the browser with a mocked payload (filters, blended expand, legacy block); screenshot would not draw, checked via page text. Print/CSV not exercised.

## Not changed (other records untouched)
- The `grading-boxing-traceability` definition, `traced-records.js` entry and client `bin_link` index in `traceability.js` are left as-is so legacy data stays readable; nothing writes to them any more.
- `scripts/wire-jobinfo.js` and `add-verification-block.js` still list the old 7.4.4 page: do not re-run them or they will try to patch the report page.

## Open items for Michaela
1. **Export invoice no. is always blank.** The Dry Export Pack front page holds `exportInvoiceNo` but has no box list or shipment key, and 7.4.8 has no invoice field, so a box cannot be joined to an invoice without guessing. Needs a link added (e.g. invoice no. on 7.4.8, or the pack picking its 7.4.8). Column is in place.
2. **Migration/deploy:** the `stock_link` migration (`20261001100000_stock_link`) must be run and `scripts/backfill-stock-links.js` applied before the report shows real data; `closed_box` must also exist. Deploy order per [[project_rec_7_4_4_report]].
3. **Section 5 lock/audit check:** 7.4.3.x, 7.4.5 and 7.4.8 have an audit trail (KeyValueHistory records every change), but submitted records are **not server-locked** (validation only warns unless `VALIDATE_WRITES=enforce`, and the API key is a front-door lock, not per-user). So "locked after submission" is not currently true for those records.
4. Master-index script version `?v=4` not bumped; only the register text changed, so a stale cache is harmless.
