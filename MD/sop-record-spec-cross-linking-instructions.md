# SOP → Record & Specification Cross-Linking

**Facility:** Abagold Processing Facility
**Feature:** Bidirectional links between SOPs and the records/specs they reference
**Goal:** When an SOP mentions a record number (e.g. `REC 7.4.1`) or a specification code
(e.g. `SANS 2329`, `VC 9108`, `FSSC 22000`), that reference becomes a live link. Conversely,
every record and spec page shows which SOPs reference it, so that when a record template or
spec changes, the author can immediately see which SOPs need reviewing.

---

## 1. What this solves

- SOPs today contain plain-text mentions of record numbers and spec codes.
- If `REC 7.4.1` changes its fields or `SANS 2329` is revised, there is no automated way
  to know which SOPs are affected.
- This feature creates a **cross-reference registry** that makes those links visible and
  navigable in both directions.

---

## 2. Database — new table

Add one table to Neon via Prisma migration:

```sql
-- Migration: add_document_references
CREATE TABLE document_references (
  id            SERIAL PRIMARY KEY,
  source_type   TEXT NOT NULL,   -- 'sop' | 'procedure' | 'policy' | 'prp'
  source_key    TEXT NOT NULL,   -- e.g. 'SOP-7.4.1', matches the doc's key in its definition table
  source_title  TEXT,            -- denormalised for display; refresh on SOP rename
  target_type   TEXT NOT NULL,   -- 'record' | 'spec' | 'certification'
  target_key    TEXT NOT NULL,   -- e.g. 'REC-7.4.1' or 'SANS-2329'
  target_label  TEXT,            -- e.g. 'Drying Process' or 'SANS 2329:2019 Dried Abalone'
  context_text  TEXT,            -- short excerpt showing where in the SOP it appears (≤ 200 chars)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_doc_ref
  ON document_references (source_type, source_key, target_type, target_key);

CREATE INDEX idx_doc_ref_source ON document_references (source_type, source_key);
CREATE INDEX idx_doc_ref_target ON document_references (target_type, target_key);
```

**Why denormalise `source_title` / `target_label`?** These are read far more often than
written. When a SOP or record is renamed, run the refresh script (§7) to sync them.

---

## 3. Reference extraction — patterns to match

The extraction engine (used in both the save-path and the backfill script) must recognise
these patterns anywhere in SOP / procedure content:

### 3a. Record references

| Pattern | Examples | Resolves to |
|---------|----------|-------------|
| `REC\s*\d+(\.\d+)*[a-z]?` | `REC 7.4.1`, `REC 8.1.6a`, `REC 9.1` | `target_type = 'record'`, `target_key = 'REC-7.4.1'` (normalised: uppercase, hyphen, no spaces) |

Normalisation rule: strip whitespace, uppercase, replace internal spaces with `-`.
`REC 7.4.1` → `REC-7.4.1`, `REC7.4.1` → `REC-7.4.1`.

### 3b. Specification / certification references

Match against the known list in `certifications.json` (project doc `MD/certifications-index.md`).
Keys to recognise:

| Pattern | Examples | `target_key` |
|---------|----------|--------------|
| `SANS\s*\d+` | `SANS 2329`, `SANS 587` | `SANS-2329` |
| `ISO\s*(\/TS\s*)?\d+` | `ISO 22000`, `ISO/TS 22002-1` | `ISO-22000`, `ISO-TS-22002-1` |
| `VC\s*\d+` | `VC 9108`, `VC 8014` | `VC-9108` |
| `FSSC\s*22000` | `FSSC 22000` | `FSSC-22000` |
| `HACCP` (standalone) | `HACCP` | `HACCP-SANS10330` |
| `PRO\s*\d+(\.\d+)*` | `PRO 8.2.18` | `PRO-8.2.18` (procedure cross-ref) |

Build the match list from `certifications.json` so new certs automatically become linkable
without code changes.

### 3c. Extraction utility

Place in `public/lib/ref-extractor.js` (also importable from Node scripts):

