# Central Image Archive — Unified Submission Images (instructions for Claude Code)

**Purpose:** Replace the per-record `sub_dry_monitoring_images` table with a single central `submission_images` table that handles images from all records. Build a unified local archive agent that automatically covers all current and future image-enabled records. No agent changes are needed when new records gain image support.

**Naming convention:** `<recNo>_<jobNo>_<submissionId>_<fieldKey>_<YYYYMMDD>_<imageId>.<ext>`
Example: `742_J0023_91_mouldVisible_20261014_204.jpg`
- `742` = record number (REC 7.4.2 → `742`)
- `J0023` = job number from the submission
- `91` = submission ID
- `mouldVisible` = field key
- `20261014` = date uploaded
- `204` = image row ID (unique, prevents collisions)

---

## 1. Central `submission_images` table

### 1a. Create table

```sql
CREATE TABLE IF NOT EXISTS submission_images (
  id               SERIAL PRIMARY KEY,
  record_key       TEXT        NOT NULL,   -- e.g. 'dry-monitoring', 'grading-boxing'
  record_no        TEXT        NOT NULL,   -- e.g. '742', '741', '743' — short code for filenames
  submission_id    INTEGER     NOT NULL,   -- row ID in the source submission table
  job_no           TEXT,                  -- job number pulled from the submission at upload time
  field_key        TEXT        NOT NULL,   -- matches the fieldKey in the record definition
  field_label      TEXT,                  -- human-readable field name e.g. "Mould visible" — stored at upload time
  image_data       TEXT        NOT NULL,   -- base64 data URI e.g. "data:image/jpeg;base64,..."
  file_name        TEXT,                   -- original filename from device
  file_size_bytes  INTEGER,
  mime_type        TEXT,                   -- 'image/jpeg', 'image/png', 'image/webp'
  caption          TEXT,
  uploaded_by      TEXT,                   -- passkey/user at time of upload
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  -- Archive tracking
  archived_locally  BOOLEAN    NOT NULL DEFAULT FALSE,
  archived_at       TIMESTAMPTZ,
  archived_path     TEXT,                  -- full local path after archival
  archive_attempts  INTEGER    NOT NULL DEFAULT 0,
  archive_failed    BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_si_record      ON submission_images(record_key, submission_id);
CREATE INDEX IF NOT EXISTS idx_si_job         ON submission_images(job_no);
CREATE INDEX IF NOT EXISTS idx_si_pending     ON submission_images(archived_locally, archive_failed)
  WHERE archived_locally = FALSE AND archive_failed = FALSE;
CREATE INDEX IF NOT EXISTS idx_si_uploaded_at ON submission_images(uploaded_at);
```

### 1b. Record registry (source of truth for record_no values)

Maintain this mapping in a shared config file `src/image-record-registry.js` (used by both the API and the archive agent):

```js
// Maps record_key → short record number used in filenames and folder names
export const IMAGE_RECORD_REGISTRY = {
  'dry-monitoring':  '742',
  'grading-boxing':  '743',   // update with actual REC numbers as records gain image support
  'cooking':         '740',
  'blanching':       '741',
  // Add new records here — no other changes needed
};
```

---

## 2. Migrate existing `sub_dry_monitoring_images` data

Run once. Pulls job number from the parent submission row at migration time.

```sql
INSERT INTO submission_images (
  record_key, record_no, submission_id, job_no,
  field_key, field_label, image_data, file_name, file_size_bytes, mime_type,
  caption, uploaded_by, uploaded_at, sort_order,
  archived_locally, archived_at, archived_path, archive_attempts
)
SELECT
  'dry-monitoring'                   AS record_key,
  '742'                              AS record_no,
  i.submission_id,
  s.job_no                           AS job_no,   -- adjust column name to match your table
  i.field_key,
  -- Map fieldKey → human label. Extend this CASE for all image-enabled fields on REC 7.4.2.
  CASE i.field_key
    WHEN 'mouldVisible'         THEN 'Mould visible'
    WHEN 'pestActivity'         THEN 'Pest activity'
    WHEN 'trolleysClearlyMarked' THEN 'Trolleys clearly marked'
    ELSE i.field_key            -- fallback: use raw key if label unknown
  END                                AS field_label,
  i.image_data,
  i.file_name,
  i.file_size_bytes,
  i.mime_type,
  i.caption,
  i.uploaded_by,
  i.uploaded_at,
  i.sort_order,
  i.archived_locally,
  i.archived_at,
  i.archived_path,
  i.archive_attempts
FROM sub_dry_monitoring_images i
LEFT JOIN sub_dry_monitoring s ON s.id = i.submission_id;
```

Verify row counts match before dropping the old table:

