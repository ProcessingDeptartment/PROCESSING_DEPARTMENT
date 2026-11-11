# Production Handover — Transfer to Neon DB

Migrate the handover record system from the separate `handover-backend` MongoDB service to the main Neon Postgres DB. The goal is to decommission the MongoDB backend and have all handover data live in Neon via the main API.

---

## Context

| Thing | Current state |
|---|---|
| Client library | `public/lib/handover-db.js` — uses `localStorage` + syncs to separate backend |
| Backend | `handover-backend/server.js` — standalone Express + MongoDB Atlas, deployed as separate Render service at `https://handover-backend.onrender.com` |
| Main API | `https://processing-department-api.onrender.com` — Node/Express + Prisma + Neon |
| Front-end pages | `production-handover-report.html`, `quality-handover-report.html` |

The `handover-db.js` library hits `window.HANDOVER_BACKEND_URL || 'https://handover-backend.onrender.com'` for create/update and list. This needs to move to the main API.

---

## Step 1 — Add Prisma model

In `prisma/schema.prisma`, add after the last existing model:

```prisma
model HandoverRecord {
  id          String   @id                // e.g. "production:2026-11-10:day"
  page        String                      // "production" | "quality"
  pageLabel   String?
  date        String?                     // ISO date string "YYYY-MM-DD"
  shift       String?                     // "day" | "night" etc.
  ownerName   String?
  status      String   @default("draft")  // "draft" | "submitted"
  updatedAt   BigInt   @default(0)        // JS timestamp (ms)
  submittedAt BigInt?
  receivedAt  BigInt
  payload     String   @default("{}")     // full form state JSON string
  createdAt   DateTime @default(now())

  @@index([page, date])
}
```

Then run the Prisma migration:

```bash
npx prisma migrate dev --name add-handover-record
```

If running against production Neon only (no local DB):

```bash
npx prisma migrate deploy
```

---

## Step 2 — Add API routes in `src/index.js`

Add a new section for handover routes. Insert before the final `app.listen` / export line. Create a helper function and four routes:

### Helper — parse handover body

```js
// --- Handover helpers ---
function sanitiseHandover(raw) {
  const now = Date.now();
  return {
    id:          raw.id,
    page:        raw.page        || null,
    pageLabel:   raw.pageLabel   || null,
    date:        raw.date        || null,
    shift:       raw.shift       || null,
    ownerName:   raw.ownerName   || null,
    status:      raw.status      || 'draft',
    updatedAt:   BigInt(raw.updatedAt  || now),
    submittedAt: raw.submittedAt ? BigInt(raw.submittedAt) : null,
    receivedAt:  BigInt(now),
    payload:     JSON.stringify(raw.payload || {}),
  };
}
```

### POST `/api/handovers` — create or update (upsert)

```js
app.post('/api/handovers', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body.id !== 'string' || !body.id) {
      return res.status(400).json({ error: 'Missing required field: id' });
    }
    const data = sanitiseHandover(body);
    const record = await prisma.handoverRecord.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
    res.json({ ok: true, id: record.id, receivedAt: Number(record.receivedAt) });
  } catch (err) {
    console.error('POST /api/handovers error', err);
    res.status(500).json({ error: err.message });
  }
});
```

### GET `/api/handovers` — list (optionally filtered by page)

```js
app.get('/api/handovers', requireAuth, async (req, res) => {
  try {
    const { page } = req.query;
    const where = page ? { page } : {};
    const rows = await prisma.handoverRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }, { shift: 'asc' }],
      select: {
        id: true, page: true, pageLabel: true, date: true, shift: true,
        ownerName: true, status: true, updatedAt: true, submittedAt: true, receivedAt: true,
      },
    });
    // Convert BigInt fields to Number for JSON serialisation
    const records = rows.map(r => ({
      ...r,
      updatedAt:   Number(r.updatedAt),
      submittedAt: r.submittedAt !== null ? Number(r.submittedAt) : null,
      receivedAt:  Number(r.receivedAt),
    }));
    res.json({ records });
  } catch (err) {
    console.error('GET /api/handovers error', err);
    res.status(500).json({ error: err.message });
  }
});
```

### GET `/api/handovers/:id` — single record with payload

```js
app.get('/api/handovers/:id', requireAuth, async (req, res) => {
  try {
    const row = await prisma.handoverRecord.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Record not found' });
    res.json({
      id:          row.id,
      page:        row.page,
      pageLabel:   row.pageLabel,
      date:        row.date,
      shift:       row.shift,
      ownerName:   row.ownerName,
      status:      row.status,
      updatedAt:   Number(row.updatedAt),
      submittedAt: row.submittedAt !== null ? Number(row.submittedAt) : null,
      receivedAt:  Number(row.receivedAt),
      payload:     JSON.parse(row.payload || '{}'),
    });
  } catch (err) {
    console.error('GET /api/handovers/:id error', err);
    res.status(500).json({ error: err.message });
  }
});
```

### GET `/api/handovers/export` — Excel download (keep parity with old backend)

Add this **before** the `/:id` route so it isn't consumed by the param handler:

