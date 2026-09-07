# REC 7.1.3 — Salting and Tumbling: change notes

File to edit: `public/records/REC-7.1.3-salting-and-tumbling.html`
(shared behavior lives in `public/lib/form-record.js` — only touch that for item 3)

---

## 1. Job number intake date isn't pulling through

**Problem:** picking a job number in REC 7.1.3 only autofills `processingFor`. It should
also pull the intake date recorded on Abalone Receiving (REC 7.1.2), the way REC 7.1.5
already does it.

**Reference — REC 7.1.5 does this correctly:**

```js
autofill: [
  { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo', fill: {
    intakeDate: 'receivingDate', harvestFarm: 'receivedFrom', processingFor: 'toBeProcessedFor', wholeWeight: 'intakeWeight'
  },
    restrict: { sizeRange: 'sizeRange' } }
]
```

`fill: { <thisForm'sField>: <sourceForm'sField> }` — left side is the key on *this* form,
right side is the key on `abalone-receiving`. Only fills fields that are still empty.

**REC 7.1.3 currently has:**

```js
autofill: [
  { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo',
    fill: { processingFor: 'toBeProcessedFor' } }
]
```

There's no `date` field being filled, and no field on the form to receive it (the form
just has a generic `date` field with `type: 'date'`, not tied to intake).

**Fix — add `intakeDate` to the fill map.** REC 7.1.3's `date` field is really "date of
this salting/tumbling entry", not the intake date, so add a new field rather than
overloading `date`:

```js
sections: [
  { title: 'Job info', fields: [
    { key: 'jobNo', label: 'Job no.', type: 'jobsearch' },
    { key: 'intakeDate', label: 'Intake date', type: 'date' },   // NEW — read-only-ish, autofilled
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'processingFor', label: 'Processing for', type: 'select', options: ['Can', 'Dried', 'Other'] }
  ]},
  ...
],
```

```js
autofill: [
  { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo',
    fill: { intakeDate: 'receivingDate', processingFor: 'toBeProcessedFor' } }
]
```

Also add `'intakeDate'` to `listColumns` if you want it visible in the record list:

```js
listColumns: ['date', 'jobNo', 'intakeDate', 'processingFor'],
```

---

## 2. Add "Farm" to the new entry section

**Problem:** the "new entry" modal (Job info section) has no harvest farm field.
REC 7.1.5 has this as `harvestFarm`, autofilled from `receivedFrom` on Abalone Receiving.

**Fix — add the field to the section, and autofill it the same way:**

```js
{ title: 'Job info', fields: [
  { key: 'jobNo', label: 'Job no.', type: 'jobsearch' },
  { key: 'intakeDate', label: 'Intake date', type: 'date' },
  { key: 'harvestFarm', label: 'Harvest farm', type: 'text' },   // NEW
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'processingFor', label: 'Processing for', type: 'select', options: ['Can', 'Dried', 'Other'] }
]},
```

```js
autofill: [
  { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo',
    fill: { intakeDate: 'receivingDate', harvestFarm: 'receivedFrom', processingFor: 'toBeProcessedFor' } }
]
```

(This combines with item 1 — one `autofill` entry covers both new fields.)

---

## 3. Make the "new entry" section collapsible

**Problem:** there's currently no collapsible behavior anywhere in `form-record.js` —
section titles (`.fr-section-title`) and the fields under them just render flat inside
the "New entry" / "Edit entry" modal (see `openForm()` around line 1137). This has to be
added to the shared library, not just this one record — but since only REC 7.1.3 asked
for it, gate it behind a per-section flag (`collapsible: true`) so other records are
unaffected unless they opt in.

**Where it lives:** `public/lib/form-record.js`

**a) Section HTML — wrap collapsible sections in a `<details>`, or a div + toggle button.**
Simplest is `<details>`/`<summary>`, which gets you expand/collapse and keyboard/ARIA
behavior for free, no JS wiring needed:

Around line 1148 (`openForm`), change:

