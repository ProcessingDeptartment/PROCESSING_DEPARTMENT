// Project the governance blobs -- specs, verification, verifier assignments, job status -- into
// typed tables. Same idea as submission-store.js: the KeyValue blob is still what the pages read
// and write and remains the source of truth; this is an additive projection so the data can be
// queried and joined (which submissions a verification covered, which spec version was in force).
//
//   spec_profiles_index          -> SpecProfile
//   spec_versions_index:<spec>   -> SpecVersion   (status + audit fields of every version)
//   spec_version:<spec>:<n>      -> SpecVersion   (the version's limits, in `params`)
//   verification_log:<record>    -> VerificationEvent + VerificationEventEntry
//   verifier_assignments         -> VerifierAssignment
//   job_status:<jobNo>           -> JobStatus + JobNrcsAgCode
//
// Replace-on-write for the whole blob, so edits and deletions stay in sync. Never throws on a bad
// value: an unparseable field degrades to null (recoverable from the blob) so one odd value cannot
// fail the projection. The caller wraps this in try/catch too -- a write must never fail here.
//
// syncGovernanceKey(prisma, key, value): value === null means the key was deleted.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v == null || v === '' ? null : String(v));
const num = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};
const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};
// epoch milliseconds (spec publishedAt, verification loggedAt) or an ISO string -> Date
const when = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : v));
  return Number.isNaN(d.getTime()) ? null : d;
};
// 'YYYY-MM-DD' -> Date at UTC midnight, so it does not shift with the server's timezone
const day = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const parse = (value) => { try { return JSON.parse(value); } catch (e) { return undefined; } };

// ---- specs -----------------------------------------------------------------------------------
async function syncProfiles(prisma, value) {
  const list = value == null ? [] : parse(value);
  if (!Array.isArray(list)) return;
  const data = list.filter((p) => p && p.id).map((p, position) => ({ id: String(p.id), name: str(p.name) || String(p.id), position }));
  await prisma.$transaction([
    prisma.specProfile.deleteMany({}),
    ...(data.length ? [prisma.specProfile.createMany({ data })] : []),
  ]);
}

// 'dry-monitoring-spec' governs the record 'dry-monitoring' -- but only say so if that record exists.
async function recordKeyForSpec(prisma, specKey) {
  if (!specKey.endsWith('-spec')) return null;
  const rk = specKey.slice(0, -'-spec'.length);
  const def = await prisma.recordDefinition.findUnique({ where: { recordKey: rk }, select: { recordKey: true } });
  return def ? rk : null;
}

const SPEC_META = ['versionNumber', 'changeReason', 'publishedBy', 'changedByTitle', 'publishedAt'];

function metaOf(v) {
  return {
    changeReason: str(v.changeReason),
    publishedBy: str(v.publishedBy),
    changedByTitle: str(v.changedByTitle),
    publishedAt: when(v.publishedAt),
  };
}

async function syncSpecIndex(prisma, specKey, value) {
  if (value == null) return; // versions are removed by their own keys
  const list = parse(value);
  if (!Array.isArray(list)) return;
  const recordKey = await recordKeyForSpec(prisma, specKey);
  for (const e of list) {
    const versionNumber = int(e && e.versionNumber);
    if (versionNumber == null) continue;
    const status = str(e.status) || 'PUBLISHED';
    await prisma.specVersion.upsert({
      where: { specKey_versionNumber: { specKey, versionNumber } },
      create: { specKey, versionNumber, status, recordKey, ...metaOf(e) },
      update: { status, recordKey, ...metaOf(e) },
    });
  }
}

async function syncSpecVersion(prisma, key, value) {
  const rest = key.slice('spec_version:'.length);
  const cut = rest.lastIndexOf(':');
  if (cut < 0) return;
  const specKey = rest.slice(0, cut);
  const versionNumber = int(rest.slice(cut + 1));
  if (versionNumber == null) return;
  if (value == null) {
    await prisma.specVersion.deleteMany({ where: { specKey, versionNumber } });
    return;
  }
  const v = parse(value);
  if (!isObj(v)) return;
  const params = {};
  for (const [k, val] of Object.entries(v)) if (!SPEC_META.includes(k)) params[k] = val;
  const recordKey = await recordKeyForSpec(prisma, specKey);
  // status is owned by the index; a body seen first defaults to PUBLISHED and the index corrects it.
  await prisma.specVersion.upsert({
    where: { specKey_versionNumber: { specKey, versionNumber } },
    create: { specKey, versionNumber, recordKey, ...metaOf(v), params },
    update: { recordKey, ...metaOf(v), params },
  });
}

