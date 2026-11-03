# Master Index Audit Log — Y/N Changes & Archive/Restore

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Type:** New feature — new Neon table, new API route, frontend changes.  
**Scope:** `prisma/schema.prisma`, `src/index.js`, `public/records/master-record-index.html`

---

## What this adds

Every Y/N change (Obsolete retrieved, New revision distributed) and every Archive/Restore action on the master index is written to a permanent audit log in Neon. Each entry requires a reason. Admins can view the log from the master index toolbar.

---

## 1. Neon — add `MasterIndexAuditLog` table

### 1a. Add to `prisma/schema.prisma`

After the `KeyValueHistory` model, add:

```prisma
// Audit trail for master-index admin actions (Y/N changes, archive, restore).
// Reason is always required; changedBy comes from the Auth display name.
model MasterIndexAuditLog {
  id         Int      @id @default(autoincrement())
  recordId   String   // rowId: addedId | recordKey | 'doc:<docNo>'
  docNo      String?  // display document number at time of action
  docName    String?  // document name at time of action
  action     String   // 'yn_change' | 'archived' | 'restored'
  field      String?  // for yn_change: 'obsoleteRetrieved' | 'distributed'
  oldValue   String?
  newValue   String?
  reason     String
  changedBy  String?
  changedAt  DateTime @default(now())

  @@index([recordId, changedAt])
  @@index([changedAt])
}
```

### 1b. Run the migration

```bash
npx prisma migrate dev --name add-master-index-audit-log
```

If running in production (Render), use:

```bash
npx prisma migrate deploy
```

---

## 2. API — add the audit log route

### 2a. Add to `src/index.js`

After the `GET /api/record-def/:recordKey` route, add:

```js
// POST /api/master-index-audit
// Body: { recordId, docNo, docName, action, field, oldValue, newValue, reason, changedBy }
app.post('/api/master-index-audit', async (req, res) => {
  const { recordId, docNo, docName, action, field, oldValue, newValue, reason, changedBy } = req.body || {};
  if (!recordId || !action || !reason) {
    return res.status(400).json({ ok: false, error: 'recordId, action and reason are required' });
  }
  const allowed = ['yn_change', 'archived', 'restored'];
  if (!allowed.includes(action)) {
    return res.status(400).json({ ok: false, error: 'invalid action' });
  }
  try {
    await prisma.masterIndexAuditLog.create({
      data: { recordId, docNo: docNo || null, docName: docName || null, action, field: field || null,
              oldValue: oldValue || null, newValue: newValue || null, reason, changedBy: changedBy || null }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/master-index-audit failed', e);
    res.status(500).json({ ok: false });
  }
});

// GET /api/master-index-audit?limit=100&recordId=<id>
app.get('/api/master-index-audit', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
  const where = req.query.recordId ? { recordId: req.query.recordId } : {};
  try {
    const rows = await prisma.masterIndexAuditLog.findMany({
      where, orderBy: { changedAt: 'desc' }, take: limit
    });
    res.json(rows);
  } catch (e) {
    console.error('GET /api/master-index-audit failed', e);
    res.status(500).json({ ok: false });
  }
});
```

---

## 3. Frontend — `public/records/master-record-index.html`

### 3a. Add `postAudit()` helper function

After the existing `setArchived()` function, add:

```js
async function postAudit(entry) {
  try {
    await fetch('/api/master-index-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch (e) { /* non-fatal — log silently */ }
}
```

### 3b. Add reason prompt to Y/N change listener

Find the existing Y/N change listener:

```js
tableBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-row]');
  if (!sel || !canEdit) return;
  const id = sel.dataset.row;
  control[id] = control[id] || {};
  control[id][sel.dataset.field] = sel.value;
  control[id].updatedAt = Date.now();
  control[id].updatedBy = (window.Auth && window.Auth.getDisplayName && window.Auth.getDisplayName()) || '';
  sel.classList.add('dirty');
  await saveControl();
});
```

Replace with:

```js
tableBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-row]');
  if (!sel || !canEdit) return;

  const reason = prompt('Reason for this change (required):');
  if (!reason || !reason.trim()) {
    // Revert the select to its previous value without saving
    const id = sel.dataset.row;
    const field = sel.dataset.field;
    const prevVal = (control[id] && control[id][field]) != null
      ? control[id][field]
      : (ROWS.find(r => rowId(r) === id) || {})[field];
    sel.value = prevVal == null ? '' : String(prevVal).toUpperCase();
    return;
  }

  const id = sel.dataset.row;
  const field = sel.dataset.field;
  const oldVal = (control[id] && control[id][field]) != null
    ? control[id][field]
    : ((ROWS.find(r => rowId(r) === id) || {})[field] || '');
  const newVal = sel.value;

  control[id] = control[id] || {};
  control[id][field] = newVal;
  control[id].updatedAt = Date.now();
  control[id].updatedBy = (window.Auth && window.Auth.getDisplayName && window.Auth.getDisplayName()) || '';
  sel.classList.add('dirty');
  await saveControl();

  const rowData = ROWS.find(r => rowId(r) === id) || {};
  await postAudit({
    recordId: id,
    docNo: String(rowData.docNo || ''),
    docName: String(rowData.name || ''),
    action: 'yn_change',
    field,
    oldValue: String(oldVal),
    newValue: newVal,
    reason: reason.trim(),
    changedBy: (window.Auth && window.Auth.getDisplayName && window.Auth.getDisplayName()) || ''
  });
});
```

### 3c. Add audit log write to Archive/Restore click handler

In the existing `tableBody.addEventListener('click', ...)` block, find the Archive/Restore section:

