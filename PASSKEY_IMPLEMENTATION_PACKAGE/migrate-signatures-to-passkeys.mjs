#!/usr/bin/env node

/**
 * Migration: Replace Typed Signatures with Passkey Support
 *
 * This script migrates existing verification_log data from typed signatures
 * to support passkey-based verification. It safely archives old signatures
 * and prepares the system for passkey authentication.
 *
 * Usage:
 *   node scripts/migrate-signatures-to-passkeys.mjs
 *
 * Prerequisites:
 *   - npm install @prisma/client
 *   - prisma/schema.prisma updated with UserPasskey, PasskeyChallenge, PasskeySignature models
 *   - DATABASE_URL env var set
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = `verification_logs_backup_${TIMESTAMP}.json`;

async function main() {
  console.log('🔄 Starting signature migration to passkey support...\n');

  try {
    // Step 1: Backup existing verification logs
    console.log('Step 1: Backing up existing verification logs...');
    const backupData = await backupVerificationLogs();
    console.log(`✓ Backed up ${backupData.recordCount} verification log entries`);
    console.log(`  Location: ${BACKUP_FILE}\n`);

    // Step 2: Check if PasskeySignature table exists
    console.log('Step 2: Checking database schema...');
    const schema = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('UserPasskey', 'PasskeySignature', 'PasskeyChallenge')
    `;

    if (schema.length < 3) {
      console.log('⚠️  Warning: Not all passkey tables exist in database.');
      console.log('  Please run: npx prisma migrate deploy');
      console.log('  Then try this script again.\n');
      process.exit(1);
    }
    console.log('✓ Database schema ready\n');

    // Step 3: Prepare records for passkey support
    console.log('Step 3: Preparing verification data for passkey support...');
    let archiveCount = 0;
    let errorCount = 0;

    // Read verification_log entries from KeyValue store
    const verificationLogs = await getVerificationLogsFromKeyValue();

    for (const [recordKey, entries] of Object.entries(verificationLogs)) {
      try {
        for (const entry of entries) {
          // Archive old typed signature
          await prisma.passkeySignature.create({
            data: {
              recordKey: recordKey,
              verifiedBy: entry.verifiedBy || 'unknown',
              verifiedDate: new Date(entry.verifiedDate || entry.loggedAt),
              credentialId: 'archived_signature', // Placeholder
              signatureMessage: null,
              signatureValue: null,
              authenticatorData: null,
              clientDataJSON: null,
              verified: false,
              verifyError: `Migrated from typed signature: ${entry.verifiedSignature || '(empty)'}`
            }
          });
          archiveCount++;
        }
      } catch (e) {
        console.error(`✗ Error archiving ${recordKey}:`, e.message);
        errorCount++;
      }
    }

    console.log(`✓ Archived ${archiveCount} verification entries`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} entries failed to archive (see above)\n`);
    } else {
      console.log();
    }

    // Step 4: Summary
    console.log('Step 4: Migration summary');
    console.log(`
Migration complete! Your system is now ready for passkey authentication.

Summary:
  • Backed up: ${backupData.recordCount} verification log entries
  • Archived: ${archiveCount} entries in PasskeySignature table
  • Backup file: ${BACKUP_FILE} (kept for reference)
  • Errors: ${errorCount}

Next Steps:
  1. Deploy your app with the updated signoff-block.js and passkey-auth.js
  2. Users will be prompted to register passkeys on their next verification
  3. Old typed signatures remain in logs for audit trail (archived as PasskeySignature)
  4. New verifications will use passkey authentication

Rollback:
  If needed, restore the backup with:
    node scripts/restore-signatures-backup.mjs ${BACKUP_FILE}
    `);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Backup verification logs from KeyValue store
 */
async function backupVerificationLogs() {
  const verificationLogKeys = await prisma.keyValue.findMany({
    where: {
      key: { startsWith: 'verification_log:' }
    }
  });

  const backup = {
    timestamp: new Date().toISOString(),
    records: {}
  };

  let recordCount = 0;
  for (const kv of verificationLogKeys) {
    const recordKey = kv.key.replace('verification_log:', '');
    try {
      backup.records[recordKey] = JSON.parse(kv.value);
      recordCount += JSON.parse(kv.value).length;
    } catch (e) {
      console.warn(`Warning: Could not parse verification log for ${recordKey}`);
    }
  }

  // Write backup to file
  fs.writeFileSync(
    path.join(__dirname, BACKUP_FILE),
    JSON.stringify(backup, null, 2)
  );

  return { recordCount };
}

/**
 * Read verification logs from KeyValue table
 */
async function getVerificationLogsFromKeyValue() {
  const logs = {};
  const records = await prisma.keyValue.findMany({
    where: { key: { startsWith: 'verification_log:' } }
  });

  for (const record of records) {
    const recordKey = record.key.replace('verification_log:', '');
    try {
      logs[recordKey] = JSON.parse(record.value);
    } catch (e) {
      console.warn(`Skipping malformed log: ${record.key}`);
    }
  }

  return logs;
}

// Run migration
main().catch(console.error);
