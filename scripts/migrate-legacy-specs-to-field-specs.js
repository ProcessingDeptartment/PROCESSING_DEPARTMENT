/*
 * Copy the limits currently published in the old spec registry into field_specs, so there is one source of limits.
 *
 *   node scripts/migrate-legacy-specs-to-field-specs.js           dry run: prints what would be created, writes nothing
 *   node scripts/migrate-legacy-specs-to-field-specs.js --apply   create the rows (each gets version 1 + a version row)
 *
 * For every monitoring-log record, each entry field with a `specKey` takes the min/max of that spec item from the
 * newest published version (KeyValue `spec_versions_index:<recordKey>-spec` -> `spec_version:<recordKey>-spec:<n>`),
 * falling back to the definition's specFields defaults when nothing was ever published.
 *
 * Behaviour does not change: migrated rows have no red highlight, no bubble, gate "none" and no auto-NC, so the form
 * keeps flagging deviations exactly as before (monitoring-log now reads the limits from the field's spec instead of the
 * registry) and any ncThresholds keep working. Existing field_specs rows are never overwritten. KeyValue is never
 * written. Spec profiles that are not a flat min/max per entry field (double seam, custom entries) are listed as
 * "not migrated" and stay in the old registry. Run the field_specs migrations first. Reads DATABASE_URL from .env.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { assembleRecordConfig } = require('../src/record-def');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  });
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (expected in .env).'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();
const hasLimit = (r) => r && typeof r === 'object' && (r.min != null || r.max != null);
const kv = async (key) => { const r = await prisma.keyValue.findUnique({ where: { key } }); return r ? r.value : null; };
const json = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

async function latestPublished(specKey) {
  const idx = json(await kv('spec_versions_index:' + specKey));
  if (!Array.isArray(idx) || !idx.length) return null;
  const top = idx.slice().sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const full = json(await kv('spec_version:' + specKey + ':' + top.versionNumber));
  // who/why live on both the index entry and the full version; prefer the index entry
  return full ? { data: full, meta: Object.assign({}, full, top) } : null;
}

(async () => {
  try { await prisma.fieldSpec.count(); } catch (e) { console.error('field_specs is not there yet - apply the field_specs migrations first.'); process.exit(1); }
  const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true, engine: true }, orderBy: { recordKey: 'asc' } });
  const plan = [], skipped = [], notMigrated = [];
  for (const d of defs) {
    if (d.engine !== 'monitoring-log') continue;
    const out = await assembleRecordConfig(prisma, d.recordKey);
    const cfg = out && out.config;
    if (!cfg || !Array.isArray(cfg.entryFields)) continue;
    const linked = cfg.entryFields.filter((f) => f.specKey);
    if (!linked.length) continue;
    const pub = await latestPublished(d.recordKey + '-spec');
    const defaults = {};
    (cfg.specFields || []).forEach((f) => { defaults[f.key] = { min: f.min, max: f.max }; });
    const used = new Set();
    for (const f of linked) {
      used.add(f.specKey);
      const range = (pub && hasLimit(pub.data[f.specKey])) ? pub.data[f.specKey] : defaults[f.specKey];
      if (!hasLimit(range)) continue;
      if (await prisma.fieldSpec.findUnique({ where: { recordKey_fieldKey: { recordKey: d.recordKey, fieldKey: f.key } } })) { skipped.push(`${d.recordKey}.${f.key} (already has a field spec)`); continue; }
      plan.push({
        recordKey: d.recordKey, fieldKey: f.key, specKey: f.specKey, min: range.min == null ? null : Number(range.min), max: range.max == null ? null : Number(range.max),
        from: pub ? 'registry v' + pub.meta.versionNumber : 'definition default',
        reason: pub ? `Migrated from spec registry v${pub.meta.versionNumber}: ${pub.meta.changeReason || ''}`.trim() : 'Migrated from the definition default limits',
        by: (pub && pub.meta.publishedBy) || 'System', title: (pub && pub.meta.changedByTitle) || 'System',
      });
    }
    if (pub) Object.keys(pub.data).filter((k) => !['versionNumber', 'changeReason', 'publishedBy', 'changedByTitle', 'publishedAt'].includes(k) && !used.has(k))
      .forEach((k) => notMigrated.push(`${d.recordKey}: spec item "${k}" is not linked to an entry field`));
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} - ${plan.length} field spec(s) to create`);
  plan.forEach((p) => console.log(`  ${p.recordKey}.${p.fieldKey}  [${p.min == null ? '-' : p.min} .. ${p.max == null ? '-' : p.max}]  from ${p.from} (spec item ${p.specKey})`));
  if (skipped.length) { console.log(`\nskipped ${skipped.length}:`); skipped.forEach((s) => console.log('  ' + s)); }
  if (notMigrated.length) { console.log(`\nnot migrated ${notMigrated.length} (stay in the old registry):`); notMigrated.forEach((s) => console.log('  ' + s)); }

  if (APPLY) {
    let n = 0;
    for (const p of plan) {
      await prisma.$transaction(async (tx) => {
        const row = await tx.fieldSpec.create({ data: { recordKey: p.recordKey, fieldKey: p.fieldKey, specMin: p.min, specMax: p.max, versionNumber: 1 } });
        await tx.fieldSpecVersion.create({ data: {
          specId: row.id, recordKey: p.recordKey, fieldKey: p.fieldKey, versionNumber: 1, status: 'PUBLISHED',
          snapshot: { record_key: p.recordKey, field_key: p.fieldKey, spec_min: p.min, spec_max: p.max, gate_mode: 'none', active: true },
          changeReason: p.reason, publishedBy: p.by, changedByTitle: p.title } });
      });
      n++;
    }
    console.log(`\ncreated ${n}. Now run: node scripts/export-record-defs.mjs  and push public/data/record-defs/`);
  } else console.log('\nNothing written. Re-run with --apply to create these.');
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
