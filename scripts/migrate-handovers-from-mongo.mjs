// One-time: fetch all records from the old handover-backend and POST them to the new API.
// Run once after the new routes are deployed.
// Usage:
//   HANDOVER_OLD_URL=https://handover-backend.onrender.com \
//   API_URL=https://processing-department-api.onrender.com \
//   API_KEY=<your-api-key> \
//   node scripts/migrate-handovers-from-mongo.mjs

const OLD_URL = process.env.HANDOVER_OLD_URL || 'https://handover-backend.onrender.com';
const NEW_URL = process.env.API_URL           || 'https://processing-department-api.onrender.com';
const API_KEY = process.env.API_KEY           || '';

async function run() {
  const listRes = await fetch(`${OLD_URL}/api/handovers`);
  if (!listRes.ok) throw new Error(`Failed to list old handovers: ${listRes.status}`);
  const { records } = await listRes.json();
  console.log(`Found ${records.length} records in old backend`);

  let ok = 0, fail = 0;
  for (const summary of records) {
    const detailRes = await fetch(`${OLD_URL}/api/handovers/${encodeURIComponent(summary.id)}`);
    if (!detailRes.ok) {
      console.error(`  SKIP ${summary.id}: detail fetch failed (${detailRes.status})`);
      fail++;
      continue;
    }
    const record = await detailRes.json();

    const postRes = await fetch(`${NEW_URL}/api/handovers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify(record),
    });
    if (!postRes.ok) {
      const err = await postRes.text();
      console.error(`  FAIL ${record.id}: ${postRes.status} ${err}`);
      fail++;
    } else {
      console.log(`  OK  ${record.id}`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} migrated, ${fail} failed.`);
}

run().catch(err => { console.error(err); process.exit(1); });