```js
// ref-extractor.js
// Returns an array of { targetType, targetKey, matchText, contextText }

const REC_RE   = /\bREC\s*(\d+(?:\.\d+)*[a-z]?)\b/gi;
const SANS_RE  = /\bSANS\s*(\d+(?::\d+)?)\b/gi;
const ISO_RE   = /\bISO(?:\/TS\s*)?(\d+(?:[:\-]\d+)*(?:[:\-]\d+)?)\b/gi;
const VC_RE    = /\bVC\s*(\d+(?::\d+)?)\b/gi;
const FSSC_RE  = /\bFSSC\s*22000(?:\s*[Vv]\d+)?\b/gi;
const HACCP_RE = /\bHACCP\b/g;
const PRO_RE   = /\bPRO\s*(\d+(?:\.\d+)*)\b/gi;

export function extractReferences(text) {
  const refs = [];
  const seen = new Set();

  function add(targetType, targetKey, match, index) {
    const key = `${targetType}:${targetKey}`;
    if (seen.has(key)) return;           // dedup; keep first occurrence
    seen.add(key);
    const start = Math.max(0, index - 60);
    const end   = Math.min(text.length, index + match.length + 60);
    const ctx   = (start > 0 ? '…' : '') +
                  text.slice(start, end).replace(/\s+/g, ' ').trim() +
                  (end < text.length ? '…' : '');
    refs.push({ targetType, targetKey, matchText: match, contextText: ctx });
  }

  for (const m of text.matchAll(REC_RE)) {
    const key = 'REC-' + m[1].replace(/\s/g, '').toUpperCase();
    add('record', key, m[0], m.index);
  }
  for (const m of text.matchAll(SANS_RE)) {
    add('spec', 'SANS-' + m[1], m[0], m.index);
  }
  for (const m of text.matchAll(ISO_RE)) {
    add('spec', 'ISO-' + m[1].replace(/[\s\/]/g, '-'), m[0], m.index);
  }
  for (const m of text.matchAll(VC_RE)) {
    add('spec', 'VC-' + m[1], m[0], m.index);
  }
  for (const m of text.matchAll(FSSC_RE)) {
    add('certification', 'FSSC-22000', m[0], m.index);
  }
  for (const m of text.matchAll(HACCP_RE)) {
    add('certification', 'HACCP-SANS10330', m[0], m.index);
  }
  for (const m of text.matchAll(PRO_RE)) {
    add('procedure', 'PRO-' + m[1], m[0], m.index);
  }

  return refs;
}
```

---

## 4. API endpoints

Add to the Express API (`src/routes/` or wherever document routes live):

### 4a. `GET /api/refs/by-source?type=sop&key=SOP-7.4.1`
Returns all targets this SOP references.
```json
[
  { "targetType": "record", "targetKey": "REC-7.4.1", "targetLabel": "Drying Process", "contextText": "…complete REC 7.4.1 at end of each steam…" },
  { "targetType": "spec",   "targetKey": "SANS-2329",  "targetLabel": "SANS 2329:2019 Dried Abalone", "contextText": "…per SANS 2329 moisture limits…" }
]
```

### 4b. `GET /api/refs/by-target?type=record&key=REC-7.4.1`
Returns all SOPs / procedures that reference this record.
```json
[
  { "sourceType": "sop", "sourceKey": "SOP-7.4.1", "sourceTitle": "Drying Process SOP", "contextText": "…complete REC 7.4.1 at end of each steam…" }
]
```

### 4c. `POST /api/refs/sync` — admin-only
Body: `{ sourceType, sourceKey, sourceTitle, refs: [{targetType, targetKey, targetLabel, contextText}] }`
Replaces all `document_references` rows for this source with the supplied list
(delete-then-insert under a transaction). Called automatically on SOP save (§5) and by
the backfill script (§6).

---

## 5. SOP save path — auto-extract on save

In the SOP save handler (wherever `sop-doc.js` or the backend persists SOP content):

1. After saving the SOP content to the DB, extract the plain-text version of the content.
2. Call `extractReferences(plainText)`.
3. Look up `targetLabel` for each hit:
   - For `record` targets: query `RecordDefinition` by `recordKey` → use `title`.
   - For `spec` / `certification` targets: look up in the in-memory copy of `certifications.json`.
   - If not found: leave `targetLabel` as the raw match text.
4. Call `POST /api/refs/sync` with the assembled list.

This means references are always current as of the last save. No manual tagging required —
the extraction is automatic.

---

## 6. Backfill script — `scripts/sync-sop-refs.mjs`

