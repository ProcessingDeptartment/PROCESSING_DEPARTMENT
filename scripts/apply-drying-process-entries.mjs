// REC 7.4.1 Drying Process: one big per-job record -> ENTRY LOG per job (one submission = one entry;
// all entries for a job number add up to the drying history of that job). Spec: "REC 7.4.1 Drying
// Process - Refinement" (2026-09-29). Rewrites the drying-process definition in
// data/record-definitions.json (idempotent) and switches it from the monitoring-log engine to
// form-record, which is what carries sections, rosters and the per-job features.
//
//   node scripts/apply-drying-process-entries.mjs
//   node scripts/snapshot-one-def.mjs drying-process     (offline snapshot)  or export-record-defs.mjs
//   node scripts/seed-definitions.mjs                    (load into Neon - only when the engine ships)
//
// The engine flags used here (movement, serverStamp, jobSoFarPanel, recordSum, jobSequence, hidden,
// legacy/showWhen on fields, copyFromPrevious, changeReasonField) are built in form-record.js in build
// step 4; until then the record is not deployed. Decision: NO trolley loading guide (Michaela, 2026-09-29).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'drying-process');

const fld = (sectionIndex, key, label, type, o = {}) => ({
  key, label, type,
  required: !!o.required, readOnly: !!o.readOnly,
  unit: o.unit || null, options: o.options || null, group: null,
  sectionIndex, parentFieldKey: o.roster ? '@roster' : null, position: 0,
  computeFn: o.computeFn || null, computeArgs: o.computeArgs || null,
  recordPickSource: null, linkField: o.linkField || null, linkRelation: o.linkRelation || null, validateJson: null,
  extraJson: { ...(o.extra || {}) },
});
const col = (sectionIndex, key, label, type, o = {}) => fld(sectionIndex, key, label, type, { ...o, roster: true });

const S_JOB = 0, S_SO_FAR = 1, S_TROLLEY = 2, S_MOVE = 3, S_STEAMS = 4, S_CHECKS = 5, S_OLD = 6;

