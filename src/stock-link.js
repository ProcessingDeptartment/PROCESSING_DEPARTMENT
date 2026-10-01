// Populate the stock_link table: one `job -> bin` edge per bin a job's graded stock went into.
// REC 7.4.4 brief (rec-7.4.4-replace-form-with-report-instructions.md) steps 1-2.
//
// Sources, keyed by the formrecord: key they are saved under:
//   grading-production-log-cultivated / -ranched  (REC 7.4.3.1 / 7.4.3.2, "Collection bins" roster)
//   grading-boxing-traceability                   (REC 7.4.4, legacy: free-text "Job numbers in bin")
//
// Box code = bin code (brief 3a), so there is no separate `box` node: a sealed box is a bin edge.
// Like record-links.js this is an indexing step, not a gate. A key holds the WHOLE array of
// entries, so every write deletes this record's edges and re-inserts them: a re-save can never
// duplicate, and a deleted entry loses its edges. The delete + insert run in one transaction.
//
// The column names below mirror the record definitions (roster.fixedGroups of REC 7.4.3.x and the
// binField/binJobsField of REC 7.4.4) and public/lib/traceability.js's client-side bin_link index,
// which this replaces. Update them together if a definition changes.

const JOB_RE = /^(3CP|3DP|CPR|DPR)\d+$/;

const GRADING = {
  'grading-production-log-cultivated': true,
  'grading-production-log-ranched': true,
};
const LEGACY_744 = 'grading-boxing-traceability';

const PREFIX = 'formrecord:';

// Same normalisation on write and on lookup (brief 3a): trim + upper-case.
const norm = (v) => String(v == null ? '' : v).trim().toUpperCase();

function statusOf(entry) {
  return entry.status == null || entry.status === 'submitted' ? 'submitted' : 'draft';
}

function dateOf(v) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

// Pure: entries -> { edges, skipped }. `skipped` lists entries that could not be linked so the
// backfill can show them to a person; nothing is guessed.
function extractEdges(recordKey, entries) {
  const edges = [];
  const skipped = [];
  const isGrading = !!GRADING[recordKey];
  if (!isGrading && recordKey !== LEGACY_744) return { edges, skipped };

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.id) continue;
    const values = entry.values || entry;
    const base = { recordKey, submissionId: String(entry.id), status: statusOf(entry) };
    const job = norm(values.jobNo);

    if (isGrading) {
      if (!JOB_RE.test(job)) {
        skipped.push({ recordKey, submissionId: base.submissionId, reason: job ? 'malformed job no. "' + job + '"' : 'missing job no.' });
        continue;
      }
      const occurredOn = dateOf(values.gradingDate);
      const roster = Array.isArray(entry.roster) ? entry.roster : [];
      roster.forEach((r, i) => {
        if (!r) return;
        const grade = String(r.sizeGrade || '').trim();
        const seq = parseInt(r.binNo, 10);
        if (!grade || isNaN(seq)) return;
        // Every full box took the bin's code at the time and the bin counted on: the row's boxes
        // are codes grade-(seq-n) .. grade-(seq-1). The current bin (grade-seq) is the open one.
        const boxes = String(r.fullBoxWeight || '').split(/[+,;\s]+/).filter(Boolean);
        boxes.forEach((w, k) => {
          const kg = parseFloat(w);
          edges.push({
            ...base, slot: 'r' + i + ':b' + k, fromType: 'job', fromKey: job, toType: 'bin',
            toKey: norm(grade + '-' + (seq - boxes.length + k)),
            weightKg: isNaN(kg) ? null : kg, occurredOn, kind: 'box',
          });
        });
        const finalKg = parseFloat(r.finalBinWeight);
        if (finalKg > 0) {
          // Weight left null: a topped-up bin starts with another job's stock, so this job's share
          // of the open bin is not final - start.
          edges.push({
            ...base, slot: 'r' + i + ':open', fromType: 'job', fromKey: job, toType: 'bin',
            toKey: norm(grade + '-' + seq), weightKg: null, occurredOn, kind: 'open',
          });
        }
      });
    } else {
      const bin = norm(values.binCode);
      if (!bin) continue; // nothing to link; an empty draft is not an error
      const jobs = String(values.jobNumbersInBin || '').split(/[,;\s]+/).map(norm).filter(Boolean);
      if (!jobs.length) {
        skipped.push({ recordKey, submissionId: base.submissionId, reason: 'bin ' + bin + ' has no job numbers' });
        continue;
      }
      const occurredOn = dateOf(values.dateCreated);
      jobs.forEach((j, i) => {
        if (!JOB_RE.test(j)) {
          skipped.push({ recordKey, submissionId: base.submissionId, reason: 'malformed job no. "' + j + '" in bin ' + bin });
          return;
        }
        edges.push({
          ...base, slot: 'job' + i, fromType: 'job', fromKey: j, toType: 'bin', toKey: bin,
          weightKg: null, occurredOn, kind: 'legacy',
        });
      });
    }
  }
  return { edges, skipped };
}

function recordKeyOf(key) {
  if (!key.startsWith(PREFIX)) return null;
  const rk = key.slice(PREFIX.length);
  return GRADING[rk] || rk === LEGACY_744 ? rk : null;
}

async function syncStockLinks(prisma, key, value) {
  const recordKey = recordKeyOf(key);
  if (!recordKey) return null;
  let entries;
  try { entries = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(entries)) return null;

  const { edges, skipped } = extractEdges(recordKey, entries);
  await prisma.$transaction([
    prisma.stockLink.deleteMany({ where: { recordKey } }),
    prisma.stockLink.createMany({ data: edges, skipDuplicates: true }),
  ]);
  return { edges: edges.length, skipped };
}

module.exports = { syncStockLinks, extractEdges, recordKeyOf, norm, JOB_RE };
