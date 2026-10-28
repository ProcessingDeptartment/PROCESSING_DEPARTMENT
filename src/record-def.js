// Assemble a record's definition rows back into the exact config object the page used to pass
// to FormRecord.init / MonitoringLog.init. Keeps the same shape verified by
// scripts/verify-definitions.mjs (rebuild()), so the engine change is just "fetch this instead
// of declaring it inline". See Claude outputs/relational-all-records-plan.md.

function fieldOut(f) {
  const o = { key: f.key, label: f.label, type: f.type };
  if (f.required) o.required = true;
  if (f.readOnly) o.readOnly = true;
  if (f.unit != null) o.unit = f.unit;
  if (Array.isArray(f.options) && f.options.length) o.options = f.options;
  if (f.group != null) o.group = f.group;
  if (f.recordPickSource != null) o.source = f.recordPickSource;
  if (f.computeFn != null) o.computeFn = f.computeFn;
  if (f.computeArgs != null) o.computeArgs = f.computeArgs;
  // linkField / linkRelation are the API's own submission-indexing metadata (read from
  // RecordFieldDef directly) -- not part of the render config, so not emitted here.
  if (f.validateJson != null) o.validate = f.validateJson;
  for (const [k, v] of Object.entries(f.extraJson || {})) o[k] = v;
  return o;
}

// Field specifications (table field_specs, MD/field-specifications-system-instructions.md): attach each active spec to the
// field / roster column with the same key as `field.spec`. Fields with no spec get no key. A missing table (migration
// not yet applied) must not break record rendering, so any query error just means "no specs".
function specOut(r) {
  const n = (v) => (v == null ? null : Number(v));
  return {
    min: n(r.specMin), max: n(r.specMax),
    allowed: r.allowedValues ? r.allowedValues.split(',').map((x) => x.trim()).filter(Boolean) : null,
    highlightRed: r.highlightRed, showWarningBubble: r.showWarningBubble, gateMode: r.gateMode,
    autoNc: r.autoNc, ncCategory: r.ncCategory, ncSeverity: r.ncSeverity, ncOptionalSkip: r.ncOptionalSkip,
    labelOverride: r.labelOverride, version: r.versionNumber,
  };
}
async function attachSpecs(prisma, recordKey, cfg) {
  let rows = [];
  try { rows = await prisma.fieldSpec.findMany({ where: { recordKey, active: true } }); } catch (e) { return; }
  if (!rows.length) return;
  const byKey = new Map(rows.map((r) => [r.fieldKey, specOut(r)]));
  const tag = (list) => (list || []).forEach((f) => { if (f && byKey.has(f.key)) f.spec = byKey.get(f.key); });
  tag(cfg.fields); tag(cfg.entryFields);
  (cfg.sections || []).forEach((sec) => tag(sec.fields));
  if (cfg.roster) tag(cfg.roster.columns);
  (cfg.rosters || []).forEach((r) => tag(r.columns));
}

// prisma: a PrismaClient; recordKey: string. Returns { engine, version, config } or null.
async function assembleRecordConfig(prisma, recordKey) {
  const def = await prisma.recordDefinition.findUnique({
    where: { recordKey },
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields: { orderBy: { position: 'asc' } },
      autofills: true,
    },
  });
  if (!def) return null;

  const cfg = { mount: def.mount, recordKey };
  if (def.docCode != null) cfg.docCode = def.docCode;
  if (def.title != null) cfg.title = def.title;
  if (def.docRevisionStart != null) cfg.docRevisionStart = def.docRevisionStart;
  if (def.jobInfoGroup != null) cfg.jobInfoGroup = def.jobInfoGroup;
  for (const [k, v] of Object.entries(def.extraJson || {})) if (!k.startsWith('__fn_')) cfg[k] = v;

  const bySection = (i, parent) => def.fields
    .filter((f) => f.sectionIndex === i && (f.parentFieldKey ?? null) === parent)
    .map(fieldOut);

  // form-record multi-roster (`rosters: [...]`): roster sections tagged extraJson.rosterKey.
  const isMulti = (s) => s.kind === 'roster' && s.extraJson && s.extraJson.rosterKey != null;
  const multi = def.sections.filter(isMulti);
  if (multi.length) {
    cfg.rosters = multi.map((s) => {
      const { rosterKey, ...rest } = s.extraJson;
      return { key: rosterKey, ...(s.title != null ? { title: s.title } : {}), ...rest,
        columns: def.fields.filter((f) => f.sectionIndex === def.sections.indexOf(s)).map(fieldOut) };
    });
  }
  const rosterSec = def.sections.find((s) => s.kind === 'roster' && !isMulti(s));
  if (rosterSec) {
    const ri = def.sections.indexOf(rosterSec);
    cfg.roster = {
      ...(rosterSec.title != null ? { title: rosterSec.title } : {}),
      ...(rosterSec.extraJson || {}),
      columns: def.fields.filter((f) => f.sectionIndex === ri).map(fieldOut),
    };
  }

  const fieldSecs = def.sections.filter((s) => s.kind === 'fields');
  if (fieldSecs.length) {
    // A field section whose position falls after the roster's renders below the roster
    // table in the engine (afterRoster) -- keeps sign-off at the foot of the record.
    const rosterPos = rosterSec ? rosterSec.position : Infinity;
    cfg.sections = fieldSecs.map((s) => ({
      title: s.title,
      ...(s.extraJson || {}),
      ...(s.position > rosterPos ? { afterRoster: true } : {}),
      fields: bySection(def.sections.indexOf(s), null),
    }));
  }
  const topLevel = def.fields.filter((f) => f.sectionIndex == null && (f.parentFieldKey ?? null) === null).map(fieldOut);
  if (topLevel.length) cfg[def.engine === 'monitoring-log' ? 'entryFields' : 'fields'] = topLevel;

  if (def.autofills.length) {
    cfg.autofill = def.autofills.map((a) => ({
      watch: a.watchKey, source: a.sourceRecordKey, matchField: a.matchField, fill: a.fillMap,
      ...(a.extraJson || {}),
    }));
  }
  if (def.primaryBatchField) cfg.batchField = def.primaryBatchField;
  if (def.extraBatchFields && def.extraBatchFields.length) cfg.extraBatchFields = def.extraBatchFields;
  if (def.clientHook) cfg.clientHook = def.clientHook;

  await attachSpecs(prisma, recordKey, cfg);

  return { engine: def.engine, version: def.version, config: cfg };
}

// Assembles a lightweight summary of every record definition for the cert-analysis agent.
// Returns [{ recordKey, title, docCode, sectionTitles, fieldLabels }].
async function assembleAllRecordSummaries(prisma) {
  const defs = await prisma.recordDefinition.findMany({
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields:   { orderBy: { position: 'asc' } },
    },
  });
  return defs.map((def) => ({
    recordKey:     def.recordKey,
    title:         def.title || def.recordKey,
    docCode:       def.docCode || null,
    sectionTitles: def.sections.filter((s) => s.title).map((s) => s.title),
    fieldLabels:   def.fields.filter((f) => f.label).map((f) => f.label),
  }));
}

module.exports = { assembleRecordConfig, assembleAllRecordSummaries };
