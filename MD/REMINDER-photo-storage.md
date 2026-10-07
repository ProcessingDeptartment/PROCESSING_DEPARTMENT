# REMINDER — REC 7.4.2 photo storage (to decide)

**Raised:** 2026-10-06

## The problem
Dry Monitoring photos are stored inside the Neon database. The free Neon plan holds 0.5 GB for *everything*, so about 2,000–3,000 photos (150–300 KB each) before it is full.

**Goal:** get photos out of Neon but keep them viewable in the forms — **completely free** (Cloudflare R2 rejected: needs a billing subscription).

## Options
1. **Thumbnail in Neon + full photo on T: (recommended)** — after archiving to T:, the cloud copy is swapped for a ~25 KB thumbnail. Forms show the thumbnail anywhere; full size only on the T: drive. Fits ~20,000 photos. Needs the archive to be run (desktop shortcut or admin "Archive now" button).
2. **Microsoft 365 / SharePoint** — free with our existing licence; full photos stay viewable everywhere. **Needs IT** to register an app in Microsoft Entra (~15 min).
3. **Compress harder** (1024 px) — ~5,000 photos; only delays the problem.

## To do
- [ ] Decide option 1, 2 or 3 (ask IT about option 2 if wanted)
- [ ] Tell Claude which — it builds the rest
- [ ] Optional: ask IT whether the archive agent may run on **DC01** (the file server = domain controller) for the "Archive now" button to work

## Until then
- Photos are safe in Neon.
- Run **Archive Photos Now** (desktop shortcut) now and then for an on-site backup copy in `T:\...\PROCESSING_DEPARTMENT\Images\`.
