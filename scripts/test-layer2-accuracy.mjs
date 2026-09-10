#!/usr/bin/env node
// End-to-end accuracy test for Layer 2. Writes test data through the full pipeline
// (validate → KeyValue → syncRecordLinks → syncSubmissionRows), reads back from every
// layer and checks correctness against the real Neon database.
//
// SAFE: backs up and restores any existing data for the keys it touches.
//
// Usage:  node scripts/test-layer2-accuracy.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { validateWrite } = require('../src/validate-submission');
const { syncRecordLinks } = require('../src/record-links');
const { syncSubmissionRows } = require('../src/submission-store');
const { assembleRecordConfig } = require('../src/record-def');

const prisma = new PrismaClient();
const TEST_JOB = 'TEST999999';
let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail ? '— ' + detail : ''); }
};

// Keys we'll write to — backup originals before, restore after
const KEYS = [
  'formrecord:abalone-receiving',
  'monitoring_log:mortalities-log',
  'formrecord:precooking-check-sheet',
];
const backups = {};

async function backup() {
  for (const k of KEYS) {
    const row = await prisma.keyValue.findUnique({ where: { key: k } });
    backups[k] = row ? row.value : null;
  }
  console.log('Backed up', Object.values(backups).filter(v => v !== null).length, 'existing keys\n');
}

async function restore() {
  for (const k of KEYS) {
    if (backups[k] !== null) {
      await prisma.keyValue.upsert({
        where: { key: k },
        create: { key: k, value: backups[k] },
        update: { value: backups[k] },
      });
      // Re-sync submission rows + links from the restored data
      await syncSubmissionRows(prisma, k, backups[k]).catch(() => {});
      await syncRecordLinks(prisma, k, backups[k]).catch(() => {});
    } else {
      await prisma.keyValue.deleteMany({ where: { key: k } });
      // Clean up submission rows
      await syncSubmissionRows(prisma, k, '[]').catch(() => {});
      await syncRecordLinks(prisma, k, '[]').catch(() => {});
    }
  }
  // Clean up test-specific links
  await prisma.recordLink.deleteMany({ where: { linkValue: TEST_JOB } });
  console.log('Restored original data');
}

// ---- Test data ----

const receivingSub = [{
  id: 'test_recv_001', status: 'submitted', submittedAt: Date.now(),
  source: 'manual', createdAt: Date.now(), updatedAt: Date.now(), history: [], signOffs: [],
  values: {
    jobNo: TEST_JOB, receivingDate: '2026-09-10', receivedFrom: 'Bergsig',
    toBeProcessedFor: 'Can', intakeWeight: '150.5', sizeRange: '60-80g',
  },
  roster: [
    { basketNr: '1', wholeWeight: '50.2', farmCount: '120', mortalityCount: '2' },
    { basketNr: '2', wholeWeight: '48.1', farmCount: '115', mortalityCount: '1' },
    { basketNr: '3', wholeWeight: '52.2', farmCount: '130', mortalityCount: '0' },
  ],
}];

// mortalities-log fields: date, mortalitiesKg, totalPack, percent (no jobNo, no linkField)
const mortalitiesSub = [{
  id: 'test_mort_001', status: 'submitted', submittedAt: Date.now(),
  source: 'manual', createdAt: Date.now(), updatedAt: Date.now(), history: [],
  values: {
    date: '2026-09-10', mortalitiesKg: '0.45', totalPack: '500', percent: '0.09',
  },
  inSpec: true,
}];

// precooking fields: jobNumber (linkField), precookingDate, sizeRange, temperature, etc.
const precookingSub = [{
  id: 'test_cook_001', status: 'submitted', submittedAt: Date.now(),
  source: 'manual', createdAt: Date.now(), updatedAt: Date.now(), history: [], signOffs: [],
  values: {
    jobNumber: TEST_JOB, precookingDate: '2026-09-10', sizeRange: '50-100g',
    litresWaterPerCook: '200', temperature: '121', cleanWeight: '45.2', precookWeight: '38.1',
  },
}];

const badSub = [{
  id: 'test_bad_001', status: 'submitted', submittedAt: Date.now(),
  source: 'manual', createdAt: Date.now(), updatedAt: Date.now(), history: [], signOffs: [],
  values: { jobNo: TEST_JOB, receivedFrom: 'INVALID_FARM', toBeProcessedFor: 'Fried' },
  roster: [],
}];

const draftSub = [{
  id: 'test_draft_001', status: 'draft', source: 'manual',
  createdAt: Date.now(), updatedAt: Date.now(), history: [], signOffs: [],
  values: { jobNo: TEST_JOB }, roster: [],
}];

