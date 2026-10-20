// Seed ProductData table with initial product variants for REC 7.2.11 canning inspection.
// node scripts/seed-product-data.mjs
// Needs DATABASE_URL in .env. Idempotent (upserts by agCode).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  // Add your actual product variants here — agCode must match what goes on job paperwork.
  // These are placeholder examples: update agCodes, descriptions and specs to match real products.
  { agCode: 'CPR001', productDescription: 'Whole Abalone in Brine', canSize: '400ml', containerType: 'tin', nettWeightMin: 350, drainWeightMin: 200, phMin: 6.5, brixMin: null, saltMin: 1.5 },
  { agCode: 'CPR002', productDescription: 'Whole Abalone in Brine', canSize: '825ml', containerType: 'tin', nettWeightMin: 700, drainWeightMin: 450, phMin: 6.5, brixMin: null, saltMin: 1.5 },
  { agCode: '3CP001', productDescription: 'Minced Abalone in Brine', canSize: '400ml', containerType: 'tin', nettWeightMin: 340, drainWeightMin: 190, phMin: 6.5, brixMin: null, saltMin: 1.5 },
];

let n = 0;
for (const p of products) {
  await prisma.productData.upsert({
    where: { agCode: p.agCode },
    create: p,
    update: p,
  });
  n++;
}
console.log(`seeded ${n} ProductData rows`);
await prisma.$disconnect();
