# Certification Version Update Instructions

**Facility:** Abagold Processing Facility  
**Maintained by:** michaela@abagold.co.za  
**Last reviewed:** 2026-10-28  
**Depends on:** `MD/certifications-index.md`, `certifications.json`

---

## Purpose

When a certification or standard is updated, the system must:

1. Log the new version.
2. Use an AI agent to read every record's field definitions and determine which records are affected by that cert's scope.
3. Present the proposed affected-records list to an admin for confirmation.
4. Banner-flag the confirmed records until a qualified person reviews and signs off each one.
5. Keep a full audit trail.

No manual mapping is required. The agent does the analysis.

---

## 1. How the agent determines affected records

When `POST /api/cert-revisions` is called, the API triggers an agent call **before** creating the review rows.

### What the agent receives

The agent is given a prompt containing:

**A. The certification being updated** — from `certifications.json`:
- `id`, `label`, current version, new version
- `notes` field (scope description, e.g. "dried abalone grades, moisture content, labelling")
- The `notes` field from the admin's revision log entry (what changed in this version)

**B. All record definitions** — from the DB. For each `RecordDefinition` the agent receives:
- `recordKey`, `title`
- All section titles and `extraJson` flags (e.g. `movementBlock`, `trolleyBanner`)
- All field labels, field types, any `helpText`, `unit`, `spec` values from `RecordFieldDef`
- All roster column labels from `RosterColumnDef`

This is the same data that `export-record-defs.mjs` already assembles — use that function to collect it.

### What the agent returns

```json
{
  "affected": [
    {
      "recordKey": "REC-7.4.1",
      "recordTitle": "Drying Process",
      "reason": "Contains moisture content, drying temperature, and grade fields directly governed by SANS 2329 clause 5."
    },
    {
      "recordKey": "REC-7.4.3",
      "recordTitle": "Drying Inspection",
      "reason": "Inspection fields reference dried abalone grade and moisture limits set by SANS 2329."
    }
  ],
  "not_affected": [
    {
      "recordKey": "REC-7.1.2",
      "recordTitle": "Canning Line Inspection",
      "reason": "Canning record — governed by SANS 587 and VC 9108, not SANS 2329 (dried abalone)."
    }
  ]
}
```

The `reason` string is shown to the admin when they confirm or adjust the list.

### Agent prompt template

```
You are a food safety compliance assistant for a South African abalone processing facility.

A certification has been updated:
- Standard: {{certLabel}}
- ID: {{certId}}
- Previous version: {{prevVersion}}
- New version: {{newVersion}}
- Scope / what changed: {{notes}}

Below is a list of all active record forms used in the facility. For each record,
determine whether it is likely affected by an update to {{certLabel}}.
A record is affected if its fields, measurements, limits, labelling requirements,
or procedures fall within the scope of this standard.

Return a JSON object with two arrays:
- "affected": records that are likely governed by or dependent on this standard
- "not_affected": records that are clearly outside its scope

For each entry include: recordKey, recordTitle, reason (one sentence).

Records:
{{recordDefinitionsSummary}}
```

---

## 2. Admin confirmation step

The agent's output is **a proposal, not a final decision**. The admin sees a screen showing:

> **SANS 2329 updated to 2024 edition**  
> The system has analysed all 47 record forms and suggests the following are affected:

**Suggested affected records** (agent flagged, admin confirms):

| Record | Reason | Include? |
|--------|--------|----------|
| REC-7.4.1 Drying Process | Moisture content and grade fields directly governed by SANS 2329 | ✅ Yes |
| REC-7.4.3 Drying Inspection | Inspection fields reference dried abalone moisture limits | ✅ Yes |
| REC-7.4.10 Final Product Check | Final grade and moisture sign-off | ✅ Yes |
| REC-8.2.1 Staff Training | No product specification fields | ❌ No |

The admin can toggle any record in or out. On confirm → `POST /api/cert-revisions/confirm` with the final list.

This means the admin is reviewing a proposed list, not building one from scratch. The cognitive load is "does this look right?" not "which records apply?".

---

## 3. DB tables

```prisma
model CertRevision {
  id                String             @id @default(cuid())
  certId            String             // e.g. "SANS-2329"
  certLabel         String
  prevVersion       String?
  newVersion        String
  detectedDate      DateTime           @default(now())
  detectedBy        String             // email
  sourceFile        String?            // uploaded PDF filename
  notes             String?            // what changed in this version
  agentSuggestion   String?            // raw JSON from agent (for audit)
  reviewStatus      String             @default("pending") // pending | complete
  reviewCompletedAt DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  recordReviews     CertRecordReview[]
}

model CertRecordReview {
  id             String       @id @default(cuid())
  certRevisionId String
  certRevision   CertRevision @relation(fields: [certRevisionId], references: [id])
  recordKey      String
  recordLabel    String?
  agentReason    String?      // agent's reason for flagging this record
  status         String       @default("pending") // pending | reviewed-no-change | updated
  reviewedAt     DateTime?
  reviewedBy     String?
  reviewNote     String?
  passkey        String?
  createdAt      DateTime     @default(now())
}
```

