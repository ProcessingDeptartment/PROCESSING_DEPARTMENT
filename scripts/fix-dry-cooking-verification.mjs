// One-shot fix: copies the 'verification' field from the KeyValue blob into the
// sub_dry_cooking rawJson for the two entries that are missing it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kv = await prisma.keyValue.findUnique({ where: { key: 'formrecord:dry-cooking' } });
  const arr = JSON.parse(kv.value).filter(e => e && e.id);
  const rows = await prisma.$queryRawUnsafe(`SELECT "id", "rawJson", "position" FROM "sub_dry_cooking" ORDER BY "position" ASC NULLS LAST`);

  let fixed = 0;
  for (let i = 0; i < rows.length; i++) {
    const tableObj = JSON.parse(rows[i].rawJson);
    const blobObj = arr[i];
    if (!tableObj.verification && blobObj.verification) {
      const updated = { ...tableObj, verification: blobObj.verification };
      await prisma.$executeRawUnsafe(
        `UPDATE "sub_dry_cooking" SET "rawJson" = $1 WHERE "id" = $2`,
        JSON.stringify(updated), rows[i].id
      );
      console.log(`Fixed entry ${i} id=${rows[i].id}`);
      fixed++;
    }
  }
  console.log(`\n${fixed} row(s) updated.`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
