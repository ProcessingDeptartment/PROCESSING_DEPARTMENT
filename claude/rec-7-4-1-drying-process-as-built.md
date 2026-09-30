# REC 7.4.1 Drying Process — As Built

Status: built and live (code pushed, database migrated, definition seeded). Date: 2026-09-30.
Replaces the original spec `Claude outputs/drying-process-refinement-instructions.md` where the two differ; every
difference below was a decision by Michaela during the build (2026-09-29).

## 1. How the form is used

The operator opens the record **to complete a steam**. They pick the job number, see where the job is and its
last steam, add the steam(s), answer any open movement question, and submit. Every submission is one **entry**;
all entries for a job number make up that job's drying history. Engine: `form-record` with the `entryLog`
extension (`public/lib/entry-log.js`).

## 2. What is on screen (top to bottom)

1. **Job info** — unchanged (job number, receiving date, farm, processing for, whole weight; read-only from REC 7.1.2).
2. **Job so far** — only:
   - Location: current stage (Loaded / In dry room / In container / In grading room) with its date, plus the dry
     room area from the latest submitted REC 7.4.2 check
   - Trolleys (once set)
   - Last steam (date), Steam number, Steam info (temperature, time, start time)
   - Next steam number
   - "First entry for this job" when there are no earlier entries
3. **Steams** — earlier steams for the job listed read-only, then one card per new steam with only:
   Steaming temperature, Steaming time (minutes), Start time. Temperature and time are copied from the previous
   steam as editable suggestions.
4. **Movements** — slim rows, one per movement (see section 4).
5. Sign-off.

Hidden (stored, not shown): entry date, cooked weight, steam number, steam date, trolley count, movement stamps.

## 3. Rules

**Steam**
- Steam number: automatic, per job, starts at 1, never blank or 0. Not shown on the card.
- Steam date: never typed. The server dates every steam with the day the entry is submitted.
- No steaming once the job is in the grading room (moved earlier, or answered Yes in the same entry):
  "+ Add steam" hides with a note, and the server refuses it.

**No. of trolleys — set once**
- Asked in a **pop-up** the first time "+ Add steam" is pressed on a job that has no count yet. Whole number ≥ 1.
- Never asked again; every later entry carries the same count. It cannot be changed.
- The server refuses steams if no count exists for the job.
- There is **no** trolley loading guide (no kg-per-trolley rule or status).

**Cooked weight**
- Not shown. Copied silently from REC 7.4.0 (sum of `abaloneKg` on submitted Cooking cards; Blanching and drafts
  excluded) and stored with the entry. Never typed or overridden.

**Removed completely:** cook loss %, steam temperature limits, "Done by", "Steams this entry",
"Reason trolley count changed", and the old single-record fields (whole weight, cooking date/weight,
removed from trolleys, de-string, graded date, total drying days, dry weight, estimate yield — kept only as
read-only `…Old` values on migrated entries).

**Soft warnings at submit** (confirm to continue, recorded on the entry as `warningAck` / `warningNote`):
nothing recorded in the entry; a steam missing temperature, time or start time; steaming time outside
20–90 min (**placeholder** range until QC gives the real one).

## 4. Movements

Three movements: Move into drying rooms, Move into dry container, Move into grading room.

- **Open** movement: a Yes/No question (84 × 44 px buttons). Selected Yes = dark grey, No = light grey. No colours.
- **Done** movement: a grey read-only line with its stamped date; cannot be answered again.
- **Blocked** movement: a lighter grey line saying why.
- Dry container and grading room each need the drying rooms first (not each other).
- The grading room is the **final room**: nothing moves into the container after it, and container and grading
  cannot both be Yes in one entry.
- Each open question must be answered before submit. A submitted No stays open for the next entry and can never
  be back-dated; the Yes is stamped with the server date and time of the entry that answers it.
- Only an administrator / QA manager can reverse a wrongly answered Yes (reason + name, logged in
  `dry_process_movement_audit`), via `POST /api/drying-process/reverse-movement`.

## 5. Server rules (`src/drying-process-guard.js`)

Every write to `formrecord:drying-process` passes through the guard before it is stored:
entry date and movement stamps from the server clock; drafts carry no stamp; submitted entries locked (a stale
device cannot change or drop them); one Yes per movement per job; movement order and final-room rules; per-job
steam numbers; steam date = submit day; no steaming in the grading room; no steaming without a trolley count;
trolley count carried from the first entry that set it. A refusal returns 409/422 and the form shows the reason
(`api-backend.js` does not queue refused saves for retry).

Tests: `node scripts/test-drying-process-guard.mjs` (16 passing).

## 6. Database (Neon)

- `sub_drying_process` = one row per entry (`jobNo` is the thread); `sub_drying_process_row` = one row per steam.
- Partial unique indexes: at most one submitted Yes per movement per job.
- Views: `dry_process_entry`, `dry_process_steam`, `v_dry_job_progress` (job-level picture built from all
  entries), `v_dry_yield_by_month`, `v_dry_yield_by_farm` (weighted yield = Σ dried ÷ Σ whole),
  `v_dry_trolley_loading`, `v_dry_steam_profile`, `v_dry_jobs_in_dry_room`, `v_dry_monitoring_trolley_check`.
- Migrations: `20260929170000_drying_process_entries`, `…190000_drop_cook_loss`, `…200000_drop_done_by`,
  `…210000_drop_trolley_reason`. `migrate deploy` needed `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` (pgbouncer
  advisory-lock trap, P1002).

## 7. Where the job-level numbers come from

- Whole weight: REC 7.1.2 receiving. Cooked weight: REC 7.4.0 (copied onto the entry).
- Dried weight, yield, size grades, graded date: REC 7.4.3.1 / 7.4.3.2 (cultivated + ranched added together).
- Drying days = date into grading room − date into dry room (7.4.1 stamps), fallback to the 7.4.3 dates.
- Drying loss % = (cooked − dried) ÷ cooked × 100.

Readers switched to the new entries: `pages/drying-report.html`, the dashboard tiles in `index.html`
(dry yield, steam turns per job), `lib/traced-records.js` (store key `formrecord:drying-process`), and
REC 7.4.2's trolley autofill (`/api/dry-monitoring/job-facts`).

## 8. Scripts

| Script | Purpose |
|---|---|
| `scripts/apply-drying-process-entries.mjs` | Writes the 7.4.1 definition into `data/record-definitions.json` (idempotent) |
| `scripts/snapshot-one-def.mjs drying-process` | Regenerates `public/data/record-defs/drying-process.json` |
| `scripts/seed-definitions-only.mjs drying-process` | Seeds just this record's definition into Neon |
| `scripts/migrate-drying-process-entries.mjs` | Converts old single-record entries (dry run by default; none existed in prod) |
| `scripts/export-dry-process.mjs` | Tables + views to CSV (Excel-friendly) |
| `scripts/test-drying-process-guard.mjs` | Server-rule tests |

After any definition change: apply → snapshot → seed, then push.

## 9. Open

- Real QC range for steaming time (placeholder 20–90 min).
- Correcting a submitted entry (reason + name) — not built; form-record has no such pattern.
- Trace-view line format for 7.4.1 not customised (uses the default entry listing).
- Test entry for job DPR001998 (saved before the server rules, no stamps) is still in production.
