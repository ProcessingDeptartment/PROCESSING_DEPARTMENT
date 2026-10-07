# FSMS Calendar — Online Implementation Instructions

**Doc code:** FSMS-CAL-001  
**Author:** Michaela · Abagold Processing Facility  
**Date:** 2026-10-07  
**Purpose:** Move the QAM annual FSMS calendar (currently Excel files, 2020–2026) into the Processing Department online system with year-setup wizard and future email notifications.

---

## 1. What the calendar tracks (from existing Excel files)

Each year's file has one sheet with rows grouped by **category** and columns per **month** (Jan–Dec). The categories found across all years are:

| Category | Description |
|---|---|
| **Audits** | Internal audits, NRCS inspections, FSSC 22000 audits, HACCP audits |
| **Monthly Testing** | Micro testing (water, swabs, abalone, drain swabs); airplates |
| **Annual Testing / Verification** | Water (SANS 241), commercial sterility, heavy metals, OPRP verification, F0 heat distribution, HACCP CCP validation |
| **Calibration** | Micrometer, scales, retorts, thermometers, pH meter, salt & brix meters |
| **Medicals** | Employee medical examinations schedule |
| **Mock Recalls** | Canned/dry/live recalls; traceability exercises |
| **GMP** | Facility (GMP) inspections |
| **Training** | External training events (double seam, HACCP, internal audit, H&S rep) |
| **Meetings** | FSMS review, management review, food safety team meetings |

Each cell contains a **task title / description** assigned to a **month**. Some tasks have specific dates noted inline (e.g. "FSSC 22000 Audit (22–25 June)").

---

## 2. Database schema (Neon Postgres / Prisma)

Add these tables to the existing Prisma schema (`prisma/schema.prisma`):

```prisma
model FsmsYear {
  id        Int            @id @default(autoincrement())
  year      Int            @unique
  notes     String?
  createdAt DateTime       @default(now())
  events    FsmsEvent[]
}

model FsmsCategory {
  id       Int          @id @default(autoincrement())
  name     String       @unique   // "Audits", "Monthly Testing", etc.
  color    String       @default("#64748b")  // hex for UI badge
  sortOrder Int         @default(0)
  events   FsmsEvent[]
}

model FsmsEvent {
  id           Int          @id @default(autoincrement())
  yearId       Int
  categoryId   Int
  month        Int          // 1–12
  title        String       // task label
  notes        String?      // extra detail / date within month
  status       String       @default("pending")  // pending | done | skipped
  completedAt  DateTime?
  completedBy  String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  year         FsmsYear     @relation(fields: [yearId], references: [id])
  category     FsmsCategory @relation(fields: [categoryId], references: [categoryId])

  @@index([yearId, month])
  @@index([yearId, categoryId])
}
```

**Migration command (run once):**
```bash
npx prisma migrate dev --name add_fsms_calendar
```

---

## 3. Seed data — categories

Run this SQL once via Neon console or a seed script to insert the standard categories:

```sql
INSERT INTO "FsmsCategory" (name, color, "sortOrder") VALUES
  ('Audits',                      '#dc2626', 0),
  ('Monthly Testing',             '#2563eb', 1),
  ('Annual Testing/Verification', '#7c3aed', 2),
  ('Calibration',                 '#d97706', 3),
  ('Medicals',                    '#16a34a', 4),
  ('Mock Recalls',                '#0891b2', 5),
  ('GMP',                         '#65a30d', 6),
  ('Training',                    '#9333ea', 7),
  ('Meetings',                    '#475569', 8)
ON CONFLICT (name) DO NOTHING;
```

---

## 4. API endpoints (Express — `src/routes/fsms-calendar.js`)

Create these REST endpoints on the API server:

```
GET    /api/fsms/years                  → list all years (id, year, event count)
GET    /api/fsms/years/:year            → full year with all events grouped by category
POST   /api/fsms/years                  → create new year (body: { year })
POST   /api/fsms/years/:year/clone      → clone events from another year (body: { sourceYear })
GET    /api/fsms/categories             → list all categories
POST   /api/fsms/events                 → create event (body: { year, categoryId, month, title, notes })
PATCH  /api/fsms/events/:id             → update event (title, notes, status, completedAt, completedBy)
DELETE /api/fsms/events/:id             → delete event
GET    /api/fsms/upcoming?days=30       → events in next N days (for dashboard widget + future email)
```

### Key logic — clone year

`POST /api/fsms/years/:year/clone` copies all events from `sourceYear` into the new year, resetting `status` to `"pending"` and clearing `completedAt`/`completedBy`. This is the **"set up next year"** feature — the QAM copies the previous year, then adjusts dates/titles as needed.

---

## 5. Front-end page (`public/fsms/calendar.html`)

### Layout

```
┌─────────────────────────────────────────────┐
│  FSMS Calendar  [2026 ▾]  [+ New Year]      │
│                 [Clone from prev year]       │
├────────┬────┬────┬────┬────┬────┬────┬──────┤
│Category│Jan │Feb │Mar │Apr │May │Jun │ ...  │
├────────┼────┼────┼────┼────┼────┼────┼──────┤
│Audits  │ ·  │ ·  │ ·  │    │    │    │      │
│Monthly │ ·  │ ·  │ ·  │ ·  │ ·  │ ·  │      │
│Annual  │    │    │ ·  │    │ ·  │    │      │
│...     │    │    │    │    │    │    │      │
└────────┴────┴────┴────┴────┴────┴────┴──────┘
```

