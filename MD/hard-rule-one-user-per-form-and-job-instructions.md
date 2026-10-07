# HARD RULE: no two people on the same form with the same job number at the same time (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "hard rule. no two people can be using the same form with the same job number at the same time."
**Type:** a system-wide **record lock**, enforced by the server and the database, not only by the page. It applies to every record that has a job number. No change to fields, calculations, saved values, CSV or print output.
**No coding was done in writing this; this file is the brief.**
**Related:** `rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` (section 4.9 drafts: "two people must not enter the same stage at once" is replaced by this rule), `rec-7.4.10-crate-number-automatic-instructions.md` (numbering safety stays as a second layer), `post-submit-complete-another-page-prompt-instructions.md` (release and re-acquire on "another page"), `record-sections-collapse-and-job-autofocus-instructions.md` (job picker), `repo/TRACEABILITY.md`.

## 1. The rule

A **lock key** is the pair **(record, job number)**, for example (REC 7.4.0, `3DP01156`). At any moment **at most one person may hold the lock for a key**. While it is held, nobody else can open that record for that job to enter, edit, save a draft, or submit.

- Different records on the same job are independent: REC 7.4.0 and REC 7.4.1 for `3DP01156` can be open at once by two people.
- The same record on different jobs is independent.
- **Viewing is always allowed** (read-only submitted entries, reports, the trace page, print). The lock only blocks entering and editing.

## 2. When the lock is taken and released

**Taken** the moment the job number is confirmed on the form (Confirm in the job picker), for a new entry, an opened draft, or an edit of a saved entry. Not taken just by opening the record page, because no job is chosen yet.

**Released** when any of these happens:

1. The entry is **submitted** successfully.
2. The user leaves with **Discard / Clear / Cancel**, or changes the job number on the form (old key released, new key requested).
3. The user **saves a draft and leaves** the form (navigates away, closes the record, goes to the Records list, logs out). A saved draft does **not** keep the job locked; the next person may start it (they see the draft warning as in 7.4.6 section 4.9, then take the lock).
4. The user **logs out or the session expires**.
5. The **lease runs out** (section 4), for example a tablet that died or lost signal.
6. An **administrator releases it** (section 6).

Choosing "Yes, another page" in the post-submit pop-up releases the old key at submit and takes a new one when the next job is confirmed.

## 3. What the user sees

- **Job picker:** a job whose lock for this record is held by someone else shows an "In use" badge with the person's name and the time ("In use by Anna, since 10:42"), is not selectable, and cannot be typed in. Reuse the job picker list; no new page.
- **If the user still reaches it** (typed number, stale list, direct link, another tab): a blocking message, in plain words: "REC 7.4.0 for job 3DP01156 is being used by Anna (since 10:42). Only one person can use a form for the same job at a time. Try again when Anna has submitted or left the form, or ask an administrator to release it." Buttons: **View (read-only)**, **Choose another job**, **Try again**. No "open anyway".
- **The holder** sees nothing extra while working. If their lock is lost (lease expired, admin release), they see an immediate, non-dismissible banner "This form was released and may be in use by someone else. Your entry is kept on this device. Copy or save a draft, then reopen the job." The page switches to read-only so a second save cannot happen. Nothing typed is thrown away on the device.
- Mobile and tablet layout: badge and message readable, 44px buttons, no horizontal scroll.

## 4. How it works (server first, the page only reflects it)

**Table `record_lock`** (plain SQL, no vendor features, moves out of Neon unchanged):

| Column | Type | Notes |
|---|---|---|
| record_key | text | for example `dry-cooking` |
| job_no | text | normalised (trim, upper-case) |
| lock_token | uuid | issued to the holder, secret to that browser |
| held_by | text | username from the signed-in user |
| held_by_name | text | for the message |
| device_id | text | browser/tablet identifier |
| draft_submission_id | FK, nullable | the draft or entry being worked on |
| acquired_at | timestamptz | |
| last_heartbeat_at | timestamptz | |
| expires_at | timestamptz | `last_heartbeat_at` + lease |

**Primary key / UNIQUE `(record_key, job_no)`.** The database itself must refuse a second row for the same key, so the rule holds even if the page is bypassed.

