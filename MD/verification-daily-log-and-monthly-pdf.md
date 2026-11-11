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

## Implementation notes

### Where verification logic lives
- `public/lib/form-record.js` — main form engine, handles render, roster, sign-off
- `public/lib/signoff-block.js` — sign-off / approval section
- `public/lib/api-backend.js` — client-side API calls

### Where print / PDF logic lives
- `public/lib/form-record.js` — `printCompact`, `printTable` flags
- `public/styles/record-theme.css` — shared form styles

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
After editing `form-record.js`, bump `?v=N` in every referencing HTML file:
```bash
grep -rl "form-record.js" public/records/
```

### Export / static JSON
No change to `public/data/record-defs/*.json` is needed — this is a runtime data-scoping change, not a record definition change. No need to run `export-record-defs.mjs`.

---

## Reuse on other records

This pattern (daily verification view, full submission log, monthly PDF) is intended to roll out to any record. When attaching to a new record:
1. Confirm the record key.
2. Confirm whether it has a `roster` (repeat rows / steams) — if yes, clarify whether the daily verification should cover the whole record or individual roster rows.
3. Apply the same date-scoping logic.
4. No record-def changes required — this is a form-engine / API layer change.
