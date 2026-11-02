import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kv = await prisma.keyValue.findUnique({ where: { key: 'formrecord:dry-cooking' } });
  const arr = JSON.parse(kv.value).filter(e => e && e.id);
  const rows = await prisma.$queryRawUnsafe(`SELECT "id", "rawJson", "position" FROM "sub_dry_cooking" ORDER BY "position" ASC NULLS LAST`);

  for (let i = 0; i < rows.length; i++) {
    const tableJson = rows[i].rawJson;
    const blobJson = JSON.stringify(arr[i]);
    if (tableJson !== blobJson) {
      const tableObj = JSON.parse(tableJson);
      const blobObj = JSON.parse(blobJson);
      console.log(`\n--- Entry ${i} id=${rows[i].id} differs ---`);
      const allKeys = new Set([...Object.keys(tableObj), ...Object.keys(blobObj)]);
      for (const k of allKeys) {
        const tv = JSON.stringify(tableObj[k]);
        const bv = JSON.stringify(blobObj[k]);
        if (tv !== bv) console.log(`  ${k}:\n    table: ${tv}\n    blob:  ${bv}`);
      }
    }
  }
  console.log('\nDone.');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
