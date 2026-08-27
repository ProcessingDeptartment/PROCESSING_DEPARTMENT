# Backend integration — the space left for it

**The seam is now connected.** The forms save through one adapter to a live Express + Postgres
API (see *Status* at the bottom). This file describes that seam — the contract every record page
saves through — which was designed so connecting a backend was a small, contained job rather than
a rewrite of 146 pages, and which is equally what lets the backend be re-pointed later without
touching a single record page.

**Still open**: where the app's data comes *from*. The forms have a shared store; they are not yet
fed by, or feeding, any other system. That is the subject of the architecture below.

## The intended architecture — upstream, NOT yet built

```
SYSPRO  ──(feeds out)──>  Microsoft Dataverse  ──(scheduled ETL)──>  this app's PostgreSQL
                                                                              │
                                                                        (read only)
                                                                              │
                                                                      this app's API
                                                                              │
                                                                        the forms
```

And back the other way, for traceability:

```
approved records  ──(scheduled batch, not per-user, not real time)──>  SYSPRO
```

**Why it is shaped this way:** SYSPRO runs on a limited number of concurrent user licences. If
the forms queried SYSPRO directly, every user session would risk consuming a licence seat and
could risk the integrity of live transactional data. So the app never queries SYSPRO directly and
never holds a live connection to it — it reads its own synchronised copy, and writes back only in
scheduled batches over a single controlled connection.

## The seam: one file, four functions

Everything the forms save goes through `window.storage` in
[public/lib/data-store.js](public/lib/data-store.js). No record page talks to storage directly —
all of them only ever call `window.storage`. That is the entire surface to reconnect.

To connect the API, **do not edit `data-store.js` and do not touch any record page.** Fill in
[public/lib/api-backend.js](public/lib/api-backend.js), which already implements this shape:

```js
// public/lib/api-backend.js
window.storage.useBackend({
  name: 'api',
  async get(key)            { /* -> { value: '<string>' } or null */ },
  async set(key, value)     { /* -> true / false */ },
  async remove(key)         { /* -> true / false */ },
  async getByPrefix(prefix) { /* -> { '<key>': '<value string>', ... } */ }
});
```

…then add its `<script>` tag immediately **after** the `data-store.js` tag on the pages that need
it.

### Contract

| Rule | Detail |
|---|---|
| All four are `async` | Callers already `await` everything. |
| `value` is an opaque string | Records `JSON.stringify` themselves. Do not parse or reshape it. |
| `get` returns `{ value }` or `null` | Not a bare string. `null` means "not set". |
| Never throw | Swallow and log; a storage failure must not break a form mid-shift. |
| `getByPrefix` is ONE round trip | The Master Record Index reads ~130 `document_revision:*` keys at once. A loop of `get()` calls will stall the page. |
| Keys are namespaced strings | e.g. `document_revision:double-seam`, `submissions:brine-mixing`, `batch_link:3CP000001:...`. |

### The `shared` flag already routes correctly

Every call takes a `shared` argument, and that routing survives the switch:

- `shared === false` → **always** this device's `localStorage`. Per-device state; never syncs.
- `shared !== false` → the active backend. Facility-wide data: submissions, specs, document
  revisions, batch links.

Records already pass `shared: true` for their real data, so the day a backend is registered that
data starts flowing to it and per-device state correctly stays put.

## What else this touches

- **Traceability** ([public/lib/traceability.js](public/lib/traceability.js)) rides on the same
  adapter — its index is stored as ordinary `batch_link:*` keys. It moves with the backend
  automatically; there is no second connection to wire. If the API can answer batch lookups more
  efficiently with a real relational query, override `window.Traceability.trace` and
  `.knownBatches` after that file loads. Nothing else reads the index directly.
- **Roles** ([public/lib/permission-rules.js](public/lib/permission-rules.js)) are a client-side
  "Acting as" selector written straight to `localStorage`, deliberately bypassing the adapter.
  Real identity arrives with Entra ID login, and that is a separate change from this seam — the
  role names are already in place so it drops into a structure that has meaning.

## Not yet decided

These are open questions from the working scope, listed here so the seam isn't closed around an
assumption:

- ~~Where the app's PostgreSQL is hosted~~ — **answered**: Neon, via `DATABASE_URL` on the
  `facility-api` Render service.
- ~~Offline / poor-connectivity behaviour~~ — **answered**: the write-ahead outbox described under
  *Status*. Queue on failure, drain on reconnect, reads overlay the queue.
- **Which upstream system feeds this one, and how.** The Dataverse path above is unbuilt and
  unowned. A live alternative exists: the Syspro→ERPNext nightly sync
  (`T:\Sales Dept\erp-evaluation`), which becomes the company's system of record on 1 July 2027.
  See `../INTEGRATION/02-FSMS-READINESS.md` for the comparison and recommendation.