Run once after deploying to populate the table from all existing SOP content:

```js
// scripts/sync-sop-refs.mjs
// Usage: node scripts/sync-sop-refs.mjs
// Requires DATABASE_URL in env

import { PrismaClient } from '@prisma/client';
import { extractReferences } from '../public/lib/ref-extractor.js';

const prisma = new PrismaClient();

async function main() {
  // Fetch all SOPs (adjust table/field names to match your schema)
  const sops = await prisma.sopDefinition.findMany({
    select: { key: true, title: true, contentPlainText: true }
  });

  for (const sop of sops) {
    const refs = extractReferences(sop.contentPlainText ?? '');
    const rows = refs.map(r => ({
      source_type:  'sop',
      source_key:   sop.key,
      source_title: sop.title,
      target_type:  r.targetType,
      target_key:   r.targetKey,
      target_label: r.targetKey,   // replace with label lookup
      context_text: r.contextText,
    }));

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `DELETE FROM document_references WHERE source_type = 'sop' AND source_key = $1`,
        sop.key
      ),
      prisma.documentReference.createMany({ data: rows, skipDuplicates: true }),
    ]);
    console.log(`${sop.key}: ${rows.length} refs`);
  }
}

main().finally(() => prisma.$disconnect());
```

Adjust `sopDefinition`, field names, and label-lookup to match the actual schema.
Run with: `node scripts/sync-sop-refs.mjs`

---

## 7. Frontend — SOP viewer: clickable inline references

In `public/lib/sop-doc.js`, after the SOP content is rendered into the DOM:

```js
function linkifyContent(containerEl) {
  const html = containerEl.innerHTML;

  const linked = html
    .replace(/\b(REC\s*\d+(?:\.\d+)*[a-z]?)\b/gi, (match) => {
      const key = 'REC-' + match.replace(/REC\s*/i, '').replace(/\s/g, '').toUpperCase();
      const href = `../records/${key}.html`;
      return `<a href="${href}" class="doc-ref doc-ref--record" title="Open ${match}">${match}</a>`;
    })
    .replace(/\b(SANS\s*\d+(?::\d+)?)\b/gi, (match) => {
      const key = match.replace(/\s+/g, '-').toUpperCase();
      return `<a href="../fsms/specifications.html#${key}" class="doc-ref doc-ref--spec" title="View specification">${match}</a>`;
    });
    // Add ISO, VC, FSSC patterns similarly

  containerEl.innerHTML = linked;
}
```

**Style** — add to `record-theme.css` or a shared stylesheet:
```css
.doc-ref {
  color: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: pointer;
  white-space: nowrap;
}
.doc-ref--record { text-decoration-color: #2563eb; }  /* blue */
.doc-ref--spec   { text-decoration-color: #15803d; }  /* green */
.doc-ref--cert   { text-decoration-color: #a16207; }  /* amber */
```

For external specs (SANS, ISO) where there is no internal page, link to the relevant entry
in `fsms/specifications.html` or the certifications index page using the anchor `#SANS-2329`.

---

## 8. Frontend — "Referenced in" panel on record / spec pages

### 8a. Record pages

After the record form renders, fetch and display a references panel:

```js
async function loadReferencedIn(recordKey) {
  const res = await fetch(`/api/refs/by-target?type=record&key=${encodeURIComponent(recordKey)}`);
  if (!res.ok) return;
  const refs = await res.json();
  if (!refs.length) return;

  const panel = document.createElement('section');
  panel.className = 'ref-panel';
  panel.innerHTML = `
    <h3 class="ref-panel__title">Referenced in</h3>
    <ul class="ref-panel__list">
      ${refs.map(r => `
        <li>
          <a href="../docs/${r.sourceKey}.html" class="ref-panel__link">${r.sourceTitle}</a>
          <span class="ref-panel__ctx">${r.contextText}</span>
        </li>`).join('')}
    </ul>`;
  document.querySelector('.fr-header')?.after(panel);
}
```

Collapsed by default on mobile. Show only to users with at least `viewDocuments` permission.

### 8b. Specifications page

Add a collapsible "Referenced in SOPs" section to each spec card, loaded lazily on first expand:

