# Admin — Verification Preview Fields Configuration

**New file:** `public/pages/admin-verification-preview.html`  
**Also update:** `public/pages/awaiting-verification.html` (small addition — see §6)  
**Also update:** `public/pages/admin-passkeys.html` (add link — see §7)

**Depends on:** `MD/verification-preview-rich-instructions.md` must be applied first (that instruction adds `DEFS` loading and `previewDl()` to `awaiting-verification.html`).

**Purpose:** Administrators configure which fields appear when a verifier clicks Preview on an entry in the Awaiting Verification queue. Configuration is stored in key-value storage and overrides each record's default `listColumns`. No DB change, no deploy of JS libs.

---

## Architecture

```
Admin page
  ↓ writes
storage key: "verification_preview_config"
  → JSON object: { [recordKey]: string[] }
    e.g. { "drying-process": ["jobNo", "entryDate", "roster:count", "jiProcessingFor"] }

awaiting-verification.html
  ↓ reads (on load, before rendering previews)
storage key: "verification_preview_config"
  → if recordKey present in config → use that array
  → else fall back to record-def's listColumns
  → else fall back to first 8 scalar fields
```

---

## 1 — Page file: `public/pages/admin-verification-preview.html`

### 1.1 — Head / imports

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verification Preview Fields — Admin</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#A9763A">
<link rel="stylesheet" href="../styles/record-theme.css?v=1">
```

Load scripts in this order (same versions as `awaiting-verification.html`):
```html
<script src="/lib/page-nav.js?v=1"></script>
<script src="../lib/master-index-data.js?v=4"></script>
<script src="../lib/data-store.js?v=5"></script>
<script src="../lib/api-backend.js?v=18"></script>
<script src="../lib/permission-rules.js?v=8"></script>
<script src="../lib/auth.js?v=5"></script>
<script src="../lib/login-ui.js?v=6"></script>
```

### 1.2 — CSS

Add a `<style>` block with these rules:

```css
body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1b2330; background: #f4f5f3; font-size: 13px; margin: 0; }

