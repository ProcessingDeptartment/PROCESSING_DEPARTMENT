-- Remove the three test REC 7.4.10 (dried-abalone-transfer) entries. Run in the Neon SQL editor.
-- Real entry sub_1790863554534_mn673 (DPR00001) is NOT touched.
--
-- STEP 1: run the PREVIEW block alone first. Expect: 3 entries, 7 crate rows, 3 batch links,
--         2 verification events, 11 date-index rows.
-- STEP 2: run the REMOVE block (everything between BEGIN and COMMIT) in one go.
--         It copies every affected row into bak_removed_20261001_* tables first, so it can be undone.

------------------------------------------------------------------ PREVIEW (read-only)
select 'entries'      what, count(*) n from sub_dried_abalone_transfer where id in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4')
union all select 'crate rows',    count(*) from sub_dried_abalone_transfer_row where "parentId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4')
union all select 'batch links',   count(*) from "KeyValue" where key in (
  'batch_link:3CP22222:dried-abalone-transfer:sub_1790339188073_owh23',
  'batch_link:3DP55555:dried-abalone-transfer:sub_1790072078264_ahfgt',
  'batch_link:DPR001998:dried-abalone-transfer:sub_1790339800051_d4sv4')
union all select 'date-index rows', count(*) from "SubmissionDateField" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4')
union all select 'verif. entries', count(*) from "VerificationEventEntry" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');

------------------------------------------------------------------ REMOVE (run BEGIN..COMMIT together)
BEGIN;

-- 1. Backups
create table bak_removed_20261001_sub     as select * from sub_dried_abalone_transfer     where id in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');
create table bak_removed_20261001_rows    as select * from sub_dried_abalone_transfer_row where "parentId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');
create table bak_removed_20261001_kv      as select * from "KeyValue" where key in (
  'formrecord:dried-abalone-transfer','verification_log:dried-abalone-transfer',
  'batch_link:3CP22222:dried-abalone-transfer:sub_1790339188073_owh23',
  'batch_link:3DP55555:dried-abalone-transfer:sub_1790072078264_ahfgt',
  'batch_link:DPR001998:dried-abalone-transfer:sub_1790339800051_d4sv4');
create table bak_removed_20261001_datefld as select * from "SubmissionDateField" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');
create table bak_removed_20261001_vev     as select * from "VerificationEvent" where id in (select "eventId" from "VerificationEventEntry" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4'));
create table bak_removed_20261001_vee     as select * from "VerificationEventEntry" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');

-- 2. Audit trail (before-values), then change the KeyValue rows
insert into "KeyValueHistory"(key, action, before, after, actor, role, at)
select key, case when key like 'batch_link:%' then 'delete' else 'set' end, value, null, 'cleanup-sql', 'admin', now()
from "KeyValue" where key in (
  'formrecord:dried-abalone-transfer','verification_log:dried-abalone-transfer',
  'batch_link:3CP22222:dried-abalone-transfer:sub_1790339188073_owh23',
  'batch_link:3DP55555:dried-abalone-transfer:sub_1790072078264_ahfgt',
  'batch_link:DPR001998:dried-abalone-transfer:sub_1790339800051_d4sv4');

update "KeyValue" set value = (
  select coalesce(jsonb_agg(e), '[]'::jsonb)::text
  from jsonb_array_elements(value::jsonb) e
  where e->>'id' not in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4')
), "updatedAt" = now()
where key = 'formrecord:dried-abalone-transfer';

update "KeyValue" set value = (
  select coalesce(jsonb_agg(e), '[]'::jsonb)::text
  from jsonb_array_elements(value::jsonb) e
  where exists (select 1 from jsonb_array_elements_text(e->'entryIds') x
                where x not in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4'))
), "updatedAt" = now()
where key = 'verification_log:dried-abalone-transfer';

delete from "KeyValue" where key in (
  'batch_link:3CP22222:dried-abalone-transfer:sub_1790339188073_owh23',
  'batch_link:3DP55555:dried-abalone-transfer:sub_1790072078264_ahfgt',
  'batch_link:DPR001998:dried-abalone-transfer:sub_1790339800051_d4sv4');

-- 3. Relational tables (VerificationEvent cascades to its entries; the entry deletes cascade crate rows)
delete from "VerificationEvent" where id in (select id from bak_removed_20261001_vev);
delete from "SubmissionDateField" where "submissionId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');
delete from sub_dried_abalone_transfer_row where "parentId" in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');
delete from sub_dried_abalone_transfer where id in ('sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4');

-- 4. Check: expect entries 1, crate_rows 2, links 1, store_entries 1
select (select count(*) from sub_dried_abalone_transfer) entries,
       (select count(*) from sub_dried_abalone_transfer_row) crate_rows,
       (select count(*) from "KeyValue" where key like 'batch_link:%:dried-abalone-transfer:%') links,
       (select jsonb_array_length(value::jsonb) from "KeyValue" where key='formrecord:dried-abalone-transfer') store_entries;

COMMIT;   -- if the check above is wrong, run ROLLBACK; instead
