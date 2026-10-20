# Drying Process Log — Superseded Entry Hiding & Verified Print Hub

**Status:** Instructions only, no code written. For Claude Code.
**Date:** 2026-10-20
**Scope:** REC 7.4.1 (Drying Process) log table + new "Print Hub" page.
**Related docs:** `claude/drying-process-refinement-instructions.md`, `MD/submissions-log-column-order-and-actions-instructions.md`

---

## 1. The problem

A drying job accumulates many daily entries. Occasionally an older entry is superseded: a newer entry covers the same period and includes the data from the older one (e.g. an admin consolidates two partial entries into one complete record). Once the newer entry is verified, the older partial entry is noise in the log and should not print.

Two separate deliverables address this:

1. **Superseded flag** — lets an admin mark an older entry as superseded by a newer one; the older entry is hidden in the main log (but never deleted).
2. **Verified Print Hub** — a separate page that shows only the latest, verified, non-superseded entries per job, ready to print as PDFs.

---

## 2. Superseded flag (database + submissions log)

### 2.1 Database change

Add a `superseded_by` column to `dry_process_entry`:

```sql
ALTER TABLE dry_process_entry
  ADD COLUMN superseded_by TEXT DEFAULT NULL,        -- submission_id of the replacing entry
  ADD COLUMN superseded_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN superseded_by_user TEXT DEFAULT NULL,
  ADD COLUMN supersede_reason TEXT DEFAULT NULL;

CREATE INDEX idx_dry_process_entry_superseded ON dry_process_entry(superseded_by)
  WHERE superseded_by IS NOT NULL;
```

The column holds the `submission_id` of the entry that replaces this one. `NULL` = active.