.page-header { background: #1d2b38; color: #f4f1e8; padding: 16px 20px; }
.page-header h1 { margin: 0; font-size: 18px; font-weight: 600; }
.page-header p { margin: 4px 0 0; color: #b9c3cc; font-size: 12px; }
.back-link { display: inline-block; margin-top: 6px; color: #b9c3cc; text-decoration: none; font-size: 12px; }
.back-link:hover { color: #fff; }

.container { max-width: 960px; margin: 0 auto; padding: 20px 20px 80px; }

.state { padding: 10px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 600; margin-bottom: 14px; }
.state.ok  { background: #e8f3ec; color: #2f7a52; }
.state.bad { background: #fbe8e6; color: #a3352d; }
.state.info { background: #e6eefb; color: #1d4ed8; }

.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.search-box { padding: 7px 11px; border: 1px solid #c9cdd1; border-radius: 6px; font-size: 13px; flex: 1; min-width: 200px; max-width: 360px; }
.btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid #c9cdd1; background: #fff; }
.btn:hover { background: #f2f4f6; }
.btn-primary { background: #2f4356; color: #fff; border-color: #2f4356; }
.btn-primary:hover { background: #1d2b38; }
.btn-sm { padding: 5px 10px; font-size: 12px; font-weight: 500; }
.btn-ghost { background: transparent; color: #5c6771; border-color: #c9cdd1; }

/* Record accordion */
.rec-list { display: flex; flex-direction: column; gap: 8px; }
.rec-card { background: #fff; border: 1px solid #e2e4e3; border-radius: 8px; overflow: hidden; }
.rec-head { display: flex; align-items: center; gap: 10px; padding: 11px 14px; cursor: pointer; user-select: none; }
.rec-head:hover { background: #f9fafb; }
.rec-chevron { color: #8a939b; font-size: 11px; transition: transform .15s; }
.rec-head.open .rec-chevron { transform: rotate(90deg); }
.rec-name { font-weight: 600; font-size: 13px; flex: 1; }
.rec-doc { color: #8a939b; font-size: 11.5px; }
.rec-badge { font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #e8f3ec; color: #2f7a52; font-weight: 700; white-space: nowrap; }
.rec-badge.custom { background: #fff3dd; color: #8a5a10; }
.rec-badge.empty { background: #f4f5f3; color: #8a939b; }
.rec-body { display: none; padding: 14px 16px; border-top: 1px solid #e2e4e3; }
.rec-body.open { display: block; }

/* Field editor */
.editor-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 640px) { .editor-layout { grid-template-columns: 1fr; } }

.editor-col h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #5c6771; margin: 0 0 8px; }

/* Selected fields — ordered list with up/down/remove */
.sel-list { display: flex; flex-direction: column; gap: 4px; min-height: 40px; }
.sel-item { display: flex; align-items: center; gap: 6px; background: #f4f5f3; border: 1px solid #e2e4e3; border-radius: 5px; padding: 6px 8px; font-size: 12.5px; }
.sel-item .item-label { flex: 1; }
.sel-item .item-key  { font-size: 11px; color: #8a939b; font-family: 'IBM Plex Mono', monospace; }
.sel-move { background: none; border: none; cursor: pointer; color: #8a939b; padding: 1px 3px; font-size: 13px; line-height: 1; }
.sel-move:hover { color: #1b2330; }
.sel-remove { background: none; border: none; cursor: pointer; color: #c0392b; padding: 1px 4px; font-size: 14px; font-weight: 700; line-height: 1; }
.sel-remove:hover { color: #a3352d; }
.sel-empty { color: #8a939b; font-size: 12px; font-style: italic; padding: 8px 0; }

/* Available fields — checkbox list */
.avail-list { display: flex; flex-direction: column; gap: 3px; max-height: 280px; overflow-y: auto; border: 1px solid #e2e4e3; border-radius: 5px; padding: 6px 8px; background: #fafafa; }
.avail-item { display: flex; align-items: center; gap: 8px; padding: 4px 2px; font-size: 12.5px; cursor: pointer; }
.avail-item:hover { background: #f2f4f6; border-radius: 3px; }
.avail-item input[type=checkbox] { cursor: pointer; }
.avail-item .item-key { font-size: 11px; color: #8a939b; font-family: 'IBM Plex Mono', monospace; }
.avail-loading { color: #8a939b; font-size: 12px; font-style: italic; padding: 8px; }

/* Special roster:count item */
.roster-toggle { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #f4f1e8; border: 1px solid #e8d9b8; border-radius: 5px; font-size: 12.5px; cursor: pointer; margin-bottom: 6px; }
.roster-toggle input { cursor: pointer; }

.rec-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; border-top: 1px solid #e2e4e3; padding-top: 12px; }

/* Loading skeleton */
.skeleton { background: #e8eaed; border-radius: 4px; animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

#toast { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); background: #1b2330; color: #fff; padding: 10px 18px; border-radius: 7px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 60; }
#toast.show { opacity: 1; }
```

### 1.3 — HTML body

```html
<body>
<div class="page-header">
  <h1>Verification Preview Fields</h1>
  <p>Configure which fields a verifier sees when they expand an entry in the Awaiting Verification queue — without opening the full record.</p>
  <a class="back-link" href="../index.html">← Back to Processing Department</a>
</div>

<div class="container">
  <div class="state info" id="state">Loading…</div>

  <div class="toolbar" id="toolbar" style="display:none;">
    <input class="search-box" id="search" type="search" placeholder="Filter records…" autocomplete="off">
    <button class="btn btn-primary" id="btnSaveAll">Save all changes</button>
  </div>

  <div class="rec-list" id="recList"></div>
</div>

<div id="toast"></div>
```

### 1.4 — JavaScript (inline `<script>`)

Implement the following logic:

#### Module-level state

```js
var STORAGE_KEY = 'verification_preview_config';
var DEFS = {};        // recordKey → parsed record-def JSON (null if unavailable)
var CONFIG = {};      // recordKey → string[] — the current saved override config
var PENDING = {};     // recordKey → string[] — unsaved edits in this session
var OPEN = {};        // recordKey → bool — accordion open state
```

#### Helper functions

```js
function esc(s) { /* standard HTML-escape */ }
function toast(msg, duration) { /* show #toast for 2.4s */ }
function setState(cls, html) { /* set #state className and innerHTML */ }
function humanLabel(k) { /* camelCase → Title Case, replace underscores */ }
```

#### `loadConfig()` — read saved config from storage

```js
async function loadConfig() {
  try {
    var raw = await window.storage.get(STORAGE_KEY, true);
    if (raw && raw.value) {
      var parsed = JSON.parse(raw.value);
      if (parsed && typeof parsed === 'object') CONFIG = parsed;
    }
  } catch (e) { /* silent — empty config is fine */ }
}
```

#### `saveConfig()` — write PENDING merges into CONFIG then persist

Called by the **Save all changes** button AND the per-record **Save** button:

```js
async function saveConfig(singleRecordKey) {
  // merge PENDING into CONFIG (for the one record if singleRecordKey given, else all)
  var keys = singleRecordKey ? [singleRecordKey] : Object.keys(PENDING);
  keys.forEach(function (rk) {
    if (PENDING[rk] !== undefined) {
      if (PENDING[rk] === null) {
        delete CONFIG[rk];     // null means "reset to default"
      } else {
        CONFIG[rk] = PENDING[rk].slice();
      }
      delete PENDING[rk];
    }
  });
  // persist
  var ok = await window.storage.set(STORAGE_KEY, JSON.stringify(CONFIG), true);
  if (ok === false) throw new Error('storage write failed');
}
```

#### `loadDef(recordKey)` — fetch record-def JSON (cached in DEFS)

```js
async function loadDef(rk) {
  if (DEFS[rk] !== undefined) return DEFS[rk];
  try {
    var res = await fetch('../data/record-defs/' + encodeURIComponent(rk) + '.json', { cache: 'default' });
    DEFS[rk] = res.ok ? await res.json() : null;
  } catch (e) {
    DEFS[rk] = null;
  }
  return DEFS[rk];
}
```

#### `fieldsFromDef(def)` — return available field descriptors

Returns an array of `{ key, label }` objects representing every field the admin can include. Rules:
- Include all fields from `def.sections[].fields[]` where:
  - `f.key` is present
  - `f.hidden !== true` OR `f.key` matches a known useful key (`entryDate`, `jobNo`, `batchField` value from def) — i.e. some hidden fields are critical identifiers and should be available
  - Skip `readOnly` fields from the `legacyBlock` and `movementBlock` sections (those are internal timestamps; use `sec.legacyBlock || sec.movementBlock` to detect and skip those sections)
- Include `roster:count` as a special option if `def.roster` exists, with label `"<def.roster.title> count"` (e.g. "Steams count")
- De-duplicate by key

```js
function fieldsFromDef(def) {
  var seen = {};
  var fields = [];
  (def.sections || []).forEach(function (sec) {
    if (sec.legacyBlock || sec.movementBlock) return;  // skip internal sections
    (sec.fields || []).forEach(function (f) {
      if (!f.key || seen[f.key]) return;
      // include hidden fields only if they're the batchField (job no.) or entryDate
      if (f.hidden && f.key !== def.batchField && f.key !== 'entryDate') return;
      seen[f.key] = true;
      fields.push({ key: f.key, label: f.label || humanLabel(f.key) });
    });
  });
  // add roster:count if roster exists
  if (def.roster) {
    fields.push({ key: 'roster:count', label: (def.roster.title || 'Roster') + ' count' });
  }
  return fields;
}
```

#### `currentFields(rk)` — the field array currently being edited

Returns `PENDING[rk]` if set, else `CONFIG[rk]` if set, else `def.listColumns` if available, else `[]`.

```js
function currentFields(rk) {
  if (PENDING[rk] !== undefined) return PENDING[rk] || [];
  if (CONFIG[rk] !== undefined) return CONFIG[rk] || [];
  var def = DEFS[rk];
  return (def && def.listColumns) ? def.listColumns.slice() : [];
}
```

#### `isModified(rk)` — true if PENDING differs from saved CONFIG

```js
function isModified(rk) {
  return PENDING[rk] !== undefined;
}
```

#### `renderRecordList(filterText)` — render the accordion list

Build HTML for all records (filtered by `filterText` if provided). Each record card has:
- Header: chevron `▶`, record name, doc code, badge showing either "N fields (custom)" (amber) if overridden, "N fields" (green) if using def default, or "No preview" (grey) if empty
- Body (hidden until open): the field editor (see §1.4 below)

```js
function renderRecordList(filterText) {
  var rows = (window.MasterIndexData && window.MasterIndexData.rows) || [];
  var q = (filterText || '').toLowerCase().trim();
  var filtered = rows.filter(function (r) {
    return !q || r.name.toLowerCase().includes(q) || (r.docNo || '').toLowerCase().includes(q) || (r.recordKey || '').toLowerCase().includes(q);
  });
  var box = document.getElementById('recList');
  if (!filtered.length) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:#8a939b;">No records match "' + esc(filterText) + '".</div>';
    return;
  }
  box.innerHTML = filtered.map(function (r) {
    return renderRecordCard(r);
  }).join('');
  wireCards();
}
```

#### `renderRecordCard(row)` — single card HTML

```js
function renderRecordCard(row) {
  var rk = row.recordKey;
  var fields = currentFields(rk);
  var isCustom = CONFIG[rk] !== undefined || PENDING[rk] !== undefined;
  var isPending = PENDING[rk] !== undefined;
  var open = OPEN[rk];

  var badgeCls = fields.length === 0 ? 'empty' : (isCustom ? 'custom' : '');
  var badgeText = fields.length === 0 ? 'No preview set'
    : fields.length + ' field' + (fields.length !== 1 ? 's' : '') + (isCustom ? ' (custom)' : '');

  var bodyHtml = open ? renderEditor(rk) : '';

  return '<div class="rec-card" data-rk="' + esc(rk) + '">' +
    '<div class="rec-head' + (open ? ' open' : '') + '" data-rk="' + esc(rk) + '">' +
      '<span class="rec-chevron">▶</span>' +
      '<span class="rec-name">' + esc(row.name) + '</span>' +
      '<span class="rec-doc">' + esc(row.docNo || '') + '</span>' +
      (isPending ? '<span style="font-size:11px;color:#8a5a10;font-weight:600;">● unsaved</span>' : '') +
      '<span class="rec-badge ' + badgeCls + '">' + esc(badgeText) + '</span>' +
    '</div>' +
    '<div class="rec-body' + (open ? ' open' : '') + '" id="body-' + esc(rk) + '">' +
      (open ? bodyHtml : '') +
    '</div>' +
  '</div>';
}
```

#### `renderEditor(rk)` — field editor HTML for an open record

This renders while the def is loading asynchronously. Immediately returns a loading skeleton, then calls `loadDef(rk)` and replaces with the real editor once loaded.

```js
function renderEditor(rk) {
  // Return loading placeholder; async fill happens in openRecord()
  return '<div class="avail-loading" id="editor-' + esc(rk) + '">Loading fields…</div>';
}
```

#### `openRecord(rk)` — load def and render real editor

Called after the card body is shown:

```js
async function openRecord(rk) {
  var def = await loadDef(rk);
  var target = document.getElementById('editor-' + rk);
  if (!target) return;
  target.outerHTML = buildEditorHtml(rk, def);
  wireEditor(rk);
}
```

#### `buildEditorHtml(rk, def)` — full editor panel

```js
function buildEditorHtml(rk, def) {
  var selected = currentFields(rk);  // ordered array of keys currently shown
  var available = def ? fieldsFromDef(def) : [];
  // available = fields not already in selected
  var selectedKeys = new Set(selected);
  var unselected = available.filter(function (f) { return !selectedKeys.has(f.key); });

  // Build a label lookup
  var labelMap = {};
  available.forEach(function (f) { labelMap[f.key] = f.label; });
  function labelFor(k) { return labelMap[k] || humanLabel(k); }

  // Selected column
  var selHtml = selected.length
    ? selected.map(function (k, i) {
        return '<div class="sel-item" data-key="' + esc(k) + '">' +
          '<button class="sel-move" data-action="up" data-key="' + esc(k) + '" title="Move up" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
          '<button class="sel-move" data-action="down" data-key="' + esc(k) + '" title="Move down" ' + (i === selected.length - 1 ? 'disabled' : '') + '>↓</button>' +
          '<span class="item-label">' + esc(labelFor(k)) + '</span>' +
          '<span class="item-key">' + esc(k) + '</span>' +
          '<button class="sel-remove" data-action="remove" data-key="' + esc(k) + '" title="Remove">×</button>' +
        '</div>';
      }).join('')
    : '<div class="sel-empty">No fields selected — verifier will see a fallback dump.</div>';

  // Available column
  var availHtml = unselected.length
    ? unselected.map(function (f) {
        return '<label class="avail-item">' +
          '<input type="checkbox" class="avail-check" data-key="' + esc(f.key) + '">' +
          '<span class="item-label">' + esc(f.label) + '</span>' +
          '<span class="item-key">' + esc(f.key) + '</span>' +
        '</label>';
      }).join('')
    : '<div class="avail-loading">All available fields are already selected.</div>';

  var isCustom = CONFIG[rk] !== undefined || PENDING[rk] !== undefined;

  return '<div id="editor-' + esc(rk) + '">' +
    '<div class="editor-layout">' +
      '<div class="editor-col">' +
        '<h3>Shown in preview (in order)</h3>' +
        '<div class="sel-list" id="sel-' + esc(rk) + '">' + selHtml + '</div>' +
      '</div>' +
      '<div class="editor-col">' +
        '<h3>Available to add</h3>' +
        '<div class="avail-list" id="avail-' + esc(rk) + '">' + availHtml + '</div>' +
        '<div style="margin-top:8px;">' +
          '<button class="btn btn-sm" id="btnAdd-' + esc(rk) + '">+ Add checked fields</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="rec-actions">' +
      (isCustom ? '<button class="btn btn-sm btn-ghost" id="btnReset-' + esc(rk) + '">Reset to record default</button>' : '') +
      '<button class="btn btn-sm btn-primary" id="btnSave-' + esc(rk) + '">Save this record</button>' +
    '</div>' +
  '</div>';
}
```

#### `wireEditor(rk)` — attach event listeners to the editor

```js
function wireEditor(rk) {
  // Up/down/remove buttons on selected items
  var selList = document.getElementById('sel-' + rk);
  if (selList) {
    selList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var key = btn.dataset.key;
      var fields = currentFields(rk).slice();
      var idx = fields.indexOf(key);
      if (action === 'remove') {
        fields.splice(idx, 1);
      } else if (action === 'up' && idx > 0) {
        var tmp = fields[idx - 1]; fields[idx - 1] = fields[idx]; fields[idx] = tmp;
      } else if (action === 'down' && idx < fields.length - 1) {
        var tmp2 = fields[idx + 1]; fields[idx + 1] = fields[idx]; fields[idx] = tmp2;
      }
      PENDING[rk] = fields;
      refreshEditor(rk);
    });
  }

  // Add checked fields button
  var btnAdd = document.getElementById('btnAdd-' + rk);
  if (btnAdd) {
    btnAdd.addEventListener('click', function () {
      var avail = document.getElementById('avail-' + rk);
      if (!avail) return;
      var checked = Array.from(avail.querySelectorAll('.avail-check:checked')).map(function (cb) { return cb.dataset.key; });
      if (!checked.length) { toast('Check at least one field to add.'); return; }
      var fields = currentFields(rk).slice();
      checked.forEach(function (k) { if (fields.indexOf(k) === -1) fields.push(k); });
      PENDING[rk] = fields;
      refreshEditor(rk);
    });
  }

  // Save this record
  var btnSave = document.getElementById('btnSave-' + rk);
  if (btnSave) {
    btnSave.addEventListener('click', async function () {
      btnSave.disabled = true;
      try {
        await saveConfig(rk);
        toast('Saved preview fields for this record.');
        refreshCard(rk);
      } catch (e) {
        toast('Save failed — please retry.');
      } finally {
        btnSave.disabled = false;
      }
    });
  }

  // Reset to default
  var btnReset = document.getElementById('btnReset-' + rk);
  if (btnReset) {
    btnReset.addEventListener('click', function () {
      if (!confirm('Reset to the record\'s built-in default fields? This removes any custom config.')) return;
      PENDING[rk] = null;   // null = remove override
      refreshEditor(rk);
    });
  }
}
```

#### `refreshEditor(rk)` — re-render editor in place (after a state change)

```js
function refreshEditor(rk) {
  var def = DEFS[rk];
  var target = document.getElementById('editor-' + rk);
  if (!target) return;
  var newHtml = buildEditorHtml(rk, def);
  var wrap = document.createElement('div');
  wrap.innerHTML = newHtml;
  target.replaceWith(wrap.firstElementChild);
  wireEditor(rk);
  // also update the card header badge
  var head = document.querySelector('.rec-head[data-rk="' + rk + '"]');
  if (head) {
    var row = (window.MasterIndexData.rows || []).find(function (r) { return r.recordKey === rk; });
    if (row) {
      var fields = currentFields(rk);
      var isCustom = CONFIG[rk] !== undefined || PENDING[rk] !== undefined;
      var isPending = PENDING[rk] !== undefined;
      var badgeCls = fields.length === 0 ? 'empty' : (isCustom ? 'custom' : '');
      var badgeText = fields.length === 0 ? 'No preview set'
        : fields.length + ' field' + (fields.length !== 1 ? 's' : '') + (isCustom ? ' (custom)' : '');
      head.querySelector('.rec-badge').className = 'rec-badge ' + badgeCls;
      head.querySelector('.rec-badge').textContent = badgeText;
      var pendingSpan = head.querySelector('[data-pending]');
      if (isPending && !pendingSpan) {
        head.querySelector('.rec-badge').insertAdjacentHTML('beforebegin',
          '<span style="font-size:11px;color:#8a5a10;font-weight:600;" data-pending>● unsaved</span>');
      } else if (!isPending && pendingSpan) {
        pendingSpan.remove();
      }
    }
  }
}
```

#### `refreshCard(rk)` — re-render the whole card (after save)

```js
function refreshCard(rk) {
  var card = document.querySelector('.rec-card[data-rk="' + rk + '"]');
  if (!card) return;
  var row = (window.MasterIndexData.rows || []).find(function (r) { return r.recordKey === rk; });
  if (!row) return;
  var wrap = document.createElement('div');
  wrap.innerHTML = renderRecordCard(row);
  var newCard = wrap.firstElementChild;
  card.replaceWith(newCard);
  // re-open if it was open
  if (OPEN[rk]) {
    var head = newCard.querySelector('.rec-head');
    var body = newCard.querySelector('.rec-body');
    if (head && body) { head.classList.add('open'); body.classList.add('open'); }
    openRecord(rk);
  }
  wireCards();
}
```

#### `wireCards()` — attach accordion toggle handlers

```js
function wireCards() {
  document.querySelectorAll('.rec-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var rk = head.dataset.rk;
      var body = document.getElementById('body-' + rk);
      if (!body) return;
      OPEN[rk] = !OPEN[rk];
      head.classList.toggle('open', OPEN[rk]);
      body.classList.toggle('open', OPEN[rk]);
      if (OPEN[rk]) {
        body.innerHTML = renderEditor(rk);
        openRecord(rk);
      }
    });
  });
}
```

#### `start()` — initialise

```js
async function start() {
  setState('info', 'Loading…');
  try {
    await window.storage.whenReady();
    await loadConfig();
    document.getElementById('toolbar').style.display = '';
    renderRecordList('');
    setState('ok', 'Configure which fields appear in the verification preview. Changes take effect immediately after saving.');
  } catch (e) {
    setState('bad', 'Could not load configuration. Check the API access key on <a href="api-key.html">this page</a>.');
  }
}
```

#### `window.addEventListener('load', …)` — entry point

```js
window.addEventListener('load', async function () {
  // Gate: admin only
  if (window.LoginUI && window.LoginUI.ensureAuthenticated) {
    try { await window.LoginUI.ensureAuthenticated(); } catch (e) { }
  }
  var role = window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() : null;
  if (!role) {
    setState('bad', 'Sign in to access this page.');
    if (window.LoginUI) window.LoginUI.showLoginModal();
    document.addEventListener('authSuccess', function once() {
      document.removeEventListener('authSuccess', once);
      var r = window.Auth.getCurrentRole();
      if (r === 'ADMINISTRATOR') { start(); return; }
      setState('bad', 'Administrator access required.');
    });
    return;
  }
  if (role !== 'ADMINISTRATOR') {
    setState('bad', 'Administrator access required. You are signed in as ' +
      ((window.PermissionRules && window.PermissionRules.ROLE_LABELS && window.PermissionRules.ROLE_LABELS[role]) || role) + '.');
    document.getElementById('toolbar').style.display = 'none';
    return;
  }

  // Save all button
  document.getElementById('btnSaveAll').addEventListener('click', async function () {
    var btn = document.getElementById('btnSaveAll');
    btn.disabled = true;
    try {
      await saveConfig();   // no arg = save all pending
      toast('All changes saved.');
      renderRecordList(document.getElementById('search').value);
    } catch (e) {
      toast('Save failed — please retry.');
    } finally {
      btn.disabled = false;
    }
  });

  // Search filter
  document.getElementById('search').addEventListener('input', function () {
    renderRecordList(this.value);
  });

  start();
});
```

---

## 2 — Update `awaiting-verification.html` to use the stored config

This is a small addition to the version of `awaiting-verification.html` that was updated by `MD/verification-preview-rich-instructions.md`.

**Step 2a:** Add a module-level variable alongside `DEFS`:

```js
var PREVIEW_CONFIG = {};   // recordKey → string[] from storage (admin override)
```

**Step 2b:** Add a `loadPreviewConfig()` function:

```js
async function loadPreviewConfig() {
  try {
    var raw = await window.storage.get('verification_preview_config', true);
    if (raw && raw.value) {
      var parsed = JSON.parse(raw.value);
      if (parsed && typeof parsed === 'object') PREVIEW_CONFIG = parsed;
    }
  } catch (e) { /* silent */ }
}
```

**Step 2c:** Call it in `start()`, before `scan()`:

```js
// In start(), before the scan() call:
try { await loadPreviewConfig(); } catch (e) { }
```

**Step 2d:** In `previewDl(row)`, change the section B "Decide which fields to show" to check `PREVIEW_CONFIG` first:

Find this line in `previewDl`:
```js
if (def && def.listColumns && def.listColumns.length) {
```

Replace the entire section B block with:

```js
// ── B. Decide which fields to show ─────────────────────────────────────────
var cols = [];
var configCols = PREVIEW_CONFIG[row.recordKey];   // admin override
var fallbackCols = def && def.listColumns && def.listColumns.length ? def.listColumns : null;
var source = configCols || fallbackCols;          // override wins; def default is fallback

if (source && source.length) {
  source.forEach(function (col) {
    if (col === 'roster:count') {
      var rosterTitle = (def && def.roster && def.roster.title) || 'Roster';
      cols.push({ key: '__roster_count', label: rosterTitle + ' entries' });
    } else {
      cols.push({ key: col, label: labelMap[col] || humanLabel(col) });
    }
  });
} else {
  // fallback: show up to 8 scalar fields
  var shown = 0;
  Object.keys(values).forEach(function (k) {
    if (shown >= 8) return;
    var v = values[k];
    if (v == null || v === '' || typeof v === 'object') return;
    cols.push({ key: k, label: labelMap[k] || humanLabel(k) });
    shown++;
  });
}
```

---

## 3 — Add link to admin page from `admin-passkeys.html`

In `admin-passkeys.html`, find the page's main heading area or navigation section (near the top of the content). Add a link to the new page:

```html
<a href="admin-verification-preview.html"
   style="display:inline-block;padding:7px 14px;background:#fff;border:1px solid #d0d5db;border-radius:6px;font-size:13px;color:#1d4ed8;text-decoration:none;margin-bottom:16px;">
  ← Verification Preview Fields
</a>
```

Place it alongside any other admin navigation links at the top of the page's content container.

Also add it to `pages/fsms.html` in the Admin section (alongside admin-passkeys), if one exists, or wherever admin tools are listed.

---

## 4 — Testing checklist

### Admin page
1. Open `pages/admin-verification-preview.html` as **Administrator**.
   - [ ] Page loads, record list appears with all records from master-index.
   - [ ] Each card shows the correct badge: green "N fields" for records using their default `listColumns`, grey "No preview set" for records with no listColumns and no override.
2. Open (Administrator) → sign out → sign in as non-Administrator.
   - [ ] Red error banner: "Administrator access required." No record list shown.
3. Expand a record (e.g. Drying Process).
   - [ ] After a brief "Loading fields…" the editor appears.
   - [ ] Left column shows the current fields in order (from `listColumns` or saved config).
   - [ ] Right column shows all remaining available fields.
4. Click **↑** / **↓** on a selected field.
   - [ ] Order changes immediately.
   - [ ] "● unsaved" badge appears on the card header.
5. Click **×** to remove a field.
   - [ ] Field moves to the Available column.
6. Check a field in Available, click **+ Add checked fields**.
   - [ ] Field appears at the bottom of the Selected column.
7. Click **Save this record**.
   - [ ] Toast: "Saved preview fields for this record."
   - [ ] "● unsaved" badge disappears; badge updates to show new field count with "(custom)".
8. Expand another record, modify it, then click **Save all changes** without saving the individual record.
   - [ ] Both records saved.
9. Click **Reset to record default** on a customised record.
   - [ ] Confirm dialog appears. On confirm: reverts to the record's `listColumns`.

### Verification queue
10. Open `pages/awaiting-verification.html` with pending entries for a record you configured above.
    - [ ] Click Preview — shows the fields you configured (in the order you set), with proper labels.
    - [ ] Roster:count shows the number of roster rows if you added it.
11. Remove all custom config for a record (reset to default) and reload.
    - [ ] Preview falls back to the record def's `listColumns`.

---

## 5 — Commit

```
git add public/pages/admin-verification-preview.html
git add public/pages/awaiting-verification.html
git add public/pages/admin-passkeys.html
git commit -m "feat: admin page to configure verification preview fields per record

- New page: admin-verification-preview.html (Administrator-gated)
- Stores override config in storage key 'verification_preview_config'
- Per-record field picker: select, order (↑↓), remove; add from available fields
- Reset to record default (removes override)
- awaiting-verification.html reads override config first, falls back to listColumns
- Link added from admin-passkeys.html

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019W6FesE1WBUexPbErdjV7S"
git push origin main
```
