# NC Log — Non-Conformance & Issues Register

**Date:** 2026-10-06  
**Raised by:** Michaela  
**Type:** New page + database table + index button  
**Use in:** Claude Code (build)  
**Files to create/edit:**
- `public/pages/nc-log.html` ← new page
- `public/index.html` ← add button
- Database ← add `nc_log` table (migration script)
- `server/routes/nc.js` (or equivalent API file) ← new API routes

---

## 1. Purpose

A single register for every non-conformance (NC) or issue raised across the processing facility. Each NC records what went wrong, on which job and record, when it happened, and what was done to fix it. The NC log is browsable, filterable, and shows open (unresolved) NCs clearly so nothing falls through.

---

## 2. Database table — `nc_log`

### 2a. Migration SQL (run once against Neon)

```sql
CREATE TABLE IF NOT EXISTS nc_log (
  id               SERIAL PRIMARY KEY,
  nc_ref           TEXT NOT NULL UNIQUE,          -- auto-generated e.g. NC-2026-0001
  raised_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_number       TEXT,                           -- e.g. DPR01167
  record_ref       TEXT,                           -- e.g. REC-7.4.2
  submission_id    INTEGER,                        -- FK to the source submission if known
  raised_by        TEXT NOT NULL,                  -- user name / passkey ID
  category         TEXT NOT NULL,                  -- dropdown: see section 3
  description      TEXT NOT NULL,                  -- what the problem was
  severity         TEXT NOT NULL DEFAULT 'minor',  -- 'minor' | 'major' | 'critical'
  status           TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'in_progress' | 'closed'
  corrective_action TEXT,                          -- what was done to fix it
  closed_by        TEXT,                           -- user who closed it
  closed_at        TIMESTAMPTZ,
  notes            TEXT,                           -- any additional notes
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate nc_ref on insert
CREATE SEQUENCE IF NOT EXISTS nc_ref_seq START 1;

CREATE OR REPLACE FUNCTION set_nc_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nc_ref IS NULL OR NEW.nc_ref = '' THEN
    NEW.nc_ref := 'NC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('nc_ref_seq')::TEXT, 4, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nc_ref
BEFORE INSERT ON nc_log
FOR EACH ROW EXECUTE FUNCTION set_nc_ref();

CREATE TRIGGER trg_nc_updated
BEFORE UPDATE ON nc_log
FOR EACH ROW EXECUTE FUNCTION set_nc_ref();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nc_status    ON nc_log (status);
CREATE INDEX IF NOT EXISTS idx_nc_job       ON nc_log (job_number);
CREATE INDEX IF NOT EXISTS idx_nc_raised_at ON nc_log (raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_nc_record    ON nc_log (record_ref);
```

### 2b. NC category values

Store as free text (TEXT column) but constrain via the UI dropdown. Suggested categories:
- `Weight deviation`
- `Temperature out of spec`
- `Labelling error`
- `Equipment failure`
- `Process deviation`
- `Product quality`
- `Dry room issue`
- `Documentation error`
- `Hygiene / sanitation`
- `Other`

---

## 3. API routes (add to existing Express/backend)

All routes under `/api/nc`.

### GET `/api/nc` — list NCs

Query params: `status` (open/in_progress/closed/all), `job`, `record`, `from`, `to`, `limit` (default 100), `offset` (default 0).

Returns array of NC rows ordered by `raised_at DESC`.

### POST `/api/nc` — create new NC

Body:
```json
{
  "job_number":    "DPR01167",
  "record_ref":    "REC-7.4.2",
  "submission_id": 42,
  "raised_by":     "Michaela",
  "category":      "Temperature out of spec",
  "description":   "Dry room temp exceeded 32°C at 14:30",
  "severity":      "major"
}
```
Returns the created row including `nc_ref`.

### PATCH `/api/nc/:id` — update (add corrective action / close)

Body fields: `corrective_action`, `status`, `closed_by`, `notes`.  
When `status` is set to `"closed"`, the server sets `closed_at = NOW()` automatically.

### GET `/api/nc/count-open` — used by the dashboard tile

Returns `{ "openNCs": 3 }`. Called by `index.html` dashboard script.

---

## 4. NC log page — `public/pages/nc-log.html`

### 4a. Page header

Title: **Non-Conformance Log**  
Subtitle: "All raised NCs and issues — open and closed"

Two action buttons in the top-right:
- **＋ Raise NC** — opens the Raise NC modal (section 4c)
- **Export CSV** — downloads all visible (filtered) rows as CSV

### 4b. Filter bar (above the table)

```
Status: [All ▾]   Job: [________]   Record: [________]   From: [date]   To: [date]   [Search]
```

Status options: All / Open / In progress / Closed.

### 4c. NC table columns

| Column | Notes |
|---|---|
| NC Ref | e.g. `NC-2026-0001` — bold, links to detail modal |
| Date/Time raised | `DD/MM/YYYY HH:mm` |
| Job number | clickable if job exists |
| Record | e.g. `REC-7.4.2` |
| Category | |
| Description | truncate at 80 chars; full text on hover / modal |
| Severity | badge: Minor (grey) / Major (amber) / Critical (red) |
| Status | badge: Open (red) / In progress (amber) / Closed (green) |
| Corrective action | truncate at 60 chars; full text on modal |
| Closed by / date | blank if open |
| Action | **[View / Edit]** button |

