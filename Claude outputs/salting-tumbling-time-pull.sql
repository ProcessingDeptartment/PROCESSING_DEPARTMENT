-- Pull submitted Salting & Tumbling roster rows with their time-of-day values, most recent first.
SELECT
  p."jobNo",
  p.date,
  r."batchId",
  r."sizeRange",
  r."startTime",
  r."finishTime",
  r."totalTumblingTime",
  p."submittedAt"
FROM "sub_salting_and_tumbling" p
JOIN "sub_salting_and_tumbling_Row" r ON r."parentId" = p.id
ORDER BY p."submittedAt" DESC NULLS LAST
LIMIT 50;
