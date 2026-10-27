# Template Versioning — View History & Revert

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Type:** New feature — new API route, new UI in template-editor.js.  
**No DB schema changes needed** — `KeyValueHistory` already records every `record_template:*` write automatically.

---

## Background

Templates are stored in Neon as `KeyValue` rows with key `record_template:<recordKey>`. The `KeyValueHistory` table already has an append-only row for every write (before + after values, actor, role, timestamp), written in the same transaction. This means full version history already exists — the gap is only exposing it.

---

## What this adds

1. A "Version history" button inside the template editor panel.
2. A history drawer showing all saved versions with their timestamp, reason, and who saved them.
3. A "Restore this version" button on each history entry that loads it back as the working draft (user still has to click Save to commit it).

---

## 1. API — add the history route

### Add to `src/index.js`

After the `GET /api/master-index-audit` route, add:

```js
// GET /api/template-history/:recordKey
// Returns KeyValueHistory rows for the record_template:<recordKey> key, newest first.
app.get('/api/template-history/:recordKey', async (req, res) => {
  const key = 'record_template:' + req.params.recordKey;
  try {
    const rows = await prisma.keyValueHistory.findMany({
      where: { key },
      orderBy: { at: 'desc' },
      take: 50,
      select: { id: true, action: true, after: true, actor: true, role: true, at: true }
    });
    // Parse the `after` JSON to extract savedAt, savedBy and reason for display
    const out = rows.map(r => {
      let meta = {};
      try { meta = r.after ? JSON.parse(r.after) : {}; } catch (_) {}
      return {
        id: r.id,
        action: r.action,
        savedAt: meta.savedAt || null,
        savedBy: meta.savedBy || r.actor || null,
        reason: meta.reason || null,
        after: r.after || null,
        at: r.at
      };
    });
    res.json(out);
  } catch (e) {
    console.error('GET /api/template-history failed', e);
    res.status(500).json({ ok: false });
  }
});
```

---

## 2. Frontend — `public/lib/template-editor.js`

### 2a. Add "Version history" button to the editor toolbar

Inside `render()`, find the block that builds the action row at the bottom of the editor. It contains the "Save template" and "Cancel" buttons. Add a "Version history" button alongside them:

Find the line that renders the reset/cancel/save row — it looks like:

```js
html += `...
  <button type="button" class="te-btn-flat" id="te_cancelBtn">Cancel</button>
  <button type="button" class="te-btn-primary" id="te_saveBtn">Save template</button>
</div>`;
```

Change to:

```js
html += `...
  <button type="button" class="te-btn-flat" id="te_historyBtn">Version history</button>
  <button type="button" class="te-btn-flat" id="te_cancelBtn">Cancel</button>
  <button type="button" class="te-btn-primary" id="te_saveBtn">Save template</button>
</div>`;
```

### 2b. Wire up the button

After the existing `overlay.querySelector('#te_saveBtn').addEventListener('click', doSave);` line, add:

```js
const histBtn = overlay.querySelector('#te_historyBtn');
if (histBtn) histBtn.addEventListener('click', () => openHistory(overlay, o.recordKey));
```

### 2c. Add the `openHistory()` function

Add this function inside the IIFE, before the closing `})();`:

