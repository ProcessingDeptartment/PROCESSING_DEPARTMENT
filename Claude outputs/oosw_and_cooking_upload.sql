-- OOSW and cooking weight upload (v2, columns matched to the live schema)
-- Run AFTER abalone_receiving_upload.sql.
--
-- sub_salting_oosw      : parent record per job (jobNo, harvestFarm, processingFor, intakeDate, completedBy)
-- sub_salting_oosw_row  : one row per job. wholeWeight = whole weight kg, weight = OOSW kg
-- sub_dry_cooking       : parent record for 3DP00199 only
-- sub_dry_cooking_row   : abaloneKg = cooking weight kg for 3DP00199 only
-- harvestFarm is copied from the receiving record for the same job (NULL if no receiving record exists).

BEGIN;

-- ===== OOSW records into salting OOSW =====
INSERT INTO sub_salting_oosw (id,status,source,"submittedAt","createdAt","updatedAt","inSpec","jobNo","harvestFarm","processingFor","intakeDate","completedBy") VALUES
('oosw-DPR01184','submitted','bulk-import',now(),now(),now(),true,'DPR01184',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='DPR01184' LIMIT 1),'Dried','2026-09-21','Michaela Cook'),
('oosw-DPR01185','submitted','bulk-import',now(),now(),now(),true,'DPR01185',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='DPR01185' LIMIT 1),'Dried','2026-09-22','Michaela Cook'),
('oosw-DPR01186','submitted','bulk-import',now(),now(),now(),true,'DPR01186',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='DPR01186' LIMIT 1),'Dried','2026-09-29','Michaela Cook'),
('oosw-DPR01188','submitted','bulk-import',now(),now(),now(),true,'DPR01188',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='DPR01188' LIMIT 1),'Dried','2026-10-01','Michaela Cook'),
('oosw-DPR01189','submitted','bulk-import',now(),now(),now(),true,'DPR01189',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='DPR01189' LIMIT 1),'Dried','2026-10-02','Michaela Cook');

INSERT INTO sub_salting_oosw_row ("parentId",position,"sizeRange","wholeWeight",weight) VALUES
('oosw-DPR01184',1,'300-350g',1643.436,463.78),
('oosw-DPR01185',1,'300-350g',1161.55,295.50),
('oosw-DPR01186',1,'350-400g',1502.37,413.60),
('oosw-DPR01188',1,'350-400g',1557.691,417.31),
('oosw-DPR01189',1,'350-400g',1415.640,393.12);

-- ===== 3DP00199: cooking weight only, into dry cooking (no OOSW for this job) =====
INSERT INTO sub_dry_cooking (id,status,source,"submittedAt","createdAt","updatedAt","inSpec","jobNo","harvestFarm","intakeDate","cookingDate","completedBy") VALUES
('dc-3DP00199','submitted','bulk-import',now(),now(),now(),true,'3DP00199',(SELECT "receivedFrom" FROM sub_abalone_receiving WHERE "jobNo"='3DP00199' LIMIT 1),'2026-10-02','2026-10-02','Michaela Cook');

INSERT INTO sub_dry_cooking_row ("parentId",position,"abaloneKg") VALUES
('dc-3DP00199',1,25.72);

COMMIT;