- Each cell with a task shows a **coloured badge** (category colour) with the task title
- Click a badge → side panel opens showing title, notes, status, completed-by
- QAM can mark as **Done** or **Skipped** with their name
- **Current month column** is highlighted
- **Upcoming** tab shows next 60 days as a sorted list

### JS file: `public/lib/fsms-calendar.js`

Core functions to implement:

```javascript
// Load year data
async function loadYear(year) { ... }

// Render grid
function renderGrid(data) { ... }  // data = { categories, events grouped by [categoryId][month] }

// Open event detail panel
function openEvent(eventId) { ... }

// Mark event done
async function markDone(eventId, completedBy) { ... }

// Clone year from previous
async function cloneYear(newYear, sourceYear) { ... }

// Add new event inline
async function addEvent(categoryId, month, title) { ... }
```

### HTML shell (`public/fsms/calendar.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FSMS Calendar</title>
  <link rel="stylesheet" href="../styles/record-theme.css">
  <link rel="stylesheet" href="fsms-calendar.css">
</head>
<body>
  <div id="fsms-app">
    <header class="fsms-header">
      <h1>FSMS Calendar</h1>
      <div class="fsms-controls">
        <select id="year-select"></select>
        <button id="btn-new-year">+ New Year</button>
        <button id="btn-clone-year">Clone from Previous</button>
      </div>
    </header>
    <div id="fsms-grid"></div>
    <aside id="event-panel" class="hidden"></aside>
  </div>
  <script src="../lib/fsms-calendar.js?v=1"></script>
</body>
</html>
```

---

## 6. Navigation — add to home page

In `public/index.html`, add FSMS Calendar as a block in the QAM / Management section:

```html
<a href="/fsms/calendar.html" class="home-block">
  <span class="block-icon">📅</span>
  <span class="block-title">FSMS Calendar</span>
  <span class="block-sub">Annual QAM schedule & compliance tracker</span>
</a>
```

---

## 7. Year setup wizard (new year flow)

When QAM clicks **"+ New Year"**:

1. Modal appears: **"Set up [next year]"**
2. Option A — **Clone from [current year]**: copies all events, QAM reviews and edits
3. Option B — **Start blank**: opens empty grid, QAM adds events manually
4. After clone, show diff view: "These events were carried over — review dates and adjust if needed"
5. Save → creates `FsmsYear` + all `FsmsEvent` rows

**Clone is the recommended path** — it takes < 2 minutes to set up a new year.

---

## 8. Future: email notifications

This is planned but not in scope for v1. When ready, add:

```prisma
model FsmsNotificationRule {
  id         Int    @id @default(autoincrement())
  categoryId Int?   // null = all categories
  daysAhead  Int    @default(7)   // send N days before month starts
  recipients String // comma-separated emails
  active     Boolean @default(true)
}
```

The API will have a cron endpoint (`GET /api/fsms/send-reminders`) called by a scheduler (e.g. Render cron job or GitHub Actions schedule) that:
1. Queries upcoming events within `daysAhead` days
2. Groups by recipient
3. Sends email via SendGrid / Resend (to be configured)

---

## 9. Import existing Excel data

Run a one-time import script (`scripts/import-fsms-calendar.mjs`) to load 2020–2026 data:

```javascript
// Pseudocode — implement with exceljs or xlsx npm package
for each Excel file (2020..2026):
  parse sheet → extract year, category rows, month columns
  for each non-empty cell:
    upsert FsmsYear(year)
    match category name → FsmsCategory.id
    insert FsmsEvent(yearId, categoryId, month, title)
```

This preserves historical data so the QAM can see what was planned vs done in past years.

```bash
node scripts/import-fsms-calendar.mjs
```

---

## 10. Files to create / modify

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `FsmsYear`, `FsmsCategory`, `FsmsEvent`, `FsmsNotificationRule` models |
| `src/routes/fsms-calendar.js` | New Express router with all API endpoints |
| `src/index.js` | Mount: `app.use('/api/fsms', require('./routes/fsms-calendar'))` |
| `public/fsms/calendar.html` | New page (HTML shell) |
| `public/lib/fsms-calendar.js` | New JS file — grid render, API calls, event panel |
| `public/styles/fsms-calendar.css` | New CSS — grid layout, badges, panel |
| `public/index.html` | Add FSMS Calendar block to home |
| `scripts/import-fsms-calendar.mjs` | One-time import of Excel data |
| `MD/fsms-calendar-instructions.md` | This file (save to repo) |

---

## 11. Build order for Claude Code

Build in this sequence:

1. **Schema** — add Prisma models → `npx prisma migrate dev`
2. **Seed categories** — SQL insert
3. **API routes** — `src/routes/fsms-calendar.js` + mount in `src/index.js`
4. **Import script** — `scripts/import-fsms-calendar.mjs` (run once with `DATABASE_URL`)
5. **Front-end** — `calendar.html` + `fsms-calendar.js` + `fsms-calendar.css`
6. **Home page** — add nav block
7. **Test** — verify all years visible, clone flow, mark-done flow
8. **Commit + push** → Render auto-deploys

---

## 12. Design principles

- **QAM owns this page** — simple grid, no technical jargon
- **Historical read-only** — past years are viewable but events cannot be edited (status can still be marked done if missed)
- **Clone is king** — setting up a new year should take under 5 minutes
- **Mobile-friendly** — QAM uses tablet; grid scrolls horizontally on small screens
- **No build step** — follows existing pattern: plain JS, no frameworks, Render serves `public/` as static
