# Record Open — Job Search Gate: work log (2026-10-02)

Brief: "Record Open — Job Search Gate". The two briefs named in the paste (`claude/record-open-job-gate-instructions.md`,
`claude/record-sections-collapse-and-job-autofocus-instructions.md`) are not on disk; I worked from the pasted gate brief plus the
existing code (collapsible sections / auto-focus were already built, form-record v65 / ml v39).

## What changed

| File | Change |
|---|---|
| `public/lib/job-picker.js` (v6 → **v7**) | Gate (`makeGate`), tightened confirm popup, optional Can/Dry filter, same-job skip, change-job warning + refill, split of non-job fields out of Job info (`splitStrays`), `JOB_START_RECORDS` |
| `public/lib/form-record.js` (v70) | `wireJobSearch` passes gate root / recordKey / autofill targets / required fields to the picker; Job info header = job no. only |
| `public/lib/monitoring-log.js` (v43) | `wireJobSearch` → shared `wireJobSelects`; `ctx.wireJobSearch` for custom bodies; Job info header = job no. only |
| `public/records/REC-7.2.12-…html` | custom body: Job no. is now a job-picker select; "Job & equipment info" split into **Job info** (job no.) + **Equipment & production info** (same fields) |
| `public/records/*.html` (132 pages) | `form-record.js?v=70` (81 pages), `monitoring-log.js?v=43` (51 pages) |
| `junk/` | backups: `job-picker.js.bak-2026-10-02`, `REC-7.2.12-….html.bak-2026-10-02` |

No field, field name, validation, calculation, DB call, autofill mapping, CSV or print change.

## Behaviour (as built)

* New entry on a record that has a job picker: only the **Job info** heading + search bar + "← Back to list" are visible. Every other
  section, the collapse-all strip, sign-off, the action row, the tablet section rail and the sticky action bar are hidden **and
  `inert`** (stay in the DOM). A MutationObserver hides anything the engines add later.
* Search is focused and its list opens (type-ahead, ↑/↓/Enter, tap, "No jobs found"). Min height 48 px, 16 px font.
* Picking a job opens the popup: stays until pressed (backdrop click ignored), Esc = *Choose a different job*, Enter = *Confirm*,
  Tab trapped, both buttons 48 px. Cancel clears the pick, refocuses the search with the list open, form stays locked.
* Confirm: set job + existing autofill → popup closes → gate released (150 ms fade, none under reduced-motion) → Job info
  folds to `JOB INFO — <job no.>` → focus to the first empty required field (falls back to first empty field).
* Existing records, restored drafts, submitted views: no gate (the engines only pass a gate root when `!existing`), no popup.
* Records with no job picker (Mortalities, Live Leftovers…) and 7.1.2 (no `jobsearch` field; also listed in `JOB_START_RECORDS`) unchanged.
* Change after confirm: *Change* warns ("Changing the job will replace auto-filled values. Continue?") only if a field that autofill
  writes already holds a value; on Confirm those fields are cleared first so autofill refills them for the new job. Cancel in the
  popup keeps the original job and does not re-lock. Re-picking the same job skips the popup.

## Decisions to review

1. **Can / Dry buttons kept as an optional filter.** The old picker disabled the search until Can or Dry was chosen, which cannot
   "auto drop down". With neither chosen the search covers every job; tapping the active button un-filters. Dry-locked (`route:'Dried'`)
   records are unchanged (no buttons, dry jobs only).
2. **Closed jobs are still offered, tagged "Closed".** The brief says "excluded exactly as the current picker excludes them" — the current
   picker does not exclude them, so nothing changed.
3. **No intake date / AG code in the list.** The job list source (`/api/values/abalone-receiving/jobNo` + `job_status`) carries only job no. and
   status; adding descriptors needs an API change, so search is job no. only.
4. **46 record definitions group editable fields under Job info** (e.g. `date` on 7.1.3, scrubbing checklist QC, the four mock-recall forms,
   NRCS "Batch details", incubator log). Folding would have hidden unfilled inputs, and the old guard simply refused to fold.
   `splitStrays` now moves those fields, untouched, into a following **"Entry details"** section at render time (no definition edits, no reseed).
   If you would rather regroup in the definitions, that is a separate change.
5. **Header = job no. only** (`JOB INFO — 3CP2026-0412`); the previous "· AG · Intake" parts are gone.
6. Audit-log of "job confirmed in popup": skipped (no existing mechanism to hook into).

## Test plan (§9) — what was run

Run in the preview browser against `localhost:3000`. The Render API returns 401 without a login, so the job list was stubbed
in the page (3 jobs, one Closed) and the popup shows "No Abalone Receiving record" (also because of 401). **Autofill itself,
saving/submitting, CSV/print and a real existing-record open were not exercised** — they need the live API.

| # | Result |
|---|---|
| 1 | 7.1.3, 7.1.5, 7.8.1 (monitoring-log), 7.2.12 (custom body), 8.1.7 (mock recall): only search visible, actions hidden. Mortalities Log + 7.1.2: open normally, no gate |
| 2 | List opens on focus/click, filter + closed tag shown. Keyboard/tap selection: tap tested, keyboard code path unchanged |
| 3 | Popup stays on backdrop click; Esc → search refocused, list open, nothing set, still locked |
| 4 | Confirm → job set, 0 gated elements left, Job info folded to `— <job no.>`, other sections open, focus on first empty field (7.1.3 → Date; 7.2.12 → AG Code) |
| 5 | Hidden sections are `display:none` + `inert` (not tabbable) |
| 6 | Change → Cancel at popup keeps job, no re-lock; same-job re-pick skips popup. Overwrite warning/refill: coded, not exercised (no autofill data offline) |
| 7 | Not run live; code path: engines pass no gate root when `existing` |
| 8 | Not run (needs API) — no save code touched |
| 9 | Tablet 768×1024: no horizontal scroll, search 48 px, popup buttons 48 px. Landscape / soft keyboard not tested |
| 10 | All 132 record pages bumped; `job-picker.js?v=7` from both engines |

## Follow-ups noticed
* Preview showed a "1 record is waiting to sync" banner from the browser profile's offline queue — not caused by this work.
