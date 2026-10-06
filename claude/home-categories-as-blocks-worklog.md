# Home categories as blocks — work log (2026-10-06)

## Changed
- `public/index.html`: Categories table → 6 blocks (Handovers, Job Progress report [Job Status + Dashboard buttons], Records, FSMS, Verification Assignments, Logs). CSS only; explicit 3/2/1 columns at ≥900 / 560–899 / <560px. "More" table (Awaiting Verification, Passkeys) below, signed-in only. No script changes.
- `public/pages/fsms.html`: added **Batch Traceability** row just above REC 01 Master Record Index. **Specifications was already listed in FSMS**, so no second entry added.
- `public/lib/nav-menu.js`: removed "Quick Receiving" menu item (§1.2 step 2).
- Moved `public/records/quick-abalone-receiving.html` → `junk/quick-abalone-receiving.html` (git mv). It used only shared scripts (data-store.js, api-backend.js), so nothing else moved.

## Quick Abalone Receiving dependencies
- Data key `quick_abalone_receiving_jobs` is read by no other page, report, trend or traceability view; no record autofills job no./intake date from it. Data untouched.
- Other references left: `scripts/extract-definitions.mjs` (skip-list of non-record pages; harmless), `public/records/_shell-test.html` (test page).

## Batch Traceability / Specifications links elsewhere (unchanged)
- Hamburger menu still has "Traceability". Specifications still linked from FSMS and record pages.

## Notes for Michaela
- Passkeys row ("Administrator only") shows to every signed-in user on home, same as before; the page itself enforces admin.
- Signed out: only Handovers shows — confirmed by Michaela 2026-10-06.
- Login modal (login-ui.js) not touched; check whether it has a user picker.
- Screenshots / TB300XU viewport measurement not done: the in-app browser couldn't open the local file. Need a check on the real tablet after deploy.

## Update 2026-10-06 (Michaela's placement decisions)
- Awaiting Verification: removed from home; now a link card at the top of `pages/submissions-log.html` (the Logs block's page).
- Passkeys: stays in the table below the blocks, now headed **Other**.
