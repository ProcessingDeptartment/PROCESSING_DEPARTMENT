# Farm Selector Update — Abalone Receiving (REC 7.1.2)

**Date:** 2026-10-09  
**File changed:** `public/data/record-defs/abalone-receiving.json`  
**Field:** `receivedFrom` → "Received from"

---

## What changed

The **"Received from"** dropdown on the Abalone Receiving form was simplified.

| Before | After |
|--------|-------|
| Bergsig | Abagold |
| Sulamanzi | Third Party |
| Seaview | Other |
| Third Party | |
| FACTORY | |

New options: **`Abagold`**, **`Third Party`**, **`Other`**

---

## Why

Individual farm names (Bergsig, Sulamanzi, Seaview) are no longer needed as separate entries. All Abagold-owned farm stock is grouped under **Abagold**. External/contract stock goes under **Third Party**. A catch-all **Other** is retained for edge cases.

---

## Downstream impact

The `receivedFrom` value from Abalone Receiving auto-fills into `jiReceivedFrom` ("Received from (farm)") on:

- **REC 7.1.1** — Basket Removal, Shucking & Gutting (`basket-removal-shucking-gutting.json`)

This field is read-only on downstream forms, so it just displays whatever was entered at receiving. No changes needed to downstream record defs.

---

## Existing data

Records already saved with old values (Bergsig, Sulamanzi, Seaview, FACTORY) will continue to display those stored values — the dropdown change only affects **new entries**. If you need to normalise historical data, update the stored `receivedFrom` values in the database directly via Neon console.

---

## No export script needed

This change was made directly to the static JSON snapshot (`public/data/record-defs/abalone-receiving.json`). No `export-record-defs.mjs` run is required — just commit and push to `main` and Render will deploy within ~30 seconds.

---

## Deploy checklist

- [x] Edit `public/data/record-defs/abalone-receiving.json` — `receivedFrom` options updated  
- [ ] `git add public/data/record-defs/abalone-receiving.json`  
- [ ] `git commit -m "simplify farm selector: Abagold, Third Party, Other"`  
- [ ] `git push origin main`  
- [ ] Verify on live site — open REC 7.1.2, check "Received from" dropdown
