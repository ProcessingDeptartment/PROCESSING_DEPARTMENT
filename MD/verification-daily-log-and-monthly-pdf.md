# Verification Daily Log & Monthly PDF — Chiller / Water / LHA Records

**Applies to (initial rollout):**
- `chiller-temperature-monitoring` (REC 7.9.1)
- `water-monitoring` (REC 7.8.9)
- `lha-water-monitoring` (REC 7.8.9.1)

**Designed to be reusable** — the same pattern can be attached to any record on request.

---

## What needs to change

### 1. Verification view — show ALL submissions for the day, not a single awaiting-verification line

**Current behaviour:** When a user opens the verification panel (or clicks to verify), a single "awaiting verification" line or entry is shown.

**Required behaviour:**
- When a user wants to verify a record, show **all submissions made on that calendar day** (midnight-to-midnight, local time).
- Each submission entry should be presented as a reviewable item — with its field values visible — so the verifier can review every entry before signing off.
- The sign-off / verification action should cover **all entries for the day** as a single verification event (or allow line-by-line, but the default view must surface all of them).
- Do not collapse entries into a single line — the verifier must be able to see what they are verifying.

### 2. Submission log — all submissions

**Current behaviour:** Unclear / possibly filtered or paginated in a way that hides earlier entries.

**Required behaviour:**
- The submission log for these records must show **every submission** — no truncation, no "today only" filter.
- The list is the full history of all submissions for that record type.
- Existing sort order (most recent first) is fine.

### 3. PDF / print — monthly log

**Current behaviour:** PDF likely prints only recent or current-day entries.

**Required behaviour:**
- When a user triggers a PDF print, it must print **all submissions in the current calendar month**.
- Example: if printed on 11 November 2026, the PDF includes every submission from 1 November through 11 November 2026.
- The PDF should be titled / headed as a **monthly log**, e.g.:  
  `Chiller Temperature Monitoring — November 2026`
- Each submission entry should appear as a row or block in the PDF, in chronological order (oldest first).
- The existing `printCompact` / `printTable` / print CSS rules still apply for layout — this change is about **data scope**, not layout.

---

### 4. Job-based records — verification grouped by job number (Drying Process)

**Applies to:** `drying-process` (REC 7.4.1)

- Same principle as section 1, but entries are grouped by **job number** instead of calendar day.
- Each job block shows every entry of that job (date, time, completed by, one line per steam, movements). Ticking the job selects all its awaiting entries for one sign-off; entries can also be ticked one by one.
- Only jobs that still have an entry awaiting verification are listed, most recently active first.
- **PDF / print is NOT changed** for job-based records. The Print button and the per-entry PDF keep their existing behaviour (the job sheet). No monthly log.

### 5. Awaiting Verification page (`pages/awaiting-verification.html`)

The central queue follows the same grouping, so it is no longer one line per entry for these records:

| Record | Grouped by | One line shows | Preview shows |
|--------|-----------|----------------|---------------|
| Drying Process (REC 7.4.1) | Job number | job no., entries + steams awaiting, submitted by, date range, days waiting | every awaiting entry of the job, one line per steam, movements |
| Chiller / Water / LHA monitoring | Calendar day (facility time) | day, entries awaiting, submitted by, days waiting | every awaiting entry of the day with its field values |

- Ticking a line selects all its entries; the line must be previewed first (same "no preview, no verify" rule as before).
- The preview lists only entries still awaiting verification. All other records on the page are unchanged (one line per entry).

---

## Status — implemented (November 2026)

| Part | Where | Records |
|------|-------|---------|
| Daily verification view, full log, monthly PDF | `public/lib/monitoring-log.js` | `chiller-temperature-monitoring`, `water-monitoring` |
| Daily verification view, monthly PDF | `public/lib/form-record.js` | LHA water monitoring (page uses record key `rec-7.8.9.1`) |
| Job-grouped verification view (no print change) | `public/lib/form-record.js` | `drying-process` |
| Grouped queue (by job / by day) | `public/pages/awaiting-verification.html` | all of the above |

Not yet tested with a real signed-in verification or a real paper print — only in the local preview with test entries.

---

## Implementation notes

### Where the logic lives
- `public/lib/monitoring-log.js` — engine for the chiller and water monitoring logs: `DAILY_LOG_KEYS`, `renderDailyVerifySelect`, `printMonthlyLog`
- `public/lib/form-record.js` — engine for LHA and Drying Process: `DAILY_LOG_KEYS` (by day), `JOB_LOG_KEYS` (by job), `dayLogTableHtml`, `renderDailyVerifySelect`, `printMonthlyLog`
- `public/pages/awaiting-verification.html` — central queue: `groupMode()`, `DAY_KEYS`, `renderJobGroup`, `jobPreview`, `dayPreviewTable`
- `public/lib/signoff-block.js` — sign-off / verification history (unchanged)

Note: the chiller and water records do **not** use `form-record.js`; they run on `monitoring-log.js`.

### Date scoping
- **Verification view** — filter by `submittedAt >= startOfDay(today)` and `< startOfDay(tomorrow)`, local timezone.
- **Monthly PDF** — filter by `submittedAt >= startOfMonth(today)` and `<= endOfDay(today)`, local timezone.
- Both use the same timezone the app already uses for display.

### Record keys to target first
```
chiller-temperature-monitoring
water-monitoring
lha-water-monitoring
```

These records have no `roster` / no multi-row steam sections — their entries are flat per-submission rows, which makes them the cleanest starting point.

### Version bump
After editing `form-record.js` or `monitoring-log.js`, bump `?v=N` in every referencing HTML file:
```bash
grep -rl "form-record.js" public/records/
grep -rl "monitoring-log.js" public/records/
```
`awaiting-verification.html` has its script inline, so it needs no version bump. That file is not UTF-8 (legacy Windows-1252) — edit it with a tool that keeps the encoding.

### Export / static JSON
No change to `public/data/record-defs/*.json` is needed — this is a runtime data-scoping change, not a record definition change. No need to run `export-record-defs.mjs`.

---

## Reuse on other records

This pattern (daily verification view, full submission log, monthly PDF) is intended to roll out to any record. When attaching to a new record:
1. Confirm the record key and which engine its page loads (`form-record.js` or `monitoring-log.js`).
2. Decide the grouping: **by day** (flat logs; also switches PDF to the monthly log) or **by job number** (job-based records with a `batchField`; printing unchanged).
3. Switch it on, either way:
   - **In code:** add the key to `DAILY_LOG_KEYS` (by day) or `JOB_LOG_KEYS` (by job) in the engine, and to `DAY_KEYS` / `groupMode()` in `awaiting-verification.html`.
   - **In the record definition:** `"dailyVerificationLog": true` (by day) or `"verificationGroupBy": "job"` (by job). Both the engines and the Awaiting Verification page read these flags. `"dailyVerificationLog": false` switches a record off.
4. If the engine file changed, bump its `?v=N`.