const fields = [
  // Section 0 - Job info (unchanged: autofill from abalone-receiving, read-only)
  fld(S_JOB, 'jobNo', 'Job number', 'jobsearch', { required: true, linkField: 'jobNo', linkRelation: 'self', extra: { route: 'Dried' } }),
  fld(S_JOB, 'jiReceivingDate', 'Receiving date', 'date', { readOnly: true }),
  fld(S_JOB, 'jiReceivedFrom', 'Received from (farm)', 'text', { readOnly: true }),
  fld(S_JOB, 'jiProcessingFor', 'Processing for', 'text', { readOnly: true }),
  fld(S_JOB, 'jiIntakeWeight', 'Whole weight (kg)', 'text', { readOnly: true }),

  // Section 1 - Job so far (read-only panel, drawn by the engine from the job's earlier entries): no fields.

  // Section 2 - Entry date, cooked weight and trolleys
  fld(S_TROLLEY, 'entryDate', 'Entry date', 'timestamp', { readOnly: true, extra: { serverStamp: true } }),
  fld(S_TROLLEY, 'cookedWeight', 'Cooked weight', 'number', { readOnly: true, unit: 'kg', extra: {
    recordSum: { source: 'dry-cooking', matchField: 'jobNo', rosterCol: 'abaloneKg', filterCol: 'process', filterIn: ['Cooking'],
      idsField: 'cookedWeightSourceIds', note: 'From REC 7.4.0', missing: 'No REC 7.4.0 found for this job' } } }),
  fld(S_TROLLEY, 'cookedWeightSourceIds', 'Cooked weight source entries', 'text', { readOnly: true, extra: { hidden: true } }),
  fld(S_TROLLEY, 'noOfTrolleys', 'No. of trolleys', 'digits', { extra: {
    vital: true, prefillFromJob: { source: 'drying-process', field: 'noOfTrolleys', matchField: 'jobNo' },
    changeReasonField: 'trolleyChangeReason' } }),
  fld(S_TROLLEY, 'trolleyChangeReason', 'Reason trolley count changed', 'text', { extra: { showWhenChanged: 'noOfTrolleys' } }),

  // Section 3 - Movements (Yes/No while open, read-only line once Yes; stamps come from the server)
  fld(S_MOVE, 'movedIntoDryRoom', 'Move into drying rooms', 'yesno', { extra: {
    noNone: true, movement: { key: 'dryRoom', order: 1, question: 'Move into drying rooms?', done: 'Moved into drying rooms', stamp: 'dateIntoDryRoomAt' } } }),
  fld(S_MOVE, 'dateIntoDryRoomAt', 'Date into dry room', 'timestamp', { readOnly: true, extra: { serverStamp: true, hidden: true } }),
  fld(S_MOVE, 'movedIntoDryContainer', 'Move into dry container', 'yesno', { extra: {
    noNone: true, movement: { key: 'dryContainer', order: 2, requires: 'dryRoom', notAfter: ['gradingRoom'], question: 'Move into dry container?', done: 'Moved into dry container', stamp: 'dateIntoDryContainerAt' } } }),
  fld(S_MOVE, 'dateIntoDryContainerAt', 'Date into dry container', 'timestamp', { readOnly: true, extra: { serverStamp: true, hidden: true } }),
  fld(S_MOVE, 'movedIntoGradingRoom', 'Move into grading room', 'yesno', { extra: {
    noNone: true, movement: { key: 'gradingRoom', order: 3, requires: 'dryRoom', notWithInEntry: ['dryContainer'], question: 'Move into grading room?', done: 'Moved into grading room', stamp: 'dateIntoGradingRoomAt' } } }),
  fld(S_MOVE, 'dateIntoGradingRoomAt', 'Date into grading room', 'timestamp', { readOnly: true, extra: { serverStamp: true, hidden: true } }),
  fld(S_MOVE, 'stampSource', 'Stamp source', 'text', { readOnly: true, extra: { hidden: true } }),
  fld(S_MOVE, 'movementReversedBy', 'Movement reversed by', 'text', { readOnly: true, extra: { hidden: true } }),
  fld(S_MOVE, 'movementReversedAt', 'Movement reversed at', 'timestamp', { readOnly: true, extra: { hidden: true } }),
  fld(S_MOVE, 'movementReversedReason', 'Movement reversed - reason', 'text', { readOnly: true, extra: { hidden: true } }),

  // Section 4 - Steams (roster, one row per steam done in this entry)
  col(S_STEAMS, 'steamNo', 'Steam no.', 'digits', { readOnly: true, extra: { jobSequence: { source: 'drying-process', column: 'steamNo', matchField: 'jobNo' } } }),
  col(S_STEAMS, 'steamDate', 'Date', 'date', { required: true, extra: { defaultToEntryDate: true, notBeforeStamp: 'dateIntoDryRoomAt', notInFuture: true } }),
  col(S_STEAMS, 'steamingTempC', 'Steaming temperature', 'number', { unit: '°C', extra: { copyFromPrevious: true } }),
  col(S_STEAMS, 'steamingTimeMin', 'Steaming time', 'digits', { unit: 'min', extra: { copyFromPrevious: true } }),
  col(S_STEAMS, 'startTime', 'Start time', 'time'),
  col(S_STEAMS, 'doneBy', 'Done by', 'text'),
  col(S_STEAMS, 'steamNoOld', 'Steam no. (old)', 'digits', { readOnly: true, extra: { hidden: true, legacy: true } }),

  // Section 5 - checks and warning override (the values behind the red "not recorded" lines)
  fld(S_CHECKS, 'steamCount', 'Steams in this entry', 'computed', { readOnly: true, extra: { hidden: true } }),
  fld(S_CHECKS, 'warningAck', 'Warning confirmed', 'yesno', { readOnly: true, extra: { hidden: true } }),
  fld(S_CHECKS, 'warningNote', 'Warning note', 'text', { readOnly: true, extra: { hidden: true } }),

  // Section 6 - values from the old single-record form, kept read-only, shown only on old entries
  ...[
    ['wholeWeightOld', 'Whole weight (old)', 'number'],
    ['cookingDateOld', 'Cooking date (old)', 'date'],
    ['cookingWeightOld', 'Cooking weight (old)', 'number'],
    ['removedFromTrolleysDateOld', 'Removed from trolleys (old)', 'date'],
    ['deStringDateOld', 'Date de-string (old)', 'date'],
    ['gradedDateOld', 'Date graded (old)', 'date'],
    ['totalDryingDaysOld', 'Total drying time (old)', 'number'],
    ['dryWeightOld', 'Dry weight (old)', 'number'],
    ['estimateYieldPctOld', 'Estimate yield (old)', 'number'],
  ].map(([k, l, t]) => fld(S_OLD, k, l, t, { readOnly: true, extra: { legacy: true, showWhen: { nonEmpty: true } } })),
  fld(S_OLD, 'calculatedByMigration', 'Migrated entry', 'yesno', { readOnly: true, extra: { hidden: true } }),
  fld(S_OLD, 'dateRawJson', 'Unusable old dates (raw text)', 'text', { readOnly: true, extra: { hidden: true } }),
];
fields.forEach((f, i) => { f.position = i; });

const rosterIdx = S_STEAMS;
def.engine = 'form-record';
def.mount = '#frRoot';
def.sections = [
  { title: 'Job info', kind: 'fields', position: 0, extraJson: { collapsible: true, summaryField: ['jobNo', 'jiProcessingFor'] } },
  { title: 'Job so far', kind: 'fields', position: 1, extraJson: { jobSoFarPanel: true } },
  { title: 'Entry, cooked weight and trolleys', kind: 'fields', position: 2, extraJson: {} },
  { title: 'Movements', kind: 'fields', position: 3, extraJson: { movementBlock: true } },
  {
    title: 'Steams', kind: 'roster', position: rosterIdx, extraJson: {
      cardRows: true, collapseRows: false, startEmpty: true, enforceRequired: true, titleFrom: 'steamNo', rowTitle: 'Steam', addLabel: '+ Add steam',
      previousRows: { source: 'drying-process', matchField: 'jobNo', showSummary: true, summaryLabel: 'Last steam' },
      totals: [{ label: 'Steams this entry', count: true }],
    },
  },
  { title: 'Checks', kind: 'fields', position: 5, extraJson: { collapsible: true } },
  { title: 'Old values', kind: 'fields', position: 6, extraJson: { legacyBlock: true } },
];
def.fields = fields;
def.extraJson = {
  batchField: 'jobNo',
  listColumns: ['entryDate', 'jobNo', 'roster:count'],
  entryLog: true,
  // PLACEHOLDER ranges until QC give real ones (spec D3): soft warnings only.
  checkRanges: { placeholder: true, steamingTempC: [70, 100], steamingTimeMin: [20, 90] },
  submitChecks: 'drying-process',
  deviationLabel: 'Deviation',
  deviationPolarity: 'deviation',
};
def.primaryBatchField = 'jobNo';

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('drying-process:', fields.filter((f) => !f.parentFieldKey).length, 'fields +',
  fields.filter((f) => f.parentFieldKey).length, 'steam columns; engine form-record');
