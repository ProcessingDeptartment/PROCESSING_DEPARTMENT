// scripts/seed-passkey-users.mjs
// Run once: node scripts/seed-passkey-users.mjs
// Adds 18 active users with placeholder passkey 0000
// Michaela will edit each user's title + real passkey via admin-passkeys.html

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env optional if DATABASE_URL already set */ }

const prisma = new PrismaClient();
const PLACEHOLDER = '0000';
const SALT_ROUNDS = 10;

const USERS = [
  { username: 'Eugene.Lombaard@abagold.co.za',      displayName: 'Eugene Lombaard' },
  { username: 'franciline@abagold.co.za',            displayName: 'Franciline Gardiner' },
  { username: 'lungisa@abagold.co.za',               displayName: 'Lungisa Ndlovu' },
  { username: 'Luyanda@abagold.co.za',               displayName: 'Luyanda Mthini' },
  { username: 'Michaela@abagold.co.za',              displayName: 'Michaela Cook' },
  { username: 'nandi@abagold.co.za',                 displayName: 'Nandi April' },
  { username: 'Nasiwe.Ndabambi@abagold.co.za',       displayName: 'Nasiwe Ndabambi' },
  { username: 'Ncumisa@abagold.co.za',               displayName: 'Ncumisa Kalase' },
  { username: 'Nicolene.Mylrea@abagold.co.za',       displayName: 'Nicolene Mylrea' },
  { username: 'NobukhosiK@abagold.co.za',            displayName: 'Nobukhosi Kulati' },
  { username: 'nomzamo@abagold.co.za',               displayName: 'Nomzamo Memani' },
  { username: 'Nosiphot@abagold.co.za',              displayName: 'Nosipho Tsonono' },
  { username: 'Ntandazo@abagold.co.za',              displayName: 'Ntandazo Ngwane' },
  { username: 'philasande@abagold.co.za',             displayName: 'Philasande Ntlebi' },
  { username: 'Rowan.Timmer@abagold.co.za',          displayName: 'Rowan Timmer' },
  { username: 'saziso@abagold.co.za',                displayName: 'Saziso Maketa' },
  { username: 'Sonwabile.Mfanyana@abagold.co.za',    displayName: 'Sonwabile Mfanyana' },
  { username: 'Thandolwethu.Ntsethe@abagold.co.za',  displayName: 'Thandolwethu Ntsethe' },
];

async function main() {
  console.log(`Seeding ${USERS.length} users with placeholder passkey "${PLACEHOLDER}"…\n`);
  const hash = await bcrypt.hash(PLACEHOLDER, SALT_ROUNDS);

  let created = 0, skipped = 0, errors = 0;

  for (const user of USERS) {
    try {
      const existing = await prisma.userPasskey.findUnique({
        where: { username: user.username }
      });

      if (existing) {
        console.log(`  SKIP   ${user.displayName} (${user.username}) — already exists`);
        skipped++;
        continue;
      }

      await prisma.userPasskey.create({
        data: {
          username:    user.username,
          displayName: user.displayName,
          passkey:     hash,
          title:       null,
          isActive:    true,
        }
      });
      console.log(`  ADDED  ${user.displayName} (${user.username})`);
      created++;
    } catch (err) {
      console.error(`  ERROR  ${user.username}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Errors  : ${errors}`);
  console.log(`────────────────────────────────────`);
  console.log(`\nNext step: open admin-passkeys.html and use Edit to set each user's title + real passkey.`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
