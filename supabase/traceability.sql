-- ============================================================================
-- Traceability schema for the Abagold online records system.
--
-- Run this once in the Supabase dashboard (SQL Editor -> New query -> Run),
-- the same way you ran schema.sql.
--
-- WHAT THIS IS
-- Every record body still lives as JSON in kv_store. This adds a thin INDEX on
-- top: one row per (batch number x record x submission) so that, given a batch
-- number, you can trace forwards and backwards across every record that touched
-- it -- intake, processing, canning/drying, packing, dispatch, quality.
--
-- Records opt in by declaring `batchField` (and optional `stage`) in their config;
-- the shared engines then write a batch_link row here on every save. Records that
-- do not declare a batch field simply do not appear -- no false links from the
-- ~40 differently-named ingredient/clothing "batch" fields.
-- ============================================================================

create table if not exists public.batch_link (
  id            bigint generated always as identity primary key,
  batch_no      text not null,          -- the product batch / lot being traced
  record_key    text not null,          -- which record type (config.recordKey)
  record_title  text,                   -- human label for display
  submission_id text not null,          -- the specific submission within that record
  stage         text,                   -- process stage, for forward/backward ordering
  occurred_on   text,                   -- date from the record (ISO string), for the timeline
  href          text,                   -- link to the record page
  summary       text,                   -- short human summary of the touchpoint
  updated_at    timestamptz not null default now(),
  unique (batch_no, record_key, submission_id)
);

create index if not exists batch_link_batch_no_idx on public.batch_link (batch_no);

-- ----------------------------------------------------------------------------
-- Row Level Security -- same interim open-anon policy as kv_store (no login yet).
-- Tighten to authenticated-by-role when Supabase Auth is added.
-- ----------------------------------------------------------------------------
alter table public.batch_link enable row level security;

drop policy if exists batch_link_anon_read  on public.batch_link;
drop policy if exists batch_link_anon_write on public.batch_link;

create policy batch_link_anon_read
  on public.batch_link
  for select
  to anon
  using (true);

create policy batch_link_anon_write
  on public.batch_link
  for all
  to anon
  using (true)
  with check (true);
