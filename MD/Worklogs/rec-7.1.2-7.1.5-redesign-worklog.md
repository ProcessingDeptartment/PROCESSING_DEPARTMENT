# REC 7.1.2 & 7.1.5 entry-flow redesign - work log (2026-10-05)

Specs read: `MD/rec-7.1.2-basket-entry-flow-instructions.md`, `MD/rec-7.1.5-oosw-entry-flow-instructions.md`, `MD/rec-7.1.2-7.1.5-tablet-ux-instructions.md`.
(They are in `MD/`, not `claude/`. `record-sections-collapse-and-job-autofocus-instructions.md` does not exist on disk - worked from the existing engine.)

## Files changed
| File | Change |
|---|---|
| `public/lib/entry-flow.js` (new, v1) | `EntryFlow.oosw()` and `EntryFlow.receiving()` - the two entry panels |
| `public/lib/form-record.js` (v70 -> **v71**) | one addition: `container._setRows(rows)` (replace all roster rows). Nothing else touched |
| `public/styles/responsive.css` (v1 -> **v4**) | `.ef-*` styles, touch font sizes in the `(pointer: coarse)` block, print revert. Backup `.bak-2026-10-05` |
| `public/records/REC-7.1.5-salting-oosw.html` | version bumps, loads entry-flow, `EntryFlow.oosw()` |
| `public/records/REC-7.1.2-abalone-receiving.html` | version bumps, old inline Current-basket script replaced by `EntryFlow.receiving()`, Job info summary = job no. / farm / date. Backups `.bak-2026-10-05` |

## Storage
No stored key, column, CSV or print change. The engine roster remains the only store (`sizeRange/weight` for 7.1.5; `sizeRange/basketNr/wholeWeight/farmCount/mortalityCount` for 7.1.2). The engine table is hidden on screen and shown again under `@media print`.
Removed: the old 7.1.2 inline panel script (barcode text box, sticky size, Change size). Kept: `window.RecScale.submitWeight`, the "complete Job info before Save draft" guard, labelled-barcode parsing (`basket 12 count 40` -> basket # + count).

## Tested (Browser pane, 768x1024, local dev server)
7.1.2 - new entry shows only Job info; Confirm disabled until required fields valid; Confirm collapses Job info (summary shows job/farm/date), opens Basket entry with focus on Basket #, list collapsed ("0 baskets - 0.00 kg"); size modal Set disabled until chosen; FD1234 -> "Use 1234"; Add -> toast, fields clear, focus back, tally and list header update; size change mid-session; delete with confirm; non-numeric basket # rejected; roster store and Whole weight total match.
7.1.5 - gate wraps the panel; buttons disabled until size chosen; Add/replace/Update label/toast text; Edit link; remove with confirm; % sums 100; touch sizes: segment 48, input 48, Add 56, Edit 44, x 40.

## Not verified / open items
- Real job-gate confirm on 7.1.5 (needs live job list; I lifted the gate by hand). Camera scan not tested (no BarcodeDetector in test browser - button correctly absent).
- Draft restore, print/PDF, CSV and the 7.4.0 OOSW cap rule were not run; they read the unchanged roster store.
- Screenshot of final portrait layout not re-checked after the last CSS tweak.
- **Timestamp per basket is not stored** (no column; schema change was ruled out). Order is preserved.
- Basket # must be numeric (the stored column is a number type) - the brief did not say so.
- Submit needs >= 1 basket (brief section 5): enforced by a click guard in entry-flow, not engine validation.
- Print: used the engine's existing before-print "open all sections" instead of the brief's `details > * {display:block}`, which would break grid layouts.
- Green section: no green *background* exists in the code; matched the existing green-topped tally card (`--rt-green`).
- Tablet brief 2.2 (amber/green total bar) not built: with percentages derived from the total it is always 100 %.
- 7.1.2 old "Count/Mortality" entry fields are no longer on screen (brief has none); old values on drafts are kept.
- Memory notes warn another chat may overwrite `form-record.js` - re-check `_setRows` is still present after any merge.
