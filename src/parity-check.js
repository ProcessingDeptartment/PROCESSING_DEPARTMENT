// Read-only data-integrity check behind the "Check data" button on the API status page (src/status-page.js).
// For every formrecord:* / monitoring_log:* record it compares the saved list (KeyValue) with its sub_* table:
// entry count, exact order (position column) and per-entry content (rawJson). Same checks as
// scripts/audit-submission-parity.mjs. Returns counts and OK/MISMATCH only -- never entry contents.

const LIMIT = 5 * 1024 * 1024;   // the express.json request-body limit the saved list used to be sent under

async function runParity(prisma) {
  const out = [];
  for (const prefix of ['formrecord:', 'monitoring_log:']) {
    const rows = await prisma.keyValue.findMany({ where: { key: { startsWith: prefix } } });
    for (const r of rows) {
      const recordKey = r.key.slice(prefix.length);
      let arr = null;
      try { const a = JSON.parse(r.value); if (Array.isArray(a)) arr = a.filter((e) => e && e.id); } catch (e) { /* unreadable */ }
      if (!arr || !arr.length) continue;   // nothing stored: nothing to compare
      const table = 'sub_' + recordKey.replace(/-/g, '_');
      const row = { record: recordKey, entries: arr.length, tableRows: null, count: '-', order: '-', content: '-', sizeKb: Math.round(Buffer.byteLength(r.value) / 1024), pct: +(Buffer.byteLength(r.value) / LIMIT * 100).toFixed(1), status: 'OK' };
      try {
        const t = await prisma.$queryRawUnsafe(`SELECT "id", "rawJson", "position" FROM "${table}" ORDER BY "position" ASC NULLS LAST`);
        row.tableRows = t.length;
        row.count = t.length === arr.length ? 'OK' : 'DIFF';
        row.order = t.length === arr.length && t.every((x, i) => x.id === arr[i].id && x.position === i) ? 'OK' : 'DIFF';
        row.content = t.length === arr.length && t.every((x, i) => x.rawJson === JSON.stringify(arr[i])) ? 'OK' : 'DIFF';
      } catch (e) {
        row.status = 'NO TABLE'; row.count = row.order = row.content = 'n/a';
      }
      if (row.status === 'OK' && (row.count !== 'OK' || row.order !== 'OK' || row.content !== 'OK')) row.status = 'MISMATCH';
      out.push(row);
    }
  }
  out.sort((a, b) => b.sizeKb - a.sizeKb);
  let history = null;
  try { history = (await prisma.$queryRawUnsafe('SELECT count(*)::int AS n FROM "SubmissionHistory"'))[0].n; } catch (e) { /* table not created */ }
  return { at: new Date(), records: out, ok: out.every((x) => x.status === 'OK'), history };
}

module.exports = { runParity };