- **The write-back leg.** `approved records → SYSPRO` in the diagram above must not be built as
  drawn: Syspro is read-only forever under an owner-mandated rule. Approved records would go to
  ERPNext instead.
- Input-source tagging (typed by a person vs. read from a sensor/device), which affects the value
  shape records save, not this adapter.
- Concurrent-edit / safe-failure behaviour when two people act on the same record.

## Caching gotcha

Static JS in `public/lib/` is cached hard by browsers. When editing a lib file, bump its `?v=N` on
**every** `<script src="../lib/....js?v=N">` tag that loads it, or a stale copy silently breaks the
page — a missing export throws inside an async IIFE with no visible console error. Current
versions: `data-store.js?v=4`, `traceability.js?v=2`, `api-backend.js?v=1`,
`lookups.js?v=1` (45 pages).

## Status: the seam is filled in and the API is live

`api-backend.js` is wired up on all 243 pages that load `data-store.js` (added right after it, per
the contract above) and implements the real Express API in [src/index.js](src/index.js), backed by
Postgres (Neon).

- **Deployed**: `https://processing-department-api.onrender.com` — `/api/health` returns 200.
  `API_BASE` ([public/lib/api-backend.js](public/lib/api-backend.js)) points at it and can be
  overridden per page with `window.FACILITY_API_BASE`.
- **Database**: [prisma/schema.prisma](prisma/schema.prisma) — a generic `KeyValue` table backing
  the storage contract, plus a `SubmissionDateField` table that automatically extracts and
  classifies every date field inside any `formrecord:*` record (see
  [data/date-field-classification.csv](data/date-field-classification.csv), sourced from
  `DATE_FIELDS_ALL_RECORDS.csv`).
- **API**: [src/index.js](src/index.js) — the four contract endpoints
  (`GET/PUT/DELETE /api/storage/key/:key`, `GET /api/storage/prefix/:prefix`), plus
  `GET /api/values/:recordKey/:field` (distinct values seen for a field, most-recent first),
  `GET /api/lookup/:recordKey/:field/:value` (find a submission by field value),
  `GET /api/dates` (query extracted dates by class and range) and `GET /api/health`.
- **Deployment**: [render.yaml](render.yaml) defines two Render services — `facility-site`
  (static, free, no spin-down) and `facility-api` (free-tier Node web service, so it **sleeps
  after 15 min idle** — the first request after a sleep is slow). Two secrets are set in the
  dashboard, never in git: `DATABASE_URL` (Neon) and `API_KEY`. `PORT` is deliberately not set —
  Render assigns it and `src/index.js` reads `process.env.PORT`.

### Access is a per-device shared key

The API requires `Authorization: Bearer <key>`. `/api/health` and CORS preflights are exempt so
uptime probes keep working. If `API_KEY` is unset the API runs **unprotected** and logs a warning
on startup, so enabling it is a one-step dashboard change that never leaves the site broken
between deploys.

A device with no key gets 401 on every call, which otherwise looks exactly like an empty
database — so `api-backend.js` shows a red banner once, linking to
[public/pages/api-key.html](public/pages/api-key.html) where the key is entered once per device.

**What this is and isn't**: a device-level shared secret, not user identity. It stops the API
being read or wiped by anyone with the URL. It does not stop someone who can already use the site
from reading the key out of their own browser. Real per-user auth needs Entra ID; until then
`auth.js` is a client-side shared password and `permission-rules.js` a client-side role picker,
so neither can be enforced server-side. A lock on the front door, not an audit trail.

### Writes queue; they no longer fall back to localStorage

The backend is registered **unconditionally**, including when the API is unreachable. It used to
fall back to `localStorage` on a failed health check, which quietly turned an outage into a
device-local write that reported success and was then stranded on one tablet.

Instead there is a durable outbox (`facility_api_queue`):

- a failed write is queued and replayed on reconnect, with a badge showing the pending count;
- the queue is **collapsed by key, last write wins** — both engines persist the whole submissions
  array on every save, so an older queued write is a strictly older copy of the same array, not a
  missing change. This is also what stops the queue growing unbounded over a long shift;
- **reads overlay the queue**, so a value you saved while offline doesn't vanish from the list
  until it syncs;
- if the device has no durable storage, `enqueue` returns false and the caller reports a real
  failure rather than a false "Draft saved".

The health check now only decides whether to attempt an immediate drain — not whether the backend
is used at all.

This is an outbox, not an offline cache: records saved on *another* device while this one is
offline are still not readable until the connection returns.