Also add the same four columns to the generic `submissions` table (or to the JSON blob's metadata, whichever pattern is used for other record types), so the pattern is reusable across records. If the system stores submission state in a `KeyValue` store rather than a real column, add `supersededBy`, `supersededAt`, `supersededByUser` and `supersedeReason` fields to the submission's stored object.

### 2.2 API endpoint

```
POST /api/submissions/:id/supersede
Body: { supersededById: "<submission_id_of_newer_entry>", reason: "<text>" }
Auth: ADMINISTRATOR or QUALITY_SUPERVISOR role required (same passkey gate as edit)
```

Response: `{ ok: true }` or `{ error: "..." }`.

Validations:
- Both entries must belong to the same `job_no`.
- The replacing entry (`supersededById`) must be **submitted** (not draft).
- The entry being superseded must not already be superseded.
- The replacing entry cannot itself be the superseded entry (no self-reference).
- The replacing entry must be **the same or newer** in `entry_date` than the one being superseded (reject with a clear message if not).

### 2.3 Submissions log UI (REC 7.4.1 entries panel)

In the log table for drying process entries:

**Default view (active entries only):**
- Hide all rows where `superseded_by IS NOT NULL`.
- Show a muted notice at the bottom of the table: *"N superseded entr(y/ies) hidden — [Show]"*.
- Clicking **Show** expands the table to include superseded rows, styled with a grey background and a "Superseded" badge (amber or grey pill). The badge tooltip shows: *"Superseded by [entry date of replacing entry] — [reason] — [superseded by user] on [date]"*.
- Clicking **Hide** returns to the filtered view.
- **Never delete superseded entries.** They must remain readable and printable for audit purposes when shown.

**Supersede action (admin only):**
- Add a "⋯" or "Actions" menu to each active entry row (role-gated: ADMINISTRATOR or QUALITY_SUPERVISOR only).
- One action: **Mark as superseded by…**
- Opens a small modal:
  - Dropdown: "Replaced by entry:" — lists all **other submitted** entries for the same `job_no`, ordered newest first, showing `entry_date — submitted_by`.
  - Text area: "Reason (required)" — minimum 10 characters.
  - Confirm button: **Mark superseded** (red border to signal this is a significant action).
  - Cancel.
- On confirm: calls `POST /api/submissions/:id/supersede`. On success: row gets the "Superseded" badge and moves to the hidden group immediately (no page reload needed — update the DOM in place).

**Unsupersede (undo):**
- Admin-only. In the "show superseded" expanded view, each superseded row has an **Unsupersede** action in its menu.
- Calls `POST /api/submissions/:id/unsupersede` (clears the four superseded columns).
- Row immediately moves back to the active group.

---

## 3. Verified Print Hub

A new page at `public/pages/verified-print-hub.html` (linked from the main menu under a "Reports" or "Print" section).

### 3.1 Purpose

One place to find and print the **current, verified, non-superseded** version of any log. Operators and supervisors come here when they need to hand a PDF to auditors, attach to an export pack, or archive a completed job. They do not need to navigate into individual record pages.

### 3.2 Page layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Verified Print Hub                        [ Filter by job / record ] │
├──────────────────────────────────────────────────────────────────────┤
│  Filters:  Record type ▾   Job no. [____]   Date range [__] – [__]   │
│            [ Show only latest per job ] ✓  (default on)              │
├──────────────────────────────────────────────────────────────────────┤
│  Job / Ref │ Record │ Activity date │ Verified date │ Verified by │ PDF │
│  ──────────┼────────┼───────────────┼───────────────┼─────────────┼─────│
│  JOB-001   │ REC 7.4.1 Drying Process │ 15 Oct 2026 │ 16 Oct 2026 │ M.A. │ [PDF] │
│  …                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data query

On load, query all submissions where:
- `status = 'verified'`
- `superseded_by IS NULL` (or supersededBy not set)

**"Show only latest per job" toggle (on by default):**
When on, for each `(job_no, record_key)` pair, show only the single entry with the **most recent `entry_date`** among the verified non-superseded entries. All others are de-duped out of the visible table (but still accessible if the toggle is turned off).

When the toggle is off, every verified non-superseded entry is shown.

### 3.4 Table columns

| Column | Notes |
|---|---|
| Job / Ref | Bold job number |
| Record | Doc no + record name |
| Activity date | `entry_date` from the record |
| Verified date | When verification was stamped |
| Verified by | Who verified |
| PDF | Button — always shown (all rows here are verified) |

### 3.5 PDF action

Clicking **PDF** opens the record page with `?entry=<entryId>&print=1`. The record page's existing print-on-load logic handles the rest. No new PDF generation code is needed.

### 3.6 Bulk print (optional phase 2)

Add a checkbox column. When one or more rows are checked, a **Print selected (N)** button appears. Clicking it opens each record's print URL in a new tab in sequence (or queues them). This is optional and can be deferred.

### 3.7 Filtering

- **Record type dropdown:** lists all record types that have at least one verified non-superseded entry. Default: "All records".
- **Job no. text input:** filters by job number prefix (case-insensitive).
- **Date range:** filters by `entry_date`.
- Filters combine (AND). Results update on each input change (debounced 300 ms).

### 3.8 Empty state

If no verified entries match the filter: *"No verified records found matching your filter. Records appear here once they have been submitted and verified."*

### 3.9 Access

The Print Hub is read-only and accessible to all logged-in users (no role gate on viewing). The PDF button is always enabled (same as the existing submissions log rule: PDF only shown when verified, which is guaranteed here).

---

## 4. Navigation wiring

- Add "Print Hub" (or "Verified Records") to the main menu / home categories block, under a "Reports" or "Print" group — alongside the existing Submissions Log.
- Also link from the REC 7.4.1 entries panel: a small "Open Print Hub for this job →" link at the top of the log that pre-fills the job number filter.

---

## 5. Database portability note

The four `superseded_*` columns are plain typed SQL — no Neon-specific features. If the system moves to another Postgres host (or another database), these columns export cleanly to CSV via the existing `scripts/export-*.mjs` pattern. Add them to the export script for `dry_process_entry`.

---

## 6. Testing checklist

1. Mark entry A as superseded by entry B for the same job → A disappears from the active log, superseded badge appears in "show" view with reason and date.
2. Attempt to mark entry A as superseded by an entry from a *different* job → API returns error, no change in UI.
3. Attempt to supersede an already-superseded entry → API returns error.
4. Unsupersede entry A → it returns to the active log.
5. Verified Print Hub with "latest per job" on → shows only the most recent verified entry per (job, record) pair.
6. Verified Print Hub with toggle off → shows all verified non-superseded entries.
7. PDF button opens the record in print mode.
8. Job no. filter pre-fills when arriving from REC 7.4.1 link.
9. Superseded entries are **still visible and printable** in the submissions log when "show superseded" is on — they are never locked from reading.
10. Export script includes superseded columns.

---

## 7. Commit message template

```
feat: drying log superseded entries + verified print hub

- dry_process_entry: superseded_by, superseded_at, superseded_by_user, supersede_reason columns
- POST /api/submissions/:id/supersede (admin/QS gate, same-job + newer-date validation)
- POST /api/submissions/:id/unsupersede (undo)
- Submissions log: hide superseded rows by default, show on toggle with amber badge + tooltip
- Supersede action in admin row menu with reason modal
- New page: public/pages/verified-print-hub.html
  - Verified + non-superseded entries only
  - "Latest per job" toggle (default on)
  - PDF action → existing print-on-load pattern
  - Filters: record type, job no., date range
- Home menu: "Print Hub" link under Reports/Print group
- REC 7.4.1 log panel: "Open Print Hub for this job" quick link
- Export script updated with new columns

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016SpSwLinfjjuAfjDaPwUJ9
```
