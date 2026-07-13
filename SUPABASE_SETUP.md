# Connecting the online records to Supabase

The 131 online records already save through one shared adapter,
[`public/lib/data-store.js`](public/lib/data-store.js). Until now that adapter kept everything in
each browser's `localStorage` (so records did **not** sync between machines). These steps point it at
a Supabase database instead, so every device sees the same records.

You only have to do this **once**. There are a couple of steps I can't do for you — creating the
account and copying the secret keys — so those are called out below.

---

## 1. Create a Supabase project  *(you do this)*

1. Go to <https://supabase.com> and sign up / log in.
2. Click **New project**. Give it a name (e.g. `abagold-records`), pick a strong database password
   (save it in your password manager), and choose the region closest to the facility.
3. Wait ~2 minutes for it to provision.

## 2. Create the table

1. In the project, open **SQL Editor → New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy the whole file, paste it in.
3. Click **Run**. You should see "Success". This creates the `kv_store` table the records use.

## 3. Copy your project URL and anon key  *(you do this)*

1. Open **Project Settings → API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon / public** key (a long `eyJ...` string).

> The anon key is *meant* to be public and shipped in the page's JavaScript — that's normal for
> Supabase. Access is controlled by the Row Level Security rules in `schema.sql`, not by hiding the
> key. Do **not** paste the `service_role` key here — that one is secret.

## 4. Paste them into the adapter

Open [`public/lib/data-store.js`](public/lib/data-store.js) and fill in the two constants near the top:

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';   // your Project URL
const SUPABASE_ANON_KEY = 'eyJ...';                    // your anon / public key
```

Save. That's it — the adapter switches from local-only mode to Supabase automatically. Until these are
filled in it stays in local-only mode and prints one console warning, so the site never breaks
mid-setup.

## 5. Check it works

1. Open any record (e.g. `public/records/salting-oosw.html`), fill something in, and save.
2. Open the same record on a **different device or browser** — your saved entry should be there.
3. In the Supabase dashboard, **Table Editor → kv_store** should show rows appearing as you save.

---

## What goes where

| Data | Where it lives | Why |
|------|----------------|-----|
| Record submissions, spec versions, document revisions (`shared: true`) | **Supabase** | Facility-wide, must be the same on every device |
| "Acting as" role selector | **localStorage** (per device) | Set straight in `permission-rules.js`, never touches the adapter — correctly stays local |

## Security note & next step

The current setup uses an open Row Level Security policy: anyone with the anon key can read and write.
That matches how the records worked before (localStorage had no login either) and is fine for an
internal tool on a private network. The next step toward the vision doc's **role-based logins** is to
turn on **Supabase Auth** and tighten the policies in `schema.sql` to authenticated users only — the
adapter already threads a `shared` flag and can carry an auth session when that lands, so no record
file needs to change.

## Optional: the Express/Prisma backend

The `src/` + `prisma/` Express server is a separate, relational layer (for future reporting and batch
traceability). It is **not** required for the records to work with Supabase — the front-end talks to
Supabase directly. If you later want that server, point Prisma at the same Supabase Postgres by setting
in `.env`:

```
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://postgres:[YOUR-DB-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres"
```

(the connection string is under **Project Settings → Database**), then run `npx prisma migrate dev`.
