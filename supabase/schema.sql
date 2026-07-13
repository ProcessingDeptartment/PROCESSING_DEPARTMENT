-- ============================================================================
-- Supabase schema for the Abagold online records system.
--
-- Run this once in the Supabase dashboard:
--   Project -> SQL Editor -> New query -> paste this whole file -> Run.
--
-- It creates the single key/value table that public/lib/data-store.js reads and
-- writes. Every online record (monitoring logs, form records, spec versions,
-- document revisions) stores its JSON under a string key here, exactly as it did
-- in localStorage -- Supabase just makes that store shared across every device.
-- ============================================================================

create table if not exists public.kv_store (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- INTERIM POLICY: there is no login system yet, so records use the public "anon"
-- key and this policy allows anyone with that key to read and write. This matches
-- the current open-access model (localStorage had no auth either) and is fine for
-- an internal tool on a private network.
--
-- NEXT STEP toward the vision doc's role-based logins: enable Supabase Auth, then
-- replace the "anon" policies below with authenticated-only ones (e.g.
--   using (auth.role() = 'authenticated')
-- ) and gate writes by role. data-store.js already threads a `shared` flag and can
-- attach an auth session when that lands -- no record file needs to change.
-- ----------------------------------------------------------------------------
alter table public.kv_store enable row level security;

drop policy if exists kv_anon_read  on public.kv_store;
drop policy if exists kv_anon_write on public.kv_store;

create policy kv_anon_read
  on public.kv_store
  for select
  to anon
  using (true);

create policy kv_anon_write
  on public.kv_store
  for all
  to anon
  using (true)
  with check (true);
