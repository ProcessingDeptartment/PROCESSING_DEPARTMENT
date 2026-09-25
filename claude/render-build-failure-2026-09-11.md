# Render build failure — 2026-09-11 (resolved, transient)

**Service:** PROCESSING_DEPARTMENT API (`facility-api`, srv-da6n74u1egvs73995kp0)
**Failed deploy:** commit `12b75fd`, 2026-09-11 14:42:36 GMT+2, duration 29.8s
**Retry deploy:** same commit `12b75fd`, manually redeployed 14:45:59 GMT+2 — **succeeded, live**
at 14:46:41 GMT+2 (`dep-dahvg1qfngtc73e80ldg`).

## Root cause (confirmed)
Not a code error. First attempt got through `npm install` and `npx prisma generate` cleanly,
then failed on `npx prisma migrate deploy`:

```
Error: P1002
The database server at `ep-long-pond-aydj6pgg-pooler.c-5.us-east-2.aws.neon.tech:5432` was
reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).
Elapsed: 10000ms.
```

Classic Neon free-tier cold-start: the database compute had suspended from inactivity, and
Prisma's migration lock attempt gave up (10s) before Neon finished waking the endpoint back up.

**Confirmed by the retry:** redeploying the identical commit ~3 minutes later, after the database
had been kept active by browsing the live site, produced `No pending migrations to apply.`
instantly and the build succeeded in 41.3s total. Same commit, same migrations, only difference
was DB wake state — proves this was purely a cold-start timing issue, not a code defect.

## Resolution
Manually triggered "Deploy latest commit" from the Render dashboard for the PROCESSING_DEPARTMENT
API service. Build succeeded, service went live at 14:46:41 GMT+2. Verified afterward: Job Status
Updates page loads correctly, all 3 existing jobs (CPR002045, 3CP0001112, CPR001598) still present
with data intact — no impact from the failed-then-retried deploy.

## Impact
None to end users at any point. Render deploys are sequential — the failed deploy never replaced
the previously-live build (`7a98849`), so the site was continuously available throughout.

## Relevance to the Neon free-tier risk already tracked
This is a concrete, dated instance of the exact risk flagged in `claude/consolidated-plan.md`
Section 1 (Neon free-tier sleep/cold-start behavior). Worth citing here if it recurs — evidence
for prioritizing either a paid Neon tier or making the migration step resilient to cold starts,
rather than treating the risk as hypothetical.

## Follow-up (not urgent after a single occurrence)
If this recurs, consider a build-command change: ping/wake the database (e.g. a trivial query)
before `npx prisma migrate deploy` runs, or wrap the migrate step with a longer timeout/retry.
No action taken on this yet — watch for recurrence first.

## Status
**Resolved.** No code change was needed or made.