Sort: default `raised_at DESC`. Click any column header to re-sort.

### 4d. Row highlighting

- Open + Critical → full row background `#fef2f2` (light red)
- Open + Major → full row background `#fffbeb` (light amber)
- Closed → slightly muted / no highlight

### 4e. Raise NC modal

Fields (all on one form):

```
Job number:      [__________]   (optional, text)
Record ref:      [__________]   (optional, text — e.g. REC-7.4.2)
Category:        [dropdown]     (required)
Severity:        [Minor ▾]      (required)
Raised by:       [__________]   (required — pre-fill from session user)
Description:     [textarea]     (required — what went wrong)
Corrective action: [textarea]   (optional at creation, add later)
```

Submit button: **Raise NC**. On success, show nc_ref in a confirmation banner and reload table.

### 4f. View / Edit modal

Shows all fields. If status is not Closed:
- Allow editing `corrective_action`, `status`, `notes`, `closed_by`.
- When status is changed to "Closed", show confirmation prompt: "Mark this NC as resolved?"
- Closing logs `closed_at` automatically (server-side).

---

## 5. Index page — Add NC button

In `public/index.html`, in the top navigation bar (hamburger menu or top-bar area — use whichever pattern the existing menu uses):

Add a menu item / button:

```
⚠ NC Log
```

Link: `pages/nc-log.html`

If there are open NCs (from `/api/nc/count-open`), show a red badge with the count next to this link in the nav. Example: `⚠ NC Log  [3]`

This badge count is loaded at the same time as the 24-hr dashboard data.

---

## 6. Email alert when NC is raised on Dry Monitoring (REC-7.4.2)

### Trigger condition

Any time a new NC is submitted (via `POST /api/nc`) where `record_ref` matches `REC-7.4.2` (Dry Monitoring record), the server must send an email alert immediately.

### What the email must contain

**Subject:** `⚠ NC Raised — Dry Monitoring [Job: {job_number}] — {nc_ref}`

**Body (plain text + HTML version):**

```
Non-Conformance raised on Dry Monitoring record.

NC Reference:  NC-2026-XXXX
Job number:    DPR01167
Date/Time:     06/10/2026 14:30
Raised by:     Michaela
Category:      Temperature out of spec
Severity:      Major
Description:
  Dry room temp exceeded 32°C at 14:30. Fan unit 2 not responding.

Corrective action logged:
  (none yet — update the NC log when resolved)

View the NC log: https://processing-department.onrender.com/pages/nc-log.html

---
Abagold Processing Facility — Automated Alert
```

### Email recipient(s)

For now: hardcode the recipient email(s) in an environment variable:

```
NC_EMAIL_RECIPIENTS=michaela@abagold.co.za
```

Multiple recipients: comma-separated. The server reads this env var and sends to all.

### Implementation (server-side)

Use **Nodemailer** (already likely in the project) or add it:

```
npm install nodemailer
```

In the POST `/api/nc` handler, after successful DB insert:

```javascript
const TRIGGER_RECORDS = ['REC-7.4.2'];  // expand list as needed

if (TRIGGER_RECORDS.includes(newNC.record_ref)) {
  await sendNCAlert(newNC);
}
```

Email config via env vars (add to `.env` and to Render environment variables):

```
SMTP_HOST=smtp.gmail.com          # or your SMTP provider
SMTP_PORT=587
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-app-password
NC_EMAIL_FROM=noreply@abagold.co.za
NC_EMAIL_RECIPIENTS=michaela@abagold.co.za
```

If using Gmail, use an **App Password** (not the account password). Generate at: Google Account → Security → 2-Step Verification → App passwords.

### Alert triggering from the record itself (optional enhancement)

When the Dry Monitoring record (REC-7.4.2) is submitted and a field is out of spec (e.g. temperature outside 25–32°C range), the form can automatically pre-open the "Raise NC" modal with `record_ref` and `job_number` pre-filled, so the operator doesn't have to navigate to the NC log manually. This is optional and can be added later.

---

## 7. Checks before finishing

- [ ] `nc_log` table created in Neon with correct columns and `nc_ref` auto-generation.
- [ ] `GET /api/nc` returns empty array on fresh install, no errors.
- [ ] `POST /api/nc` creates a row and returns `nc_ref` like `NC-2026-0001`.
- [ ] `GET /api/nc/count-open` returns `{ "openNCs": 0 }`.
- [ ] NC log page loads at `pages/nc-log.html` with empty state message "No NCs raised yet."
- [ ] "Raise NC" modal opens, submits, and newly raised NC appears in the table.
- [ ] Severity badges show correct colours.
- [ ] Status badge changes correctly when corrective action added and NC closed.
- [ ] Index page nav shows "⚠ NC Log" link navigating to correct page.
- [ ] When an NC is raised for `REC-7.4.2`, an email arrives at `NC_EMAIL_RECIPIENTS`.
- [ ] Email subject includes nc_ref and job number.
- [ ] Mobile: table is horizontally scrollable; modal fills screen without overflow.
- [ ] Export CSV downloads all visible filtered rows with correct headers.
