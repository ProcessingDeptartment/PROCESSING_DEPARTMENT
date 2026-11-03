# REC 7.4.1 — "Add Steam" Button: Open Section Instead of Scroll-to-New-Row

**Record:** `drying-process` (REC 7.4.1)
**File:** `public/lib/form-record.js`
**Record-def:** `public/data/record-defs/drying-process.json`

---

## Current behaviour

Clicking **"+ Add steam"** calls `_addRow()`, which:
1. Appends a blank new steam card to the roster
2. Immediately scrolls the page down to the new card (smooth scroll)

On a form where the page is already long, this causes a disorienting jump.

---

## Desired behaviour

Clicking **"+ Add steam"** should:
1. Scroll smoothly to the **top of the Steams roster section** — so the operator can see all existing steams
2. **Not** append a new blank card automatically
3. The operator then clicks **"+ Add steam"** again (from within the roster section, or a second button at the top of it) to add a new row

OR — simpler interpretation: the button just **expands / opens** the steams section if it is collapsed, scrolls to it, and does nothing else. A separate button inside the section adds new rows.

> **Preferred approach (pick one and code it):**
>
> **Option A — Scroll-only:** "Add steam" scrolls to the roster and stops. The `+ Add` button that lives at the bottom of the roster section is what actually adds a row. Good if operators never need to add more than one steam per page-load.
>
> **Option B — Scroll then add:** "Add steam" scrolls to the roster section heading, waits 400ms for the scroll to land, then adds the new row at the bottom. The page does NOT jump to the new row. The operator scrolls down naturally to find it.
>
> **Recommended: Option B** — scroll to section, then add, no forced scroll to the new card.

---

## Changes

### 1. Suppress the scroll-to-new-card in `_addRow` for `cardRows` rosters — **only** when `roster.addScrollsToSection` is true

In `form-record.js`, around line 3285–3298, the card-row add path currently does:

```js
const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const card = () => container.querySelector('.fr-pot-card[data-roster-row="' + newIdx + '"]');
const reveal = () => { const c = card(); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
setTimeout(() => {
  reveal();
  if (!touch && first) { try { first.focus({ preventScroll: true }); } catch (err) {} }
  setTimeout(() => {
    const c = card();
    if (c && Math.abs(c.getBoundingClientRect().top - 84) > 40) c.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, 600);
}, 30);
return;
```

**Wrap the scroll calls in a guard:**

```js
const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const card = () => container.querySelector('.fr-pot-card[data-roster-row="' + newIdx + '"]');

if (!roster.addScrollsToSection) {
  // Normal behaviour: scroll to the new card
  const reveal = () => { const c = card(); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  setTimeout(() => {
    reveal();
    if (!touch && first) { try { first.focus({ preventScroll: true }); } catch (err) {} }
    setTimeout(() => {
      const c = card();
      if (c && Math.abs(c.getBoundingClientRect().top - 84) > 40) c.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 600);
  }, 30);
}
// If addScrollsToSection: no scroll — the button already scrolled to the section heading
return;
```

---

### 2. Change the "Add Steam" button click handler to scroll first, then add

Around line 3413, the button is wired as:

```js
el(rosterDomId('fr_addRosterRowBtn', i)).addEventListener('click',
  () => container.querySelector('#' + rowsId)._addRow());
```

**Replace with:**

```js
el(rosterDomId('fr_addRosterRowBtn', i)).addEventListener('click', () => {
  const rowsEl = container.querySelector('#' + rowsId);
  if (roster.addScrollsToSection) {
    // Scroll to the roster section heading, then add the row after scroll lands
    const rosterSection = container.querySelector('.fr-section-roster, .fr-roster-wrap, [data-roster-section]');
    const scrollTarget = rosterSection || rowsEl;
    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => rowsEl._addRow(), 420);
    } else {
      rowsEl._addRow();
    }
  } else {
    rowsEl._addRow();
  }
});
```

> **Note:** The selector `'.fr-section-roster, .fr-roster-wrap, [data-roster-section]'` may need adjusting to match the actual DOM element that wraps the steams section heading. Inspect the rendered page in DevTools to find the correct selector for the Steams section container.

---

### 3. Set the flag in `drying-process.json`

In `public/data/record-defs/drying-process.json`, inside the `"roster"` object, add:

```json
"addScrollsToSection": true
```

So the roster block begins:
```json
"roster": {
  "title": "Steams",
  "addLabel": "+ Add steam",
  "addScrollsToSection": true,
  "cardRows": true,
  ...
}
```

This flag is record-specific — no other record is affected.

---

## After changes

1. Bump `?v=N` in all HTML files referencing `form-record.js`:
   ```bash
   grep -rl "form-record.js" public/records/
   ```
   Increment the version number by 1 in each.

2. Commit and push:
   ```bash
   git add public/lib/form-record.js public/data/record-defs/drying-process.json public/records/
   git commit -m "REC 7.4.1: Add steam scrolls to section, does not jump to new card"
   git push
   ```

3. Render deploys in ~30s. Test on tablet: tap "Add steam", verify the page scrolls to the top of the steams section and a new blank steam card appears at the bottom without the page jumping to it.