Migration:
```bash
npx prisma migrate dev --name add-cert-revision-tracking
```

---

## 4. API endpoints

Mount at `app.use('/api/cert-revisions', ...)`.

### 4a. `POST /api/cert-revisions` — log revision + run agent analysis

Admin/QA only. Does not create review rows yet — only runs the agent and returns the proposal.

```js
// Body:
{
  certId: "SANS-2329",
  prevVersion: "2019",
  newVersion: "2024",
  detectedBy: "michaela@abagold.co.za",
  notes: "Revised moisture limits in clause 5.2; new labelling requirements in clause 8.",
  sourceFile: "SANS 2329 2024.pdf"  // optional
}

// Returns:
{
  draftRevisionId: "clxyz...",   // stored temporarily, not yet confirmed
  affected: [
    { recordKey: "REC-7.4.1", recordTitle: "Drying Process", agentReason: "..." },
    ...
  ],
  not_affected: [
    { recordKey: "REC-7.1.2", recordTitle: "Canning Line", agentReason: "..." },
    ...
  ]
}
```

Store the draft revision (status `"draft"`) and the raw agent JSON. Do not create `CertRecordReview` rows yet.

### 4b. `POST /api/cert-revisions/:draftId/confirm` — admin confirms the list

```js
// Body:
{
  confirmedRecords: [
    { recordKey: "REC-7.4.1", recordLabel: "Drying Process", agentReason: "..." },
    { recordKey: "REC-7.4.3", recordLabel: "Drying Inspection", agentReason: "..." }
    // admin may have added or removed records vs. the agent's suggestion
  ]
}
```

Steps:
1. Update `CertRevision.reviewStatus` from `"draft"` to `"pending"`.
2. Create one `CertRecordReview` row per confirmed record.
3. Update `certifications.json`: set `activeRevisionId`, append to `revisions[]`, update `currentVersion`.
4. Commit + push `certifications.json` via `simple-git`.
5. Return `{ revisionId, affectedCount }`.

### 4c. `GET /api/cert-revisions/pending-for-record/:recordKey`

Called by `form-record.js` on load. Returns any pending revision that has an open `CertRecordReview` for this record.

Returns `[]` if none → no banner shown.

### 4d. `PATCH /api/cert-revisions/record-review/:reviewTaskId`

QA/Admin sign-off on one record.

```js
// Body:
{
  status: "reviewed-no-change" | "updated",
  reviewedBy: "Jane Smith",
  reviewNote: "Moisture limits unchanged — no field change required.",
  passkey: "JS01"
}
```

After save: if all `CertRecordReview` rows for this revision are resolved → mark `CertRevision` complete, clear `activeRevisionId` in `certifications.json`, commit.

### 4e. `GET /api/cert-revisions/history/:certId`

All revisions for one cert, newest first.

---

## 5. Calling the Claude API from the Node backend

The agent analysis runs server-side using the Anthropic SDK.

```js
import Anthropic from '@anthropic-ai/sdk';
import { assembleAllRecordSummaries } from '../record-def.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyseAffectedRecords({ certId, certLabel, prevVersion, newVersion, notes }) {
  const records = await assembleAllRecordSummaries(); 
  // assembleAllRecordSummaries() returns an array of { recordKey, title, sectionTitles, fieldLabels }
  // built from RecordDefinition + RecordSectionDef + RecordFieldDef in the DB

  const recordsSummary = records.map(r =>
    `${r.recordKey} — ${r.title}\n  Sections: ${r.sectionTitles.join(', ')}\n  Fields: ${r.fieldLabels.join(', ')}`
  ).join('\n\n');

  const prompt = `You are a food safety compliance assistant for a South African abalone processing facility.

A certification has been updated:
- Standard: ${certLabel}
- ID: ${certId}
- Previous version: ${prevVersion ?? 'unknown'}
- New version: ${newVersion}
- What changed: ${notes ?? 'Not specified'}

Below are all active record forms. For each, determine whether it is affected by an update to this standard.
A record is affected if its fields, measurements, limits, labelling or procedures fall within the scope of this standard.

Return ONLY valid JSON — an object with two arrays:
"affected" and "not_affected".
Each item: { "recordKey": string, "recordTitle": string, "reason": string (one sentence) }

Records:
${recordsSummary}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = message.content[0].text;
  // Extract JSON — the model may wrap it in markdown code fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}
