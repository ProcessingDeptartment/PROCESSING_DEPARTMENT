import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';
import { parse } from 'csv-parse/sync';

const EXPORT_DIR = 'T:\\Abagold Processing Facility\\Neon Database Export\\DB EXPORTS';
const CONNECTION = 'postgresql://postgres.gglykcittvmzyhoitmjo:Abagold!2026@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const SKIP_TABLES = new Set(['submission_images', 'sub_dry_monitoring_images']);
const VIEW_TABLES = new Set([
  'v_dry_job_progress','v_dry_job_weights','v_dry_jobs_in_dry_room',
  'v_dry_monitoring_estimate','v_dry_monitoring_flags','v_dry_monitoring_scores',
  'v_dry_monitoring_trolley_check','v_dry_steam_profile','v_dry_stock_balance',
  'v_dry_stock_control_current','v_dry_stock_control_open','v_dry_stock_unsigned',
  'v_dry_transfer_crate_review','v_dry_transfer_crates_by_job','v_dry_trolley_loading',
  'v_dry_yield_by_farm','v_dry_yield_by_month','v_production_handover',
  'dry_process_entry','dry_cooking_pot','dry_process_steam','dried_transfer_crate'
]);

const client = new pg.Client({ connectionString: CONNECTION });

// Cache of column types per table
const colTypeCache = {};

async function getColTypes(tableName) {
  if (colTypeCache[tableName]) return colTypeCache[tableName];
  const res = await client.query(
    `SELECT column_name, udt_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
    [tableName]
  );
  const types = {};
  for (const row of res.rows) types[row.column_name] = { udt: row.udt_name, type: row.data_type };
  colTypeCache[tableName] = types;
  return types;
}

async function getLatestCsv(tableDir) {
  const files = await readdir(tableDir);
  const csvs = files.filter(f => f.endsWith('.csv')).sort();
  return csvs.length ? join(tableDir, csvs[csvs.length - 1]) : null;
}

async function importTable(tableName, csvPath) {
  let content = await readFile(csvPath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const rows = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
  if (rows.length === 0) return { table: tableName, rows: 0, status: 'empty' };

  const colTypes = await getColTypes(tableName);
  const columns = Object.keys(rows[0]).filter(c => colTypes[c]); // only columns that exist in DB

  if (columns.length === 0) return { table: tableName, rows: 0, status: 'no_match' };

  // Build INSERT with explicit casts for json/array columns
  const colNames = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((c, i) => {
    const t = colTypes[c];
    if (t && (t.type === 'ARRAY' || t.udt === '_text' || t.udt === '_int4')) return `$${i + 1}::text[]`;
    if (t && (t.udt === 'json' || t.udt === 'jsonb')) return `$${i + 1}::${t.udt}`;
    return `$${i + 1}`;
  }).join(', ');
  const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  let errorLogged = false;
  for (const row of rows) {
    const values = columns.map(c => {
      const v = row[c];
      if (v === '' || v === 'NULL' || v === null) return null;
      const t = colTypes[c];
      // Convert JSON array notation to Postgres array notation for text[] columns
      if (t && t.type === 'ARRAY') {
        try {
          const arr = JSON.parse(v);
          if (Array.isArray(arr)) return arr; // pg driver handles JS arrays as pg arrays
        } catch {}
        return null;
      }
      return v;
    });
    try {
      await client.query(sql, values);
      inserted++;
    } catch (e) {
      if (!errorLogged) { console.log(`  FIRST ERR: ${e.message}`); errorLogged = true; }
    }
  }
  return { table: tableName, rows: inserted, total: rows.length, status: 'ok' };
}

async function main() {
  await client.connect();
  console.log('Connected to Supabase\n');
  await client.query('SET session_replication_role = replica;');

  const tableDirs = await readdir(EXPORT_DIR);
  const results = [];

  for (const tableName of tableDirs) {
    if (SKIP_TABLES.has(tableName) || VIEW_TABLES.has(tableName)) {
      console.log(`SKIP  ${tableName}`);
      continue;
    }
    const tableDir = join(EXPORT_DIR, tableName);
    const csvPath = await getLatestCsv(tableDir);
    if (!csvPath) { console.log(`NO CSV ${tableName}`); continue; }
    try {
      const result = await importTable(tableName, csvPath);
      console.log(`OK    ${tableName} — ${result.rows}/${result.total ?? '?'} rows`);
      results.push(result);
    } catch (e) {
      console.log(`ERR   ${tableName} — ${e.message}`);
      results.push({ table: tableName, status: 'error', error: e.message });
    }
  }

  await client.query('SET session_replication_role = DEFAULT;');
  await client.end();
  const ok = results.filter(r => r.status === 'ok').length;
  const err = results.filter(r => r.status === 'error').length;
  console.log(`\nDone: ${ok} tables imported, ${err} errors`);
}

main().catch(console.error);