async function main() {
  console.log('=== Layer 2 Accuracy Test ===\n');
  await backup();

  try {
    // ---- Definitions ----
    const recvDef = await assembleRecordConfig(prisma, 'abalone-receiving');
    check('definition: abalone-receiving exists', !!recvDef);
    const mortDef = await assembleRecordConfig(prisma, 'mortalities-log');
    check('definition: mortalities-log exists', !!mortDef);

    // ---- Validation ----
    console.log('\n--- Validation ---');

    let v = await validateWrite(prisma, 'formrecord:abalone-receiving', JSON.stringify(receivingSub));
    check('valid receiving: ok=true', v.ok === true);
    check('valid receiving: 0 violations', v.violations.length === 0, JSON.stringify(v.violations));

    v = await validateWrite(prisma, 'formrecord:abalone-receiving', JSON.stringify(badSub));
    check('bad data: ok=true (report-only)', v.ok === true);
    check('bad data: has violations', v.violations.length > 0, 'got ' + v.violations.length);
    check('bad data: flags INVALID_FARM', v.violations.some(x => /INVALID_FARM|not one of/.test(x)),
      v.violations.join('; '));
    check('bad data: flags Fried', v.violations.some(x => /Fried|not one of/.test(x)),
      v.violations.join('; '));

    v = await validateWrite(prisma, 'formrecord:abalone-receiving', JSON.stringify(draftSub));
    check('draft: 0 violations', v.violations.length === 0);

    v = await validateWrite(prisma, 'formrecord:precooking-check-sheet', JSON.stringify(precookingSub));
    check('precooking: 0 violations', v.violations.length === 0, JSON.stringify(v.violations));

    // ---- Submission tables ----
    console.log('\n--- Submission Tables ---');

    // Write receiving
    const recvKey = KEYS[0];
    const recvJson = JSON.stringify(receivingSub);
    await prisma.keyValue.upsert({ where: { key: recvKey }, create: { key: recvKey, value: recvJson }, update: { value: recvJson } });
    await syncSubmissionRows(prisma, recvKey, recvJson);

    const recvRows = await prisma.$queryRawUnsafe('SELECT * FROM "sub_abalone_receiving" WHERE "id" = $1', 'test_recv_001');
    check('sub_abalone_receiving: 1 row', recvRows.length === 1);
    if (recvRows.length) {
      const r = recvRows[0];
      check('  jobNo = TEST999999', r.jobNo === TEST_JOB, 'got ' + r.jobNo);
      check('  receivingDate = 2026-09-10', r.receivingDate === '2026-09-10');
      check('  receivedFrom = Bergsig', r.receivedFrom === 'Bergsig');
      check('  toBeProcessedFor = Can', r.toBeProcessedFor === 'Can');
      check('  intakeWeight = 150.5', r.intakeWeight === '150.5');
      check('  status = submitted', r.status === 'submitted');
      check('  rawJson present', !!r.rawJson);
    }

    // Roster child rows
    const roster = await prisma.$queryRawUnsafe(
      'SELECT * FROM "sub_abalone_receiving_row" WHERE "parentId" = $1 ORDER BY "position"', 'test_recv_001');
    check('roster: 3 rows', roster.length === 3, 'got ' + roster.length);
    if (roster.length === 3) {
      check('  row[0] basketNr=1, wholeWeight=50.2', roster[0].basketNr === '1' && roster[0].wholeWeight === '50.2');
      check('  row[1] farmCount=115', roster[1].farmCount === '115');
      check('  row[2] mortalityCount=0', roster[2].mortalityCount === '0');
      check('  row[2] position=2', roster[2].position === 2, 'got ' + roster[2].position);
    }

    // Write mortalities
    const mortKey = KEYS[1];
    const mortJson = JSON.stringify(mortalitiesSub);
    await prisma.keyValue.upsert({ where: { key: mortKey }, create: { key: mortKey, value: mortJson }, update: { value: mortJson } });
    await syncSubmissionRows(prisma, mortKey, mortJson);

    const mortRows = await prisma.$queryRawUnsafe('SELECT * FROM "sub_mortalities_log" WHERE "id" = $1', 'test_mort_001');
    check('sub_mortalities_log: 1 row', mortRows.length === 1);
    if (mortRows.length) {
      check('  date = 2026-09-10', mortRows[0].date === '2026-09-10');
      check('  mortalitiesKg = 0.45', mortRows[0].mortalitiesKg === '0.45');
      check('  inSpec = true', mortRows[0].inSpec === true, 'got ' + mortRows[0].inSpec);
    }

    // Write precooking
    const cookKey = KEYS[2];
    const cookJson = JSON.stringify(precookingSub);
    await prisma.keyValue.upsert({ where: { key: cookKey }, create: { key: cookKey, value: cookJson }, update: { value: cookJson } });
    await syncSubmissionRows(prisma, cookKey, cookJson);

    const cookRows = await prisma.$queryRawUnsafe('SELECT * FROM "sub_precooking_check_sheet" WHERE "id" = $1', 'test_cook_001');
    check('sub_precooking_check_sheet: 1 row', cookRows.length === 1);
    if (cookRows.length) {
      check('  temperature = 121', cookRows[0].temperature === '121');
      check('  jobNumber = TEST999999', cookRows[0].jobNumber === TEST_JOB);
      check('  cleanWeight = 45.2', cookRows[0].cleanWeight === '45.2');
    }

    // ---- RecordLink ----
    console.log('\n--- RecordLink ---');

    await syncRecordLinks(prisma, recvKey, recvJson);
    await syncRecordLinks(prisma, mortKey, mortJson);
    await syncRecordLinks(prisma, cookKey, cookJson);

    const links = await prisma.recordLink.findMany({ where: { linkValue: TEST_JOB } });
    // abalone-receiving has linkField jobNo, precooking has linkField jobNumber.
    // mortalities-log has NO linkField — so only 2 records produce links.
    check('RecordLink: rows for TEST999999 exist', links.length >= 2, 'got ' + links.length);

    const byRecord = {};
    for (const l of links) byRecord[l.recordName] = l;
    check('  abalone-receiving present', !!byRecord['abalone-receiving']);
    check('  precooking-check-sheet present', !!byRecord['precooking-check-sheet']);
    check('  mortalities-log absent (no linkField)', !byRecord['mortalities-log']);

    if (byRecord['abalone-receiving']) {
      check('  recv linkField = jobNo', byRecord['abalone-receiving'].linkField === 'jobNo');
      check('  recv relation = self', byRecord['abalone-receiving'].relation === 'self');
    }
    if (byRecord['precooking-check-sheet']) {
      check('  cook linkField = jobNumber', byRecord['precooking-check-sheet'].linkField === 'jobNumber');
    }

    // ---- Idempotency ----
    console.log('\n--- Idempotency ---');

    await syncSubmissionRows(prisma, recvKey, recvJson);
    const cnt1 = await prisma.$queryRawUnsafe('SELECT count(*)::int as c FROM "sub_abalone_receiving"');
    check('re-sync: still 1 parent row', cnt1[0].c === 1, 'got ' + cnt1[0].c);
    const cnt2 = await prisma.$queryRawUnsafe('SELECT count(*)::int as c FROM "sub_abalone_receiving_row"');
    check('re-sync: still 3 roster rows', cnt2[0].c === 3, 'got ' + cnt2[0].c);

    // ---- Multi-entry ----
    console.log('\n--- Multi-entry ---');

    const twoEntries = [receivingSub[0], {
      ...receivingSub[0], id: 'test_recv_002',
      values: { ...receivingSub[0].values, receivingDate: '2026-09-11', sizeRange: '80-100g' },
      roster: [{ basketNr: '1', wholeWeight: '60', farmCount: '100', mortalityCount: '0' }],
    }];
    const twoJson = JSON.stringify(twoEntries);
    await prisma.keyValue.upsert({ where: { key: recvKey }, create: { key: recvKey, value: twoJson }, update: { value: twoJson } });
    await syncSubmissionRows(prisma, recvKey, twoJson);

    const mc1 = await prisma.$queryRawUnsafe('SELECT count(*)::int as c FROM "sub_abalone_receiving"');
    check('multi: 2 parent rows', mc1[0].c === 2, 'got ' + mc1[0].c);
    const mc2 = await prisma.$queryRawUnsafe('SELECT count(*)::int as c FROM "sub_abalone_receiving_row"');
    check('multi: 4 roster rows (3+1)', mc2[0].c === 4, 'got ' + mc2[0].c);

    // Verify second entry's data
    const r2 = await prisma.$queryRawUnsafe('SELECT * FROM "sub_abalone_receiving" WHERE "id" = $1', 'test_recv_002');
    check('multi: entry 2 receivingDate = 2026-09-11', r2.length && r2[0].receivingDate === '2026-09-11');

    // ---- Cross-check: rawJson round-trip ----
    console.log('\n--- rawJson Round-Trip ---');
    if (recvRows.length) {
      const parsed = JSON.parse(recvRows[0].rawJson);
      check('rawJson: id matches', parsed.id === 'test_recv_001');
      check('rawJson: values.jobNo matches', parsed.values.jobNo === TEST_JOB);
      check('rawJson: roster length = 3', parsed.roster && parsed.roster.length === 3);
    }

  } finally {
    console.log('\n--- Cleanup ---');
    await restore();
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