```js
    await setArchived(id, nowArchived);
    $('saveState').textContent = nowArchived ? 'Archived' : 'Restored';
    setTimeout(() => { $('saveState').textContent = ''; }, 2000);
    render();
```

Replace with:

```js
    await setArchived(id, nowArchived);
    $('saveState').textContent = nowArchived ? 'Archived' : 'Restored';
    setTimeout(() => { $('saveState').textContent = ''; }, 2000);
    await postAudit({
      recordId: id,
      docNo: String(label.split(' — ')[0] || ''),
      docName: String(label.split(' — ').slice(1).join(' — ') || ''),
      action: nowArchived ? 'archived' : 'restored',
      reason: nowArchived
        ? (prompt('Reason for archiving (required):') || 'Archived')
        : 'Restored by admin',
      changedBy: (window.Auth && window.Auth.getDisplayName && window.Auth.getDisplayName()) || ''
    });
    render();
```

> **Note:** The Archive confirm dialog already runs before this block. The reason prompt for archiving is an additional prompt after the confirm. For Restore there is no confirm dialog, so `'Restored by admin'` is the reason — or you can add a prompt for restore too by following the same pattern.

Alternatively, to keep a single prompt that serves as both confirmation and reason for Archive, replace the current `confirm(...)` call with:

```js
    const archiveReason = nowArchived
      ? prompt(`Archive "${label}"?\n\nEnter reason (required — leave blank to cancel):\n`)
      : null;
    if (nowArchived && (!archiveReason || !archiveReason.trim())) return;
```

And then use `archiveReason` in `postAudit` instead of a second `prompt`.

### 3d. Add "View audit log" button to the toolbar

In the toolbar `<div class="dc-actions">`, after the existing buttons, add:

```html
<button class="btn btn-ghost" id="auditLogBtn">Audit log</button>
```

### 3e. Add audit log modal HTML

After the existing `dhModal` closing `</div>`, add:

```html
<div id="auditModal" class="dh-modal" style="display:none;">
  <div class="dh-modal-inner" style="max-width:860px;">
    <h2>Master Index Audit Log</h2>
    <p class="dh-hint">Y/N changes, archives and restores — most recent first.</p>
    <div id="auditContent" style="overflow-x:auto;"></div>
    <div class="dh-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="auditClose">Close</button>
    </div>
  </div>
</div>
```

### 3f. Add audit log JS

After the existing `dhClose()` function, add:

```js
const auditModal = $('auditModal');

async function openAuditLog() {
  $('auditContent').innerHTML = '<p style="color:var(--palette-label);font-size:12px;">Loading…</p>';
  auditModal.classList.add('open');
  auditModal.style.display = 'flex';
  try {
    const rows = await fetch('/api/master-index-audit?limit=300').then(r => r.json());
    if (!Array.isArray(rows) || rows.length === 0) {
      $('auditContent').innerHTML = '<p style="color:var(--palette-label);font-size:12px;">No entries yet.</p>';
      return;
    }
    const fmt = iso => iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const actionLabel = a => ({ yn_change: 'Y/N change', archived: 'Archived', restored: 'Restored' }[a] || a);
    let html = `<table style="width:100%;border-collapse:collapse;font-size:11.5px;">
      <thead><tr style="background:var(--palette-head-bg);text-align:left;">
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">When</th>
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">Document</th>
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">Action</th>
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">Change</th>
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">Reason</th>
        <th style="padding:6px 8px;border-bottom:2px solid var(--palette-border);">Changed by</th>
      </tr></thead><tbody>`;
    rows.forEach(r => {
      const change = r.field ? `${r.field}: ${r.oldValue || '–'} → ${r.newValue || '–'}` : '';
      html += `<tr style="border-bottom:1px solid var(--palette-border);">
        <td style="padding:5px 8px;white-space:nowrap;">${esc(fmt(r.changedAt))}</td>
        <td style="padding:5px 8px;white-space:nowrap;">${esc(r.docNo || '')} ${esc(r.docName || '')}</td>
        <td style="padding:5px 8px;white-space:nowrap;">${esc(actionLabel(r.action))}</td>
        <td style="padding:5px 8px;">${esc(change)}</td>
        <td style="padding:5px 8px;">${esc(r.reason || '')}</td>
        <td style="padding:5px 8px;">${esc(r.changedBy || '')}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    $('auditContent').innerHTML = html;
  } catch (e) {
    $('auditContent').innerHTML = `<p style="color:var(--palette-fail);font-size:12px;">Failed to load: ${esc(e.message)}</p>`;
  }
}

$('auditLogBtn').addEventListener('click', openAuditLog);
$('auditClose').addEventListener('click', () => { auditModal.classList.remove('open'); auditModal.style.display = 'none'; });
auditModal.addEventListener('click', e => { if (e.target === auditModal) { auditModal.classList.remove('open'); auditModal.style.display = 'none'; } });
```

> **Note:** The "Audit log" button and modal should only be visible to admins. In `init()`, after the existing `if (!isAdmin)` block that hides `addRecordBtn` and `headersBtn`, add:
> ```js
> if (!isAdmin) $('auditLogBtn').style.display = 'none';
> ```

---

## 4. Commit message template

```
feat: audit log for master index Y/N changes and archive/restore actions

- prisma: add MasterIndexAuditLog table (recordId, action, field,
  oldValue, newValue, reason, changedBy, changedAt)
- api: POST /api/master-index-audit (write entry) and
  GET /api/master-index-audit (read log, limit 500)
- master-record-index.html:
    - postAudit() helper fires after every save
    - Y/N change listener prompts for reason; reverts select if blank
    - Archive action prompts for reason (replaces confirm dialog)
    - Restore logs 'restored by admin'
    - "Audit log" button (admin only) opens modal showing full log

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3xX6Sjx1AVSdMX7bR
```
