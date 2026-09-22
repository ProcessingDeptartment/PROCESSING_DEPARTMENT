-- Pull submitted Abalone Receiving (REC 7.1.2) roster rows, most recent first.
SELECT
  p."jobNo",
  p."receivingDate",
  p."receivedFrom",
  p."toBeProcessedFor",
  p."intakeWeight",
  r."sizeRange",
  r."basketNr",
  r."wholeWeight",
  r."farmCount",
  r."mortalityCount",
  p."submittedAt"
FROM "sub_abalone_receiving" p
JOIN "sub_abalone_receiving_row" r ON r."parentId" = p.id
ORDER BY p."submittedAt" DESC NULLS LAST
LIMIT 50;