```js
specCard.addEventListener('toggle-refs', async () => {
  const key = specCard.dataset.specKey;   // e.g. 'SANS-2329'
  const res = await fetch(`/api/refs/by-target?type=spec&key=${key}`);
  const refs = await res.json();
  renderRefList(specCard.querySelector('.spec-refs'), refs);
});
```

---

## 9. Admin — Change Impact view

Location: add a tab or panel to the existing admin area (wherever record template editing
and spec management live).

**Purpose:** Before changing a record template or spec, check which SOPs will be affected.

```
┌──────────────────────────────────────────────────────────┐
│ Change Impact Check                                      │
│ Select document: [Record ▼]  [REC 7.4.1 – Drying ▼]    │
│                                                          │
│ SOPs that reference this record:                        │
│  • SOP-7.4.1  Drying Process SOP           [Review →]  │
│  • SOP-7.0    General Drying Procedures    [Review →]  │
│                                                          │
│ Last synced: 28 Oct 2026, 11:42                         │
│                                [Re-scan all SOPs]       │
└──────────────────────────────────────────────────────────┘
```

"Re-scan all SOPs" calls `POST /api/refs/rescan-all` — admin-only, rate-limited to once
per minute.

### 9b. Review flag (optional enhancement)

Add a `needs_review` boolean to `document_references`:

```sql
ALTER TABLE document_references ADD COLUMN needs_review BOOLEAN DEFAULT false;
CREATE INDEX idx_doc_ref_review ON document_references (needs_review) WHERE needs_review = true;
```

When a record template is saved, set the flag for all referencing SOPs:

```js
// In the record-def save handler (PATCH /api/record-defs/:key)
await prisma.$executeRaw`
  UPDATE document_references
  SET needs_review = true, updated_at = now()
  WHERE target_type = 'record' AND target_key = ${recordKey}
`;
```

Show a **"⚠ Review needed"** badge on any SOP in the SOP list that has `needs_review = true`
rows. Clear the flag when the SOP author opens and re-saves that SOP.

---

## 10. File changes summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `DocumentReference` model |
| `prisma/migrations/*.sql` | Create table + indexes |
| `public/lib/ref-extractor.js` | **New** — regex extraction utility (ES module) |
| `public/lib/sop-doc.js` | Add `linkifyContent()` call after render; call `POST /api/refs/sync` on save |
| `public/lib/api-backend.js` | Add `getRefsByTarget()` and `syncRefs()` helpers |
| `public/styles/record-theme.css` | Add `.doc-ref` and `.ref-panel` styles |
| `src/routes/refs.js` | **New** — `GET by-source`, `GET by-target`, `POST sync`, `POST rescan-all` |
| `src/index.js` (or router) | Mount `/api/refs` router |
| `scripts/sync-sop-refs.mjs` | **New** — one-shot backfill script |
| Admin page / JS | Add Change Impact panel |

---

## 11. Build order

1. **DB migration** — add `document_references` table and indexes.
2. **Prisma** — regenerate client (`npx prisma generate`).
3. **`ref-extractor.js`** — write and unit-test extraction patterns against known SOP content.
4. **API routes** (`src/routes/refs.js`) — `by-target`, `by-source`, `sync`.
5. **Backfill script** — run against production Neon to populate existing SOPs.
6. **`sop-doc.js`** — add `linkifyContent()` on render; add `POST /api/refs/sync` on save.
7. **Record pages** — add `loadReferencedIn()` panel.
8. **Admin Change Impact panel.**
9. **`needs_review` flag** — optional, add after the above is stable.

---

## 12. Notes and constraints

- **No build step** — `ref-extractor.js` must be a plain ES module usable by both the
  browser (`type="module"`) and Node scripts. Avoid CommonJS syntax.
- **Neon free tier** — `document_references` will have at most a few hundred rows (one per
  SOP × target pair). No performance concern on the free tier.
- **Portability** — all data lives in one table. Full export:
  `SELECT * FROM document_references` → CSV or JSON.
- **Cache busting** — when `sop-doc.js` changes, bump `?v=N` in all HTML files that
  reference it. Check with: `grep -rl "sop-doc.js" public/`
- **Permission gate** — `GET /api/refs/*` requires `viewDocuments`. `POST /api/refs/sync`
  and `POST /api/refs/rescan-all` require `manageTemplates` or `admin`.