```js
async function openHistory(overlay, recordKey) {
  // Build or reuse a history drawer div inside the overlay
  let drawer = overlay.querySelector('.te-history-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'te-history-drawer';
    drawer.style.cssText = 'position:absolute;top:0;right:0;bottom:0;width:min(440px,100%);'
      + 'background:#fff;border-left:1px solid #d0d5db;overflow-y:auto;z-index:10;padding:16px;'
      + 'box-shadow:-4px 0 16px rgba(0,0,0,.12);';
    overlay.querySelector('.dh-modal-inner, .te-inner, [class*="inner"]').style.position = 'relative';
    overlay.querySelector('.dh-modal-inner, .te-inner, [class*="inner"]').appendChild(drawer);
  }
  drawer.innerHTML = '<p style="font-size:12px;color:#6b7280;">Loading history…</p>';

  let rows;
  try {
    rows = await fetch('/api/template-history/' + encodeURIComponent(recordKey)).then(r => r.json());
  } catch (e) {
    drawer.innerHTML = `<p style="color:#dc2626;font-size:12px;">Failed to load: ${e.message}</p>`;
    return;
  }

  const fmt = iso => iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  if (!Array.isArray(rows) || rows.length === 0) {
    drawer.innerHTML = '<p style="font-size:12px;color:#6b7280;">No saved versions yet.</p>';
    return;
  }

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#374151;">Version history</strong>
    <button class="te-btn-flat te-history-close" style="font-size:11px;">Close ✕</button>
  </div>`;

  rows.forEach((r, i) => {
    const label = i === 0 ? ' <span style="background:#e6f0e6;color:#2f5d33;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:9px;text-transform:uppercase;margin-left:6px;">Current</span>' : '';
    html += `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
      <div style="font-size:11.5px;font-weight:600;color:#1f2937;">${fmt(r.at)}${label}</div>
      ${r.reason ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">Reason: ${r.reason}</div>` : ''}
      ${r.savedBy ? `<div style="font-size:11px;color:#6b7280;">By: ${r.savedBy}</div>` : ''}
      ${i > 0 && r.after
        ? `<button class="te-btn-flat te-restore-btn" data-idx="${i}" style="margin-top:8px;font-size:11px;border-color:#b45309;color:#b45309;"
             data-json="${r.after.replace(/"/g, '&quot;')}">Restore this version</button>`
        : ''}
    </div>`;
  });

  drawer.innerHTML = html;

  drawer.querySelector('.te-history-close').addEventListener('click', () => drawer.remove());

  drawer.querySelectorAll('.te-restore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Load this version as the working draft?\n\nYou will still need to click "Save template" to commit it.')) return;
      try {
        const obj = JSON.parse(btn.dataset.json);
        // Pass the restored config back into the editor by calling open() with it as currentConfig
        close(); // close current editor
        window.TemplateEditor.open({
          ...o,
          currentConfig: obj,
          restoredVersion: true
        });
      } catch (e) { alert('Could not parse version: ' + e.message); }
    });
  });
}
```

> **Note on `close()` and `o`:** The `o` variable is the options object passed into `TemplateEditor.open()`. The `close()` function closes the current overlay. Both are already in scope because `openHistory` is defined inside the same closure. If the editor's internal structure differs, you may need to pass `o` and `close` explicitly as parameters.

### 2d. Add `reason` to the saved template JSON

The history drawer already shows `reason` from the saved JSON. To make this work, ensure the `override` object that gets saved already includes `reason`. Find the block in `doSave` where `override` is built, and confirm that `reason` from `overlay.querySelector('#te_reason').value` is included:

```js
const override = {
  schemaVersion: 1,
  engine,
  savedAt: Date.now(),
  savedBy: changedBy,
  reason: reason,      // ← confirm this line exists; add it if missing
  // ... rest of fields
};
```

If the `reason` field is not currently in the `override` object, add it.

---

## 3. Test checklist

- [ ] Template editor opens as normal.
- [ ] "Version history" button appears in the editor footer.
- [ ] Clicking it opens the history drawer listing saved versions with date, reason, and saved-by.
- [ ] The current (newest) version is labelled "Current".
- [ ] "Restore this version" button appears on all versions except the current.
- [ ] Clicking Restore + confirming closes the editor and reopens it with the old config loaded as the draft.
- [ ] The restored draft can be edited further before saving.
- [ ] Saving after a restore writes a new `KeyValueHistory` row with the new reason.
- [ ] History drawer "Close" button removes the drawer without closing the editor.

---

## 4. Commit message template

```
feat: template version history — view and restore previous template saves

- api: GET /api/template-history/:recordKey reads KeyValueHistory rows
  for record_template:<key> (no schema change — history already exists)
- template-editor.js:
    - "Version history" button opens a side drawer listing all saves
      with timestamp, reason and saved-by from the stored JSON
    - "Restore this version" loads the selected version as a working
      draft; user still clicks Save to commit it
    - override JSON now includes reason field so history is readable

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3xX6Sjx1AVSdMX7bR
```