```

Add `ANTHROPIC_API_KEY` to Render environment variables (API service).

---

## 6. UI — admin certification update flow

### Step 1 — Log the update (admin panel)

Form with: certification dropdown, previous version (auto-filled), new version, notes, optional PDF upload.

Submit → calls `POST /api/cert-revisions` → shows a loading state ("Analysing record forms…").

### Step 2 — Review agent proposal

Shows two lists side by side:

**Suggested: affected (review recommended)**
Each row: record title + agent's one-sentence reason + toggle to exclude.

**Suggested: not affected**
Each row: record title + reason + toggle to include.

A "Confirm" button finalises the list → calls `POST /api/cert-revisions/:draftId/confirm`.

### Step 3 — Live review progress

Admin panel shows open revisions with a progress indicator:
"3 of 6 records reviewed — SANS 2329 v2024"

Each pending record links directly to the record form.

---

## 7. UI — banner on record forms

In `public/lib/form-record.js`, at the end of `initForm()`:

```js
async function checkCertRevisionBanner(recordKey) {
  try {
    const res = await fetch(
      `/api/cert-revisions/pending-for-record/${encodeURIComponent(recordKey)}`
    );
    if (!res.ok) return;
    const pending = await res.json();
    if (!pending.length) return;

    const banner = document.createElement('div');
    banner.className = 'fr-cert-review-banner';
    banner.innerHTML = `
      <div class="fr-cert-review-banner__icon">⚠️</div>
      <div class="fr-cert-review-banner__body">
        <strong>Certification update — review required</strong>
        <p>This form's standard(s) have been updated. A QA Manager or Quality Supervisor
        must confirm it still complies before new entries are made.</p>
        <ul>${pending.map(r => `
          <li><strong>${r.certLabel}</strong> → v${r.newVersion}
          (${new Date(r.detectedDate).toLocaleDateString('en-ZA')})</li>
        `).join('')}</ul>
        <button class="fr-cert-review-banner__btn"
                data-reviews='${JSON.stringify(pending)}'>
          Mark as reviewed
        </button>
      </div>`;

    document.querySelector('.fr-record-container, main, body').prepend(banner);
    banner.querySelector('.fr-cert-review-banner__btn')
      .addEventListener('click', e =>
        openCertReviewDialog(JSON.parse(e.target.dataset.reviews))
      );
  } catch (err) {
    console.warn('cert banner check failed:', err);
  }
}
```

Review dialog: outcome radio (no change / updated) + notes + passkey sign-off.

Banner CSS — add to `public/styles/record-theme.css`:

```css
.fr-cert-review-banner {
  display: flex; gap: .75rem;
  background: #fff8e1; border: 2px solid #f59e0b;
  border-radius: 6px; padding: 1rem 1.25rem;
  margin-bottom: 1.25rem; font-size: .9rem;
}
.fr-cert-review-banner__icon { font-size: 1.4rem; line-height: 1; }
.fr-cert-review-banner__body strong { display: block; color: #92400e; }
.fr-cert-review-banner__body p,
.fr-cert-review-banner__body ul { color: #78350f; margin: .25rem 0; }
.fr-cert-review-banner__body ul { padding-left: 1.25rem; }
.fr-cert-review-banner__btn {
  margin-top: .75rem; padding: .4rem 1rem;
  background: #f59e0b; color: #fff;
  border: none; border-radius: 4px;
  cursor: pointer; font-weight: 600;
}
.fr-cert-review-banner__btn:hover { background: #d97706; }
@media print { .fr-cert-review-banner { display: none; } }
```

---

## 8. Workflow summary

```
New edition of standard published
          │
          ▼
Admin: Log new certification update (admin panel)
Enters: cert, new version, notes on what changed
          │
          ▼
POST /api/cert-revisions
  → Agent reads cert scope + all record field definitions from DB
  → Returns: affected (with reasons) + not_affected (with reasons)
          │
          ▼
Admin reviews agent proposal on screen
Toggles any records in/out (agent may have missed edge cases)
Clicks Confirm
          │
          ▼
POST /api/cert-revisions/:draftId/confirm
  → CertRevision created (status: pending)
  → CertRecordReview row created per confirmed record
  → certifications.json updated + committed
          │
          ▼
Amber banner appears on all confirmed record forms
          │
          ▼
QA Manager / Quality Supervisor opens each flagged form
Reviews fields against new standard
  ├─ No change → outcome: "No change required", note, passkey
  └─ Change needed → update DB fields, re-export JSON, then sign off
          │
          ▼
All records signed off → revision marked complete
Banners cleared, full audit trail in DB
```

---

## 9. Environment variables needed

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon connection (already set) |
| `ANTHROPIC_API_KEY` | Agent analysis call — add to Render API service env |

---

## 10. File checklist

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `CertRevision`, `CertRecordReview` |
| `prisma/migrations/` | New migration |
| `src/routes/certRevisions.js` | All endpoints (§4) |
| `src/services/certAnalysisAgent.js` | Agent call function (§5) |
| `src/record-def.js` | Add `assembleAllRecordSummaries()` helper |
| `src/index.js` | Mount new router |
| `public/admin/index.html` | Add cert update + review panels (§6) |
| `public/lib/form-record.js` | Add `checkCertRevisionBanner()` + review dialog (§7) |
| `public/styles/record-theme.css` | Banner CSS (§7) |
| All `public/records/REC-*.html` | Bump `?v=N` |

---

## 11. Version bump reminder

After any `form-record.js` change:
```bash
grep -rl "form-record.js" public/records/
# increment ?v=N by 1 in each file found
```