```sql
SELECT COUNT(*) FROM sub_dry_monitoring_images;   -- must equal:
SELECT COUNT(*) FROM submission_images WHERE record_key = 'dry-monitoring';
```

Only drop the old table once the archive agent is running and confirmed working on the new table.

---

## 3. API endpoints (generic, handle all records)

All image operations go through record-key-scoped routes. The same endpoints serve every current and future record.

### 3a. Upload image

```
POST /api/images/:recordKey/:submissionId
```

Body (JSON): `{ fieldKey, fieldLabel, imageData, fileName, fileSizeBytes, mimeType, caption, uploadedBy, sortOrder }`

`fieldLabel` is the human-readable field name from the record definition (e.g. `"Mould visible"`). The client reads this from the rendered field config and passes it at upload time. It is stored on the row so that archived files and admin views are self-describing without needing to look up the record definition.

Server logic:
1. Look up `record_no` from `IMAGE_RECORD_REGISTRY[recordKey]` — 400 if not found.
2. Look up `job_no` from the submission table for that record key (needs a small lookup map: `recordKey → table name + job column`).
3. Insert into `submission_images`.
4. Return `{ id, uploadedAt }`.

### 3b. Get images for a submission

```
GET /api/images/:recordKey/:submissionId
```

Returns all rows for that submission, ordered by `field_key, sort_order`. Includes `image_data` for browser display.

### 3c. Update caption / sort order

```
PATCH /api/images/:imageId
```

Body: `{ caption?, sortOrder? }`. Returns updated row.

### 3d. Delete image

```
DELETE /api/images/:imageId
```

Hard delete. Returns 204.

### 3e. Archive: pending images (used by local agent)

```
GET /api/images/pending-archive?limit=50
```

Returns rows where `archived_locally = FALSE AND archive_failed = FALSE`, ordered oldest first. Includes `image_data`. Requires `ARCHIVE_API_KEY` header.

Response shape:
```json
[
  {
    "id": 204,
    "recordKey": "dry-monitoring",
    "recordNo": "742",
    "submissionId": 91,
    "jobNo": "J0023",
    "fieldKey": "mouldVisible",
    "fieldLabel": "Mould visible",
    "imageData": "data:image/jpeg;base64,...",
    "mimeType": "image/jpeg",
    "uploadedAt": "2026-10-14T10:22:00Z"
  }
]
```

### 3f. Archive: mark image archived

```
POST /api/images/:imageId/mark-archived
```

Body: `{ archivedPath }`. Sets `archived_locally = TRUE`, `archived_at = NOW()`, `archived_path`.

### 3g. Archive: mark image failed

```
POST /api/images/:imageId/mark-archive-failed
```

Increments `archive_attempts`. If `archive_attempts >= 5`, sets `archive_failed = TRUE`. Admin can reset by setting `archive_failed = FALSE, archive_attempts = 0` in Neon console.

---

## 4. Client-side changes (`form-record.js`)

Update the image upload/fetch calls to use the new generic endpoints:

| Old endpoint | New endpoint |
|---|---|
| `POST /api/dry-monitoring/:id/images` | `POST /api/images/dry-monitoring/:id` |
| `GET /api/dry-monitoring/:id/images` | `GET /api/images/dry-monitoring/:id` |
| `PATCH /api/dry-monitoring/images/:imageId` | `PATCH /api/images/:imageId` |
| `DELETE /api/dry-monitoring/images/:imageId` | `DELETE /api/images/:imageId` |

The `imageUploadFields: true` flag on a record definition continues to control whether image blocks appear. No other form-record.js logic changes.

Bump `?v=N` on all HTML files referencing `form-record.js` after this change.

---

## 5. Local archive agent

### 5a. Environment file: `scripts/archive.env`

```
API_BASE=https://processing-department-api.onrender.com
ARCHIVE_API_KEY=<secret — set same value in Render env vars>
ARCHIVE_ROOT=T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT\Images
POLL_INTERVAL_SECONDS=60
```

### 5b. Script: `scripts/image-archive-agent.mjs`