**Acquire** (one atomic statement, never a read followed by a write): insert the row; if the key already exists and `expires_at` is in the past, take it over in the same statement (`INSERT ... ON CONFLICT (record_key, job_no) DO UPDATE ... WHERE record_lock.expires_at < now()`); if the existing lock is live and held by someone else, the statement changes nothing and the API answers 409 with the holder's name and `acquired_at`. The API returns the `lock_token` on success.

**Heartbeat:** the page calls the API every 30 seconds while the form is open and visible, extending the lease. Defaults (settings in the record definition or a config table, changeable without a release): **lease 3 minutes**. A tablet that sleeps or loses signal loses the lock after the lease; coming back it tries to re-acquire, and succeeds only if nobody else took it.

**Every write checks the lock on the server.** Save draft, autosave, Submit and edit-save must carry the `lock_token`. The API rejects (409) any write where the caller does not hold a live lock on that (record, job), whatever the page says. An old cached page cannot bypass it. Submit and lock release happen in **one transaction**, so no gap exists in which someone else can start between "submitted" and "released".

**Same person, two devices:** treated as a different holder (different `device_id`). The second device is blocked with "You already have this form open on another device". Michaela's default: no silent take-over. See open question 3.

**Release endpoint** is called on submit, discard, leave and logout; the page also sends it on `pagehide` with `sendBeacon` as a best effort. The lease is the safety net when that fails.

**Audit:** table `record_lock_log` (record_key, job_no, event [`acquired` / `refused` / `released` / `expired` / `taken_over` / `admin_released`], user, device, time, and for admin release the reason). Every refusal is logged, so how often people collide, and who was blocked, can be reported. View `v_record_lock_current` lists who holds what right now, for the admin.

## 4a. Scope notes for records that do not fit the pair neatly

Claude Code must check each case below and report before applying; do not guess.

1. **Records with no job number field** (for example monitoring logs without a job, daily logs): the rule needs a job number, so these are **not locked by this rule**. List them in the work log so Michaela can decide whether another key applies (see open question 1).
2. **REC 7.4.5 Closed Box Inspection** has no job selector (box list). Lock by **box code** for each box a person starts, or lock the whole record while a draft is open. Default: lock each listed box by `(dry-closed-box-inspection, box_code)`; a box someone else is inspecting shows "In use by Anna". Report before building.
3. **REC 7.4.6 progressive stages:** the lock is on (REC 7.4.6, job). This replaces the draft-warning "Start new needs a confirm" with a hard block while a live lock exists; the "A draft for this job was started by X" note remains for drafts whose lock has gone.
4. **Roster/card records** (7.4.0 pots, 7.4.10 crates): the lock covers the whole entry. Crate numbers and pot numbers are still assigned by the server in the submit transaction; the lock is the first layer, the unique constraints are the second.
5. **Records where one entry names several jobs** (for example a blended box, a grading log across jobs): lock every job number on the entry; if any one is held by someone else, block. List these records in the work log.
6. **Verification / sign-off actions** on an already submitted entry: not editing a job entry, so they do not take the lock.

## 5. Where it applies

All record pages that take a job number, in both shared engines (`form-record.js`, `monitoring-log.js`) and the custom-body records (for example REC 7.2.12). Implement once as a shared helper (`recordLock.acquire / heartbeat / release` in new `public/lib/record-lock.js`) and call it from the single places where the job is confirmed, the form is left, and submit succeeds. The API side lives in one module with one set of endpoints (`/api/record-lock/acquire`, `/heartbeat`, `/release`, `/status`) plus the write check wired into the existing save and submit handlers.

**Out of scope:** Dashboard, Job Status Updates, Canning Report, Traceability page, login, read-only views, print and exports.

## 6. Administrator release

Michaela and the QA manager roles only (same roles as other admin corrections). A small admin list shows current locks (from `v_record_lock_current`): record, job, holder, since, last heartbeat. **Release** needs a reason, is logged, and the holder immediately gets the banner in section 3. No one else can force-release.

## 7. Existing data and rollout

No existing data changes. Create the two tables with a reviewed SQL file under `scripts/` (backup first, safe to re-run). Because the write check rejects saves without a token, **roll out in this order and bump the `?v=` script strings on every record page** so no page runs old code that never sends a token: (1) tables and API with the write check in **log-only mode** (logs would-be refusals, rejects nothing) for a short trial; (2) page helper on all records; (3) switch the write check to **enforce**. Report the log-only results to Michaela before step 3.

