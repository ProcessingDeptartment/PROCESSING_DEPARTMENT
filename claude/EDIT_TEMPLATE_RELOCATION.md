# Instructions: Move "Edit Template" off record pages into an index section

Repo: `PROCESSING_DEPARTMENT` (Render-hosted app)

## Background

Currently **every** REC record page shows an "Edit Template" button in its header
(gated by `PermissionRules.can('manageTemplates')`). This exists in two engines:

- `public/lib/monitoring-log.js`
  - button render: ~line 1082 (`ml_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~lines 1253–1275
- `public/lib/form-record.js`
  - button render: ~line 587 (`fr_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~line 1238 onward

Both call `window.TemplateEditor.open({ recordKey, engine, currentConfig, ... })` where
`currentConfig` is pulled from that record's own inline config (`entryFields`,
`specFields`, etc. — data that only exists inside each record's own HTML file). That's
why the button currently lives on the record page: it's the only place the current
config is already in memory.

## Recommended approach (minimal duplication, keeps config always in sync)

### 1. Remove the visible button from both engines
In `monitoring-log.js` and `form-record.js`, delete the header line that renders the
button:
```js
${canManageTemplates ? `<button class="ml-btn ml-btn-ghost" id="ml_editTemplateBtn">Edit Template</button>` : ''}
```
(and the equivalent `fr_editTemplateBtn` line in `form-record.js`).

### 2. Replace the click-handler with an auto-open-on-load, triggered by a URL param
Instead of wiring a button click, open the same Template Editor automatically when the
page loads with `?editTemplate=1` in the URL:

```js
// ---------- edit template (opened via ?editTemplate=1 from the index, not a button here) ----------
if (canManageTemplates && new URLSearchParams(location.search).get('editTemplate') === '1') {
  function doOpen() {
    window.TemplateEditor.open({
      recordKey: config.recordKey,
      engine: 'monitoring-log', // 'form-record' in form-record.js
      currentConfig: { /* same fields as the old handler already builds */ },
      inlineConfig: null,
      docRevisionStart: config.docRevisionStart,
      onSave: () => location.reload()
    });
  }
  if (window.TemplateEditor) { doOpen(); }
  else {
    const s = document.createElement('script');
    s.src = '../lib/template-editor.js';
    s.onload = doOpen;
    document.head.appendChild(s);
  }
}
```
This keeps `currentConfig` correct (still read live from the page's own config object)
while the entry point moves off the visible record header — the record page itself no
longer shows an edit affordance.

### 3. Add an "Edit Records" section/column on the index
Best home: `public/records/master-record-index.html` — it already lists every record
(it's the existing document-control register), so add an "Edit Template" action per row
rather than building a new page. Each link just appends the query param:
```html
<a href="REC-7.1-incubator-cans-log.html?editTemplate=1">Edit Template</a>
```

Check `public/lib/master-index-data.js` first — if the record table on that page is
generated from this data file rather than hand-written HTML, add the edit-link
generation there so it's produced once for all ~120 records instead of hand-editing
the table. Gate the column the same way the old button was gated: only render/show it
when `PermissionRules.can('manageTemplates')` is true for the current user, so
non-admin users don't see an "Edit Template" column at all.

Alternative: if `master-record-index.html` feels like the wrong home (it's framed as a
read-only document-control register), add a new "Edit Records" section on
`public/index.html` instead, as its own table/list. Either location satisfies "not on
the record itself, but under the index" — pick whichever fits the site's existing
structure better once you're looking at both files.

### 4. Test
- Confirm the "Edit Template" button no longer appears on any record page.
- Confirm that, as an admin/manageTemplates user, clicking "Edit Template" from the new
  index section still opens the same Template Editor modal as before, and that
  `onSave` still does `location.reload()` to reflect saved changes.
- Confirm non-admin users see no edit affordance anywhere (neither the old button nor
  the new index link/column).

## Scope check before starting

Search `public/lib/` for other doc engines with the same button pattern:
`policy-doc.js`, `procedure-doc.js`, `sop-doc.js`, `prp-doc.js`. Those render
Policies/Procedures/SOPs/PRPs, not REC records — the instruction was specifically
about "records," so these four files are likely **out of scope**. Confirm with
Michaela before touching them; leave them as-is unless she says otherwise.

---

**Not in scope:** no database/schema design, no other functional changes beyond
relocating this one control.
