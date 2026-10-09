# Tablet field-row alignment + passkey fix — work log

**Date:** 2026-10-02 · **Spec:** `MD/tablet-field-row-alignment-passkey-fix-instructions.md`
**Tested with:** Playwright (`playwright-core`, installed in a scratch folder outside the project) driving desktop Chrome with `hasTouch:true`, against the local server on :3000. Job-picker gate lifted in the test (`.jp-gated` removed) so the whole form is visible; `/api/passkey/verify` mocked.

## 1. Diagnostic (§6 step 1)

- The §2 script **does not catch the passkey bug as written**: it groups cells by `top`, so a cell that is misaligned lands in its own group and is never compared. On REC 7.2.3 it returned `[]` while the Signature input was 10 px higher than its row-mates (bottom 1601 vs 1611).
- Corrected the script to group by the cell's **bottom** edge (valid because the grid is `align-items:end`), and to compare the **last** visible control in each cell. Used for all runs below.
- Before-state, REC 7.2.3 sign-off @ 1180×820: Completed by / Title / Date bottoms 719, Signature bottom 709. After verifying, the row also shifted (old "Confirmed" text sat under the input).
- Before/after screenshots and the first diagnostic output: `claude/tablet-field-row-alignment-shots/`.
- Other offenders found by the script: REC 7.1.2 roster row (`sizeRange` select 40 px beside 48 px inputs); REC 7.2.12 `ds-grid` (hint span between label and input); record-picker cells on 5 mock-recall / NRCS rosters ("View record" link + badge under the select).

## 2. Changes

| File | Change |
|---|---|
| `public/lib/signoff-block.js` | Passkey field is flat: `<label class="… pk-field"><span class="pk-label"><span>Signature</span><span class="pk-status" id="{id}_display" aria-live="polite"></span></span><input …></label>`. No wrapper div, no inline style. Placeholder now "Tap to enter passkey". Script link `passkey-input.js?v=3`. |
| `public/lib/passkey-input.js` | Status written by id (`{fieldId}_display`) as `Name · Confirmed ✓` with `title=""`; adds `is-verified` to `.pk-field`. Removed the `input[placeholder="Enter passkey"]` / `.passkey-verified-display` / `.verified-badge` CSS (it lived in `createNumberPad`, not `mountVerification` as the spec said). Passkey logic, endpoint, stored values untouched. |
| `public/styles/record-theme.css` | `.pk-label`, `.pk-status`, `.pk-field` / `.is-verified` colour-only cue (tablet-scoped twin needed to beat the shared `input[readonly]` rule); `--rt-input-h/-fs` tokens (48/16 default and `pointer:coarse`, 36/14 under `body.rt-pc`) used by field inputs; the two input-sizing media queries changed from `(pointer: coarse), (max-width: 1099px)` to `(pointer: coarse)`; roster-row controls use the one input height; hints after an input (`.fr-carry-hint`, `.fr-jn-hint`) and the record-picker link/badge take no layout space; `.jp-picked` row height = input height; `.ds-grid` / `.ds-field` use the same stack rule. Everything under `.rt-content` / `body.rt-tablet`. |
| `public/records/REC-7.2.12-…html` | Field hint moved onto the label line (`<span class="ds-lbl">label (hint)</span>`), nothing between label and input. |
| 132 record pages | `record-theme.css?v=tv41/tv45 → tv46`, `signoff-block.js?v=6 → 7`. |

## 3. Decisions / deviations

- `.pk-status` `max-width` is **72 %** not 60 %: at 60 % "Confirmed ✓" was truncated in a 4-column row.
- **Roster-row controls are now 48 px on touch** (were 40 px "tap-row" for selects and some inputs; inputs were already 48). Spec rule: one input height per row.
- Only the **two input-sizing** media queries were switched to `(pointer: coarse)`. The other six `(pointer: coarse), (max-width:1099px)` blocks style header/rail/footer chrome, not field size; left as they are. Column counts stay width-based (4 / 2 / 1) as specified. Effect: a narrow *mouse* window no longer gets tablet input density.
- `rt-pc` is set **by hand** in two page HTMLs (Dry NRCS, Dry Export Pack Front Page), not by width; left alone. It already overrides to 36/14 via `--rt-input-h`.
- Job no. "Change" link: in the picked state the job no. + Change replace the search box on one row (no label/input gap, full-width row). No restructure needed; row height now matches inputs.
- Sign-off blocks already use `fr-grid`/`ml-grid`/`ds-grid` fixed tracks and the order Verified by / Title / Date / Signature; all have 4 fields, so no orphans.
- Not changed: passkey behaviour, field names/order, validation, calculations, export, `@media print`, out-of-scope pages.

## 4. Playwright run (§6 step 5)

132 record pages in `public/records` (excludes `_shell-test`, `batch-trace`, `double-seam-trend`, `master-record-index`, `quick-abalone-receiving`, `record-list`, `seam-quick-calculator`). Corrected §2 script, `hasTouch:true`.

| Viewport | Pages | Pass | Fail |
|---|---|---|---|
| 1180×820 | 132 | 132 | 0 |
| 820×1180 | 132 | 132 | 0 |
| 1024×768 | 132 | 132 | 0 |
| 768×1024 | 132 | 132 | 0 |
| 390×844 | 132 | 132 | 0 |

The full run flagged 5 pages at four of the viewports (NRCS Canning, REC 8.1.6, 8.1.6 canned, 8.1.6b, 8.1.7: the record-picker "View record" link under the select). Fixed with the `.fr-recordpick` rule; those 5 pages were re-run at all five viewports: 0 failures. The other 127 pages were not re-run after that CSS-only, `.fr-recordpick`-scoped change.

Caveat: forms were tested empty (no job data offline), so rows with a populated record picker / long values were not exercised.

## 5. Checks not fully done

- **Print:** `@media print` untouched and PDFs generate for REC 7.2.3, 7.1.2, 7.2.12, but no pre-change print baseline was captured, so "unchanged" is by construction, not by pixel diff.
- **Out-of-scope pages** (home, dashboard, record list, job status): screenshots taken after the change and look normal; no before screenshots to diff.
- **Passkey end-to-end** tested with the verify endpoint mocked (accept path, status text, verified styling, no row movement). Wrong-passkey rejection and the real endpoint were not exercised; that code was not edited.
- Real devices not used — desktop Chrome with touch emulation only.

## 6. Follow-up 2026-10-06 — §1A (Lenovo Tab M8 TB300XU)

- `record-theme.css`: the 2-column band is now `(max-width:1099px), (pointer:coarse) and (min-width:700px)`, so a touch device never gets the 4-column PC grid even if landscape reports ≥1100 CSS px (roster 4). Under 700px still 1 column. Mouse/PC unchanged (4 / 2 / 1 by width).
- `signoff-block.js`: passkey input gets `inputmode="none"` so Android Chrome never raises the soft keyboard over the number pad.
- Versions: `record-theme.css?v=tv47`, `signoff-block.js?v=8` on all pages.
- Checked in the local preview: rule parses, `inputmode` present. The touch case cannot be emulated in that pane.
- **Still to do on the real TB300XU:** read `innerWidth × innerHeight` and `devicePixelRatio` in both orientations, confirm no keyboard appears and the number pad fits in landscape (800 px tall), and do the §7 sign-off on the device.
