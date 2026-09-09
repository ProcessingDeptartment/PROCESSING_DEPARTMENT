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

  const rosterSec = def.sections.find((s) => s.kind === 'roster');
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
    cfg.sections = fieldSecs.map((s) => ({
      title: s.title,
      ...(s.extraJson || {}),
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

  return { engine: def.engine, version: def.version, config: cfg };
}

module.exports = { assembleRecordConfig };
