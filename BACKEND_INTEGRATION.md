# Backend integration — the space left for it

**Nothing is connected yet, on purpose.** The forms currently save to the browser they are
opened in. Form look, feel and ease-of-input come first; the backend comes after. This file
describes the seam that was left open so connecting it later is a small, contained job rather
than a rewrite of 146 pages.

## The intended architecture

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

- Where the app's PostgreSQL is hosted, and whether the Dataverse→PostgreSQL ETL is built here or
  already exists as a pipeline elsewhere.
- Offline / poor-connectivity behaviour. A queue-and-sync layer belongs **inside** the backend
  implementation above (queue on failure, drain on reconnect) — the seam was kept async precisely
  so this can be added without record pages knowing.
- Input-source tagging (typed by a person vs. read from a sensor/device), which affects the value
  shape records save, not this adapter.
- Concurrent-edit / safe-failure behaviour when two people act on the same record.

## Caching gotcha

Static JS in `public/lib/` is cached hard by browsers. When editing a lib file, bump its `?v=N` on
**every** `<script src="../lib/....js?v=N">` tag that loads it, or a stale copy silently breaks the
page — a missing export throws inside an async IIFE with no visible console error. Current
versions: `data-store.js?v=4`, `traceability.js?v=2`.
