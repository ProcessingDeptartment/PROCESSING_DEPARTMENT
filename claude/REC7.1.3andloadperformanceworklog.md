# Work log — REC 7.1.3 changes + page load performance

Date: 2026-09-07

## Part 1 — REC 7.1.3 Salting and Tumbling (items 1–3 from the change notes)

Files touched:
- `public/records/REC-7.1.3-salting-and-tumbling.html`
- `public/lib/form-record.js` (shared library)

### 1. Job number now pulls the intake date through
- Added `intakeDate` field (`type: 'date'`) to the **Job info** section — a distinct field, not
  overloading the existing `date` (which means "date of this salting/tumbling entry").
- Added `harvestFarm` field (`type: 'text'`) to the same section (item 2).
- Extended the single `autofill` entry so picking a job number fills, where empty:
  - `intakeDate` ← `receivingDate` (from `abalone-receiving`, REC 7.1.2)
  - `harvestFarm` ← `receivedFrom`
  - `processingFor` ← `toBeProcessedFor` (unchanged)
- Added `intakeDate` to `listColumns` so it shows in the record list:
  `['date', 'jobNo', 'intakeDate', 'processingFor']`

> Note: after this session, the page was further edited (form-record.js bumped to v23) to also
> autofill `jiIntakeWeight` ← `intakeWeight`, add a `summaryField: 'jobNo'` on the section, and a
> page-specific script narrowing the roster size-range picker. Those are not part of this work log.

### 2. "Farm" field in the new entry section
Covered above — `harvestFarm` added and autofilled the same way REC 7.1.5 does it.

### 3. Collapsible "new entry" section (shared library change, opt-in)
`public/lib/form-record.js`:
- **CSS** (after the `.fr-section-title` rule, ~line 108): added `.fr-section-collapsible` rules
  for a `<details>`/`<summary>` section with a rotating ▸/▾ marker. Unicode written as CSS
  escapes (`\25B8` / `\25BE`) because the stylesheet is a JS template string.
- **`openForm()` section render** (~line 1154): sections with `collapsible: true` now render as
  `<details class="fr-section-collapsible" [open]>` + `<summary class="fr-section-title">`.
  `collapsedByDefault: true` makes it start closed; default is open. Non-collapsible sections
  render exactly as before.
- Turned on for REC 7.1.3's **Job info** section only (`collapsible: true`), left open by default
  (the jobsearch field lives inside it, so closed-by-default would add a click before you can
  pick a job).
- Bumped the script tag in the HTML `form-record.js?v=21` → `v22` to bust the cached copy.
  (Other record pages still request v21; the library change is backward-compatible — behaviour
  is gated behind the per-section flag — so they are unaffected.)

Validation note: native `required` inside a closed `<details>` works (browsers auto-expand to
show the message). Worth a quick check if this form's save path uses custom validation rather
than HTML5 `required`.

### 4. Salting batch roster usability
No change — no concrete ask yet. Current 16 roster columns documented in the change notes for
when a specific pain point is identified.

---

## Part 2 — "Pages take over a minute to load"

### Diagnosis
The stall is the **`facility-api` service cold-starting**, not the front-end.

- `render.yaml` runs `facility-api` on Render's **free** plan → spins down after ~15 min idle.
  Cold boot of Node + Prisma + waking Neon Postgres from suspend = 30–60s+, occasionally over
  a minute.
- Measured directly this session: when warm, `/api/health` and the data-read endpoints all
  respond in **~0.35s**. The API is only slow from cold.
- `data-store.js` holds the first read (`whenReady()`, 8s cap) and `api-backend.js` health-checks
  on load, so that cold wake is the first thing every record page waits on.

### Root cause of why it's still happening
There is already a mitigation — `.github/workflows/keep-api-warm.yml`, meant to ping
`/api/health` every 10 min on weekday working hours — **but GitHub is throttling it badly.**
Actual run history from the GitHub API:

| Intended | Actual |
|---|---|
| every ~10 min, 05:00–18:50 SAST Mon–Fri | 2–4 runs per **day**, 4+ hour gaps, some at 21:00+ SAST |

Every run reports success, so nothing looks broken, but the API sleeps through nearly every
idle window. High-frequency `*/10` cron on GitHub's shared runners is heavily deprioritised —
this is a known GitHub limitation, not a bug in the workflow.

### Recommended fixes (in order)
1. **Replace the GitHub pinger with a real uptime monitor** (free): UptimeRobot or cron-job.org,
   5-minute HTTP check on `https://processing-department-api.onrender.com/api/health`
   (no API key needed — `/health` is exempt). These fire on schedule; GitHub Actions does not.
   *Requires dashboard access — not done in this session.*
2. **Upgrade `facility-api` to Render Starter (~$7/mo)** — no spin-down at all, nothing to
   babysit, covers nights/weekends. One dashboard toggle, no code change. This is the proper
   fix for shift-critical infrastructure.
3. **Minor:** `/api/health` (`src/index.js:288`) doesn't touch the DB, so a warm web service can
   still hit a small Neon wake on the first real query. If staying on free tiers, add a trivial
   `SELECT 1` to `/health` so the pinger warms Postgres too.

### Secondary (not the main issue)
`REC-7.1.3-...html` loads 13 non-deferred `<script>` tags — a blocking sequential download
chain, maybe 1–3s on factory wifi. Adding `defer` to all of them (they'd still run in order)
or bundling would help, but it's a rounding error next to the cold start. Not changed.

### No code changes made in Part 2
Diagnosis only. The workflow file was left as-is.