```js
html += (config.sections || []).map(sec => `
  <div class="fr-section-title">${esc(sec.title)}</div>
  <div class="fr-grid fr-grid-2">
    ${sec.fields.map(f => `<label class="fr-field${f.wide ? ' wide' : ''}">${esc(f.label)}
      ${fieldInputHtml(`fr_f_${f.key}`, f, existing ? existing.values[f.key] : (f.default || ''))}
    </label>`).join('')}
  </div>`).join('');
```

to:

```js
html += (config.sections || []).map(sec => {
  const fieldsHtml = `<div class="fr-grid fr-grid-2">
    ${sec.fields.map(f => `<label class="fr-field${f.wide ? ' wide' : ''}">${esc(f.label)}
      ${fieldInputHtml(`fr_f_${f.key}`, f, existing ? existing.values[f.key] : (f.default || ''))}
    </label>`).join('')}
  </div>`;
  if (sec.collapsible) {
    return `<details class="fr-section-collapsible"${sec.collapsedByDefault ? '' : ' open'}>
      <summary class="fr-section-title">${esc(sec.title)}</summary>
      ${fieldsHtml}
    </details>`;
  }
  return `<div class="fr-section-title">${esc(sec.title)}</div>${fieldsHtml}`;
}).join('');
```

**b) CSS** — add near the existing `.fr-section-title` rule (around line 107):

```css
.fr-section-collapsible{ margin:14px 0 8px; }
.fr-section-collapsible:first-child{ margin-top:0; }
.fr-section-collapsible > .fr-section-title{ cursor:pointer; margin:0 0 8px; list-style:none; }
.fr-section-collapsible > .fr-section-title::-webkit-details-marker{ display:none; }
.fr-section-collapsible > .fr-section-title::before{ content:'▸'; display:inline-block; width:1em; transition:transform .15s; }
.fr-section-collapsible[open] > .fr-section-title::before{ content:'▾'; }
```

**c) Turn it on for REC 7.1.3's Job info section only:**

```js
sections: [
  { title: 'Job info', collapsible: true, fields: [
    { key: 'jobNo', label: 'Job no.', type: 'jobsearch' },
    { key: 'intakeDate', label: 'Intake date', type: 'date' },
    { key: 'harvestFarm', label: 'Harvest farm', type: 'text' },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'processingFor', label: 'Processing for', type: 'select', options: ['Can', 'Dried', 'Other'] }
  ]},
  { title: 'Sign-off', newPage: true, fields: [
    { key: 'qualityController', label: 'Quality controller', type: 'text' },
    { key: 'processDeviation', label: 'Process deviation', type: 'textarea', wide: true }
  ]}
],
```

Leave `collapsedByDefault` off (i.e. open by default) unless you actually want it
starting closed — the jobsearch field lives inside it, so a closed-by-default section
means an extra click before you can even pick a job number.

**Note:** required-field validation on `fieldInputHtml`/save should still work fine
inside a closed `<details>` — browsers do expand a closed `<details>` automatically to
show a native "required" validation message, so no extra JS needed there. Worth a quick
test after the change though, since this form's validation may be custom rather than
native HTML5 `required`.

---

## 4. Salting batch fields aren't user-friendly (roster columns)

You said the fields are functionally fine but not user friendly — no specific asks yet,
so no changes made here. Current roster columns, for reference when you're ready:

```
batchId, sizeRange, standardSaltingTime (derived), noOfCrates, startTime, finishTime,
totalTumblingTime (derived), shuckWeight, saltKg, saltPercentUsed, saltBatchCode,
bakingSodaKg, bakingSodaBatchCode, sugarKg, sugarPercentUsed, sugarBatchCode
```

That's 16 columns rendered as one `.fr-roster-row` flex strip (stacks vertically on
phone, per the CSS at line ~142). Common complaints with a row this wide are usually:
too many columns to scan, salt/soda/sugar sub-groups not visually separated, and
percent-used fields that could probably be derived (weight ÷ shuck weight) rather than
typed. Flag which of those (or something else) is the actual pain point and I'll turn it
into concrete field/CSS changes the same way as above.