// ---- verification ----------------------------------------------------------------------------
async function syncVerificationLog(prisma, recordKey, value) {
  const log = value == null ? [] : parse(value);
  if (!Array.isArray(log)) return;
  const events = log.filter(isObj).map((e, position) => ({
    recordKey,
    position,
    verifiedBy: str(e.verifiedBy),
    verifiedTitle: str(e.verifiedSig),
    verifiedDate: day(e.verifiedDate),
    verifiedSignature: str(e.verifiedSignature),
    loggedAt: when(e.loggedAt),
    entries: { create: (Array.isArray(e.entryIds) ? e.entryIds : []).filter((id) => id != null && id !== '').map((id) => ({ submissionId: String(id) })) },
  }));
  await prisma.$transaction([
    prisma.verificationEvent.deleteMany({ where: { recordKey } }), // entries go with them (cascade)
    ...events.map((data) => prisma.verificationEvent.create({ data })),
  ]);
}

async function syncAssignments(prisma, value) {
  const map = value == null ? {} : parse(value);
  if (!isObj(map)) return;
  const data = [];
  for (const [recordKey, roles] of Object.entries(map)) {
    if (!Array.isArray(roles)) continue;
    roles.forEach((role, position) => { if (role) data.push({ recordKey, role: String(role), position }); });
  }
  await prisma.$transaction([
    prisma.verifierAssignment.deleteMany({}),
    ...(data.length ? [prisma.verifierAssignment.createMany({ data })] : []),
  ]);
}

// ---- job status ------------------------------------------------------------------------------
const JOB_KNOWN = new Set(['job_no', 'status', 'grnNo', 'poNo', 'deliveryNoteNo', 'costPerKg', 'canningEfficiency',
  'additionalNrcsCans', 'nrcsAgCodes', 'nrcsEntries', 'comments', 'closed_at', 'closed_by', 'reopened_at', 'reopened_by',
  'previously_closed_at', 'previously_closed_by', 'note']);

async function syncJobStatus(prisma, jobNo, value) {
  if (value == null) {
    await prisma.jobStatus.deleteMany({ where: { jobNo } }); // AG codes cascade
    return;
  }
  const j = parse(value);
  if (!isObj(j)) return;

  // The page's current shape is nrcsAgCodes[] + one job-level additionalNrcsCans; the legacy shape
  // was nrcsEntries[{ agCode, additionalCans }]. Derive the current shape from the legacy one the
  // same way pages/job-status.html does, so nothing already saved is dropped.
  let agCodes = Array.isArray(j.nrcsAgCodes) ? j.nrcsAgCodes : null;
  let additional = j.additionalNrcsCans;
  if (!agCodes && Array.isArray(j.nrcsEntries)) {
    agCodes = j.nrcsEntries.map((e) => e && e.agCode).filter(Boolean);
    if (additional == null) {
      additional = j.nrcsEntries.reduce((a, e) => {
        const n = num(e && e.additionalCans);
        return n == null ? a : (a || 0) + n;
      }, null);
    }
  }
  agCodes = (agCodes || []).map((c) => String(c).trim()).filter(Boolean);

  const extra = {};
  for (const [k, v] of Object.entries(j)) if (!JOB_KNOWN.has(k)) extra[k] = v;

  const row = {
    jobNo,
    status: str(j.status) || 'open',
    grnNo: str(j.grnNo),
    poNo: str(j.poNo),
    deliveryNoteNo: str(j.deliveryNoteNo),
    costPerKg: num(j.costPerKg),
    canningEfficiency: num(j.canningEfficiency),
    additionalNrcsCans: num(additional),
    comments: str(j.comments),
    closedAt: when(j.closed_at),
    closedBy: str(j.closed_by),
    reopenedAt: when(j.reopened_at),
    reopenedBy: str(j.reopened_by),
    previouslyClosedAt: when(j.previously_closed_at),
    previouslyClosedBy: str(j.previously_closed_by),
    note: str(j.note),
    extraJson: Object.keys(extra).length ? extra : undefined,
  };
  await prisma.$transaction([
    prisma.jobStatus.deleteMany({ where: { jobNo } }),
    prisma.jobStatus.create({ data: { ...row, agCodes: { create: agCodes.map((agCode, position) => ({ agCode, position })) } } }),
  ]);
}

// ---- dispatch --------------------------------------------------------------------------------
async function syncGovernanceKey(prisma, key, value) {
  if (key === 'spec_profiles_index') return syncProfiles(prisma, value);
  if (key === 'verifier_assignments') return syncAssignments(prisma, value);
  if (key.startsWith('spec_versions_index:')) return syncSpecIndex(prisma, key.slice('spec_versions_index:'.length), value);
  if (key.startsWith('spec_version:')) return syncSpecVersion(prisma, key, value);
  if (key.startsWith('verification_log:')) return syncVerificationLog(prisma, key.slice('verification_log:'.length), value);
  if (key.startsWith('job_status:')) return syncJobStatus(prisma, key.slice('job_status:'.length), value);
}

const PREFIXES = ['spec_versions_index:', 'spec_version:', 'verification_log:', 'job_status:'];
const EXACT = ['spec_profiles_index', 'verifier_assignments'];
const isGovernanceKey = (key) => EXACT.includes(key) || PREFIXES.some((p) => key.startsWith(p));

module.exports = { syncGovernanceKey, isGovernanceKey };
