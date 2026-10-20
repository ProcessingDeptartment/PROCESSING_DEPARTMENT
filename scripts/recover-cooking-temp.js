const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = 'formrecord:dry-cooking';
const JOB = process.argv[2] || 'dpr1192';

// Check the most recent set rows for what changed (before vs after for DPR01192 entries)
prisma.keyValueHistory.findMany({
  where: { key: KEY },
  orderBy: { id: 'desc' },
  take: 5,
}).then(rows => {
  console.log('\n=== LAST 5 history rows (before/after DPR01192 entry counts) ===');
  for (const row of rows) {
    try {
      const before = JSON.parse(row.before || '[]');
      const after  = JSON.parse(row.after  || '[]');
      const bCount = before.filter(e => e && (e.values||{}).jobNo === JOB).length;
      const aCount = after.filter(e => e && (e.values||{}).jobNo === JOB).length;
      console.log('  Row', row.id, 'action:', row.action, 'by:', row.actor, '| DPR01192 entries: before='+bCount+' after='+aCount);
      if (bCount > aCount) {
        const afterIds = new Set(after.filter(Boolean).map(e=>e.id));
        const lost = before.filter(e => e && (e.values||{}).jobNo === JOB && !afterIds.has(e.id));
        console.log('  REMOVED:', lost.map(e => 'id:'+e.id+' cookingDate:'+((e.values||{}).cookingDate||'?')));
        lost.forEach(e => console.log('  FULL:', JSON.stringify(e)));
      }
    } catch(e) { console.log('parse error:', e.message); }
  }
}).catch(e => console.log('error:', e.message));

// Check sub_ tables for DPR01192
prisma.$queryRawUnsafe(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND (table_name ILIKE '%dry_cook%' OR table_name ILIKE '%cook%dry%')
  ORDER BY table_name
`).then(r => {
  const tables = r.map(x => Object.values(x)[0]);
  console.log('Dry-cooking sub tables:', tables);
  return Promise.all(tables.map(t =>
    prisma.$queryRawUnsafe(`SELECT * FROM "${t}" WHERE "jobNo" = $1 OR "job_no" = $1`, JOB)
      .then(rows => { console.log(t, 'rows for', JOB + ':', rows.length); rows.forEach(r => console.log('  ', JSON.stringify(r))); })
      .catch(e => console.log(t, 'error:', e.message))
  ));
}).catch(e => console.log('table lookup error:', e.message));

// Check current live data
prisma.keyValue.findUnique({ where: { key: KEY } }).then(kv => {
  if (!kv) { console.log('No KeyValue row for', KEY); return; }
  const entries = JSON.parse(kv.value || '[]');
  const jobEntries = entries.filter(e => {
    const v = e.values || {};
    const j = (v.jobNo || v.job_no || '').toString().toLowerCase();
    return j === JOB.toLowerCase() || j.includes(JOB.toLowerCase());
  });
  console.log('Current live entries for job', JOB + ':', jobEntries.length);
  jobEntries.forEach(e => console.log('  id:', e.id, 'jobNo:', (e.values||{}).jobNo));

  // Show all unique jobs in the record
  const jobs = [...new Set(entries.map(e => (e.values||{}).jobNo || '?'))];
  console.log('\nAll jobs in dry-cooking record:', jobs.join(', '));
}).catch(console.error);

// Check ALL history rows for this key to find any involving DPR1192
prisma.keyValueHistory.findMany({
  where: { key: KEY },
  orderBy: { id: 'desc' },
  take: 200,
}).then(rows => {
  console.log('\nTotal history rows for', KEY + ':', rows.length);
  for (const row of rows) {
    try {
      const before = JSON.parse(row.before || '[]');
      const after  = JSON.parse(row.after  || '[]');
      const allEntries = [...before, ...after].filter(Boolean);
      const hasJob = allEntries.some(e => {
        const v = e.values || {};
        const j = (v.jobNo || v.job_no || '').toString().toLowerCase();
        return j === JOB.toLowerCase() || j.includes(JOB.toLowerCase());
      });
      if (hasJob) {
        console.log('\n*** History row id:', row.id, 'action:', row.action, 'by:', row.actor);
        const beforeIds = new Set(before.filter(Boolean).map(e=>e.id));
        const afterIds  = new Set(after.filter(Boolean).map(e=>e.id));
        const removed = before.filter(e => e && !afterIds.has(e.id));
        const added   = after.filter(e => e && !beforeIds.has(e.id));
        console.log('  removed:', removed.filter(e => { const v=e.values||{}; const j=(v.jobNo||v.job_no||'').toString().toLowerCase(); return j===JOB.toLowerCase()||j.includes(JOB.toLowerCase()); }).map(e=>JSON.stringify(e)));
        console.log('  added:',   added.filter(e => { const v=e.values||{}; const j=(v.jobNo||v.job_no||'').toString().toLowerCase(); return j===JOB.toLowerCase()||j.includes(JOB.toLowerCase()); }).map(e=>JSON.stringify(e)));
      }
    } catch(_) {}
  }
}).catch(console.error).finally(() => prisma.$disconnect());