## 8. Test plan

1. User A confirms job `3DP01156` on REC 7.4.0; user B on another tablet opens REC 7.4.0: the job shows "In use by A", cannot be selected or typed; message and View button as described.
2. B opens REC 7.4.1 for the same job: allowed. B opens REC 7.4.0 for a different job: allowed.
3. A submits: lock released in the same transaction; B can now pick the job.
4. A saves a draft and leaves: lock released; B can pick the job and sees the draft warning.
5. A closes the tablet lid for longer than the lease: lock expires; B can take it; when A wakes the banner shows, the page is read-only, A's typed values are still on the device.
6. A's lock is released by an admin: A sees the banner at once and cannot save.
7. **Bypass test:** send a save and a submit straight to the API without a token, and with B's token for A's job: both rejected 409 and logged.
8. **Race test:** A and B press Confirm on the same job within the same second (script two requests): exactly one succeeds, the other gets 409, one `record_lock` row exists.
9. A tries the same job on a second device: blocked with the "already open on another device" message.
10. Heartbeat stops (network off) and returns within the lease: lock kept; after the lease and someone else took it: re-acquire fails, banner shows.
11. Post-submit "Yes, another page": old key released, new job confirmation takes a new lock.
12. REC 7.4.10, 7.4.0, 7.4.6: crate numbers, pot numbers and stages are still assigned correctly; unique constraints still hold; with the lock disabled in a test, the constraints still stop duplicates.
13. Records without a job number open as before and are listed in the work log. Blended / multi-job records block if any job is held.
14. Admin lock list shows live locks; release works only for the admin roles and needs a reason; `record_lock_log` has acquired, refused, released, expired and admin_released rows.
15. Read-only views, print, CSV and the trace page are unaffected and work while a lock is held.
16. Tablet portrait and landscape: badge, message and buttons readable, 44px targets.
17. Enable-in-stages check: log-only mode logs refusals and rejects nothing; enforce mode rejects.

## 9. Open questions for Michaela (Claude Code proceeds with the bracketed default if unanswered)

1. Records with no job number: leave unlocked? [Yes, list them for a decision.]
2. Lease length 3 minutes with a 30 second heartbeat, so a dead tablet frees the job after about 3 minutes. Too short, too long? [3 minutes.]
3. Same person on two devices: block (default) or allow a "take over" that releases the first device? [Block.]
4. Offline: someone starting an entry with no connection cannot get a lock. Block starting a job-numbered entry while offline? [Block with "Connect to start this form"; entries already open keep working until they reconnect, then re-acquire.]
5. Saving a draft and leaving frees the job (default). Should a draft instead keep the job reserved for its owner for a set time, for example until end of shift? [No, frees the job.]
6. Who may release a lock: Michaela and the QA manager only? [Yes.]

## 10. Paste-ready prompt for Claude Code

> Read `claude/hard-rule-one-user-per-form-and-job-instructions.md` and follow it. Hard rule: no two people may use the same form (record) with the same job number at the same time. Build a server-enforced record lock keyed on (record, job number): new `record_lock` table with a UNIQUE `(record_key, job_no)`, atomic acquire (`INSERT ... ON CONFLICT ... DO UPDATE ... WHERE expires_at < now()`), 30 second heartbeat, 3 minute lease, release on submit (same transaction), discard, leave, logout and expiry, an audit `record_lock_log`, and a `lock_token` that every save, autosave and submit must carry so the API rejects any write without a live lock. Add the shared `public/lib/record-lock.js`, hook it in `form-record.js`, `monitoring-log.js` and custom-body records at job confirm, leave and submit success, show "In use by <name>" on the job picker and the blocking message with View (read-only) and Choose another job, and the read-only banner when a lock is lost. Add the admin lock list with reason-logged release. First check each case in section 4a (records without a job number, REC 7.4.5, multi-job records, 7.4.6 stages) and report; do not guess. Roll out log-only first, report the results, then enforce. Do not change fields, validation, calculations, saved values, exports or print. All database changes in a reviewed SQL file under `scripts/` with backup. Bump the `?v=` strings on every record page, run section 8 and write a work log at `claude/record-lock-worklog.md`.