```js
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), 'archive.env') });

const API_BASE    = process.env.API_BASE;
const API_KEY     = process.env.ARCHIVE_API_KEY;
const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT;
const INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_SECONDS || '60', 10) * 1000;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function mimeToExt(mime) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'jpg';
}

async function pollAndArchive() {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/images/pending-archive?limit=50`, {
      headers: { 'x-archive-api-key': API_KEY }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    log(`Poll failed: ${err.message}`);
    return;
  }

  const images = await res.json();
  if (images.length === 0) return;

  log(`${images.length} image(s) pending archive.`);

  for (const img of images) {
    try {
      // Build filename: <recNo>_<jobNo>_<submissionId>_<fieldKey>_<YYYYMMDD>_<id>.<ext>
      const d    = new Date(img.uploadedAt);
      const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      const jobSafe = (img.jobNo || 'NOJOB').replace(/[^A-Za-z0-9_-]/g, '_');
      const ext  = mimeToExt(img.mimeType);
      // Sanitise fieldLabel for use in filename (fallback to fieldKey if missing)
      const labelRaw  = img.fieldLabel || img.fieldKey;
      const labelSafe = labelRaw.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
      const fileName  = `${img.recordNo}_${jobSafe}_${img.submissionId}_${labelSafe}_${date}_${img.id}.${ext}`;

      // Folder: ARCHIVE_ROOT\<recordNo>\YYYY\MM\
      const yyyy = String(d.getFullYear());
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const dir  = join(ARCHIVE_ROOT, img.recordNo, yyyy, mm);
      mkdirSync(dir, { recursive: true });

      const outPath = join(dir, fileName);

      // Skip if already on disk (idempotent)
      if (!existsSync(outPath)) {
        // Decode base64
        const base64 = img.imageData.replace(/^data:[^;]+;base64,/, '');
        writeFileSync(outPath, Buffer.from(base64, 'base64'));
      }

      // Mark archived in DB via API
      await fetch(`${API_BASE}/api/images/${img.id}/mark-archived`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-archive-api-key': API_KEY },
        body: JSON.stringify({ archivedPath: outPath })
      });

      log(`Archived image ${img.id} → ${outPath}`);
    } catch (err) {
      log(`ERROR on image ${img.id}: ${err.message}`);
      // Mark failed attempt
      await fetch(`${API_BASE}/api/images/${img.id}/mark-archive-failed`, {
        method: 'POST',
        headers: { 'x-archive-api-key': API_KEY }
      }).catch(() => {});
    }
  }
}

log('Image archive agent started.');
pollAndArchive(); // run immediately on start
setInterval(pollAndArchive, INTERVAL_MS);
```

### 5c. Folder structure produced on local server

```
T:\...\Images\
  742\              ← REC 7.4.2 Dry Monitoring
    2026\
      10\
        742_J0023_91_Mould-visible_20261014_204.jpg
        742_J0023_91_Pest-activity_20261014_205.jpg
        742_J0025_94_Mould-visible_20261014_209.jpg
  743\              ← REC 7.4.3 (when image support added)
    2026\
      10\
        743_J0031_102_Packaging-defect_20261014_310.jpg
```

Files sort naturally by record, then year/month, then job number within the month. Searching for all images from job J0023 = one filename pattern search across the folder.

### 5d. Run as Windows service (pm2)

```cmd
npm install -g pm2
pm2 start scripts/image-archive-agent.mjs --name image-archive
pm2 save
pm2 startup
```

Follow the output of `pm2 startup` to register it as a Windows service that restarts on reboot.

Alternative: Windows Task Scheduler set to run on login with a 1-minute repeat (less reliable than pm2).

---

## 6. Admin dashboard: archive status indicator

Show in the admin/home page:

```sql
SELECT
  COUNT(*) FILTER (WHERE archived_locally = FALSE AND archive_failed = FALSE) AS pending,
  COUNT(*) FILTER (WHERE archive_failed = TRUE)                               AS failed,
  COUNT(*)                                                                    AS total
FROM submission_images;
```

Display:
- `pending > 0` → `"📷 N image(s) pending local archive — is the archive agent running?"`
- `failed > 0` → `"⚠️ N image(s) failed to archive after 5 attempts — check archive agent logs."`

---

## 7. Adding image support to a new record

1. Add `"imageUploadFields": true` to the record definition in the DB.
2. Add the record to `IMAGE_RECORD_REGISTRY` in `src/image-record-registry.js` with its short record number.
3. The form engine, API, and archive agent handle the rest automatically.
4. No new tables, no new agent code.

---

## 8. Monthly base64 purge (Neon storage control)

Once images are archived locally, null out `image_data` for rows older than 90 days:

```sql
UPDATE submission_images
SET image_data = NULL
WHERE archived_locally = TRUE
  AND uploaded_at < NOW() - INTERVAL '90 days'
  AND image_data IS NOT NULL;
```

Run monthly via a scheduled task (see `data-archiving-instructions.md`).

After purge, the browser can no longer display those images inline. Retrieve from local server at `ARCHIVE_ROOT\<recordNo>\YYYY\MM\<filename>`.

---

## 9. Files created by this instruction

| File | Purpose |
|------|---------|
| `scripts/image-archive-agent.mjs` | Polling agent — runs on local server |
| `scripts/archive.env` | Local config (NOT committed to git) |
| `src/image-record-registry.js` | Shared record_key → record_no map |

Add `scripts/archive.env` to `.gitignore`.