```js
app.get('/api/handovers/export', requireAuth, async (req, res) => {
  try {
    // ExcelJS is already in package.json if the handover-backend used it;
    // if not: npm install exceljs
    const ExcelJS = require('exceljs');
    const rows = await prisma.handoverRecord.findMany({
      orderBy: [{ date: 'desc' }, { shift: 'asc' }],
    });
    if (!rows.length) return res.status(404).json({ error: 'No records to export' });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Handovers');
    worksheet.columns = [
      { header: 'Date',      key: 'date',      width: 12 },
      { header: 'Shift',     key: 'shift',     width: 10 },
      { header: 'Page',      key: 'page',      width: 15 },
      { header: 'Manager',   key: 'ownerName', width: 20 },
      { header: 'Status',    key: 'status',    width: 12 },
      { header: 'Updated',   key: 'updatedAt', width: 20 },
      { header: 'Submitted', key: 'submittedAt', width: 20 },
    ];
    rows.forEach(row => {
      worksheet.addRow({
        date:        row.date,
        shift:       row.shift,
        page:        row.page,
        ownerName:   row.ownerName,
        status:      row.status,
        updatedAt:   new Date(Number(row.updatedAt)).toLocaleString(),
        submittedAt: row.submittedAt ? new Date(Number(row.submittedAt)).toLocaleString() : 'N/A',
      });
    });
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="handovers_${today}.xlsx"`,
    });
    res.end(buffer);
  } catch (err) {
    console.error('GET /api/handovers/export error', err);
    res.status(500).json({ error: err.message });
  }
});
```

**Dependency check:** if `exceljs` is not in `package.json` root dependencies, add it:

```bash
npm install exceljs
```

---

## Step 3 — Update `public/lib/handover-db.js`

Change the backend URL constant (line ~9) from:

```js
const BACKEND_URL = window.HANDOVER_BACKEND_URL || 'https://handover-backend.onrender.com';
```

to:

```js
const BACKEND_URL = window.HANDOVER_BACKEND_URL || 'https://processing-department-api.onrender.com';
```

No other changes needed — the route paths (`/api/handovers`, `/api/handovers/:id`, `/api/handovers/export`) are identical to what the old backend served.

---

## Step 4 — Migrate existing MongoDB data

The old backend has data in MongoDB. Migrate it in a one-time script.

Create `scripts/migrate-handovers-from-mongo.mjs`:

```js
// One-time: fetch all records from the old handover-backend and POST them to the new API.
// Run once after the new routes are deployed.
// Usage: HANDOVER_OLD_URL=https://handover-backend.onrender.com API_URL=https://processing-department-api.onrender.com API_KEY=<your-api-key> node scripts/migrate-handovers-from-mongo.mjs

const OLD_URL = process.env.HANDOVER_OLD_URL || 'https://handover-backend.onrender.com';
const NEW_URL = process.env.API_URL          || 'https://processing-department-api.onrender.com';
const API_KEY = process.env.API_KEY          || '';

async function run() {
  // 1. Fetch list from old backend
  const listRes = await fetch(`${OLD_URL}/api/handovers`);
  if (!listRes.ok) throw new Error(`Failed to list old handovers: ${listRes.status}`);
  const { records } = await listRes.json();
  console.log(`Found ${records.length} records in old backend`);

  let ok = 0, fail = 0;
  for (const summary of records) {
    // 2. Fetch full record (with payload) from old backend
    const detailRes = await fetch(`${OLD_URL}/api/handovers/${encodeURIComponent(summary.id)}`);
    if (!detailRes.ok) {
      console.error(`  SKIP ${summary.id}: detail fetch failed (${detailRes.status})`);
      fail++;
      continue;
    }
    const record = await detailRes.json();

    // 3. POST to new Neon-backed API
    const postRes = await fetch(`${NEW_URL}/api/handovers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify(record),
    });
    if (!postRes.ok) {
      const err = await postRes.text();
      console.error(`  FAIL ${record.id}: ${postRes.status} ${err}`);
      fail++;
    } else {
      console.log(`  OK  ${record.id}`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} migrated, ${fail} failed.`);
}

run().catch(err => { console.error(err); process.exit(1); });
```

Run after deploying the new routes:

```bash
HANDOVER_OLD_URL=https://handover-backend.onrender.com \
API_URL=https://processing-department-api.onrender.com \
node scripts/migrate-handovers-from-mongo.mjs
```

Adjust auth headers in the script if the new `/api/handovers` route uses session/passkey auth rather than an API key — the `requireAuth` middleware in `src/index.js` determines this.

---

## Step 5 — Verify and decommission

After deployment and migration:

1. Open `production-handover-report.html` and `quality-handover-report.html` in the browser
2. Check Network tab: POST and GET calls should now hit `processing-department-api.onrender.com/api/handovers`, not `handover-backend.onrender.com`
3. Confirm existing records appear in the list (loaded from Neon, not localStorage only)
4. Submit a test handover and verify it appears in the new list

Once confirmed working, decommission the `handover-backend` Render service:
- Suspend or delete the `handover-backend` service in the Render dashboard
- Keep `handover-backend/` directory in the repo as an archive (or remove it and commit the removal)

---

## Files changed summary

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `HandoverRecord` model |
| `prisma/migrations/…` | Auto-generated by `prisma migrate` |
| `src/index.js` | Add `sanitiseHandover()` helper + 4 routes |
| `package.json` | Add `exceljs` if not already present |
| `public/lib/handover-db.js` | Change `BACKEND_URL` to main API |
| `scripts/migrate-handovers-from-mongo.mjs` | New one-time migration script |
