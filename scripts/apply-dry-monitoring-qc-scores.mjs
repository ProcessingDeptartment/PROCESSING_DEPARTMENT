// REC 7.4.2 Dry Monitoring: align the checks with the Dried Abalone QC Manual (7 Oct 2026, Rowan Timmer).
// Spec: "REC 7.4.2 Dry Monitoring: QC Manual Alignment Instructions" (9 Oct 2026). Idempotent.
//   - the five Yes/No signs (mould, white salt, case hardening, shine, foot damage) are replaced by ten scored signs
//     (type 'scored-select': numeric buttons, guidance pop-up, photo when the score is above 0)
//   - worstScore / totalScore / batchStatus are computed by the engine (extraJson.scoring below drives it)
//   - trolleysClearlyMarked stays as an operational Yes/No (no score); the old five keep their values as "(old)" fields
//
//   node scripts/apply-dry-monitoring-qc-scores.mjs
//   node scripts/snapshot-one-def.mjs dry-monitoring      (offline snapshot)  or export-record-defs.mjs
//   node scripts/seed-definitions-only.mjs dry-monitoring (Neon) -- after the migration has been applied

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-monitoring');

const fld = (key, label, type, o = {}) => ({
  key, label, type,
  required: !!o.required, readOnly: !!o.readOnly,
  unit: o.unit || null, options: o.options || null, group: o.group || null,
  sectionIndex: null, parentFieldKey: null, position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  ...(o.extra ? { extraJson: o.extra } : {}),
});

// [key, label, howToCheck, [value, label, detail]...]. Score labels/detail appear only in the (i) pop-up, never on the buttons.
const SIGNS = [
  ['skinScore', 'Skin', 'Look at the skin and run a finger over it.', [
    [0, '0 — Ideal', 'Dry skin that still flexes, drying at the same speed as the meat'],
    [1, '1 — Warning', 'Skin turning smooth and firming ahead of the meat'],
    [3, '3 — Failed', 'Dry, smooth, hard crust']]],
  ['coreScore', 'Core', 'Press the centre of the foot firmly with a thumb. Read skin and core together: hard skin + soft core = case hardening (overdrying); soft skin + soft core = underdrying (check sticky and mould).', [
    [0, '0 — Ideal', 'Core firming at the same rate as the skin'],
    [1, '1 — Warning', 'Core noticeably softer than the skin'],
    [3, '3 — Failed', 'Core soft or wet when cut']]],
  ['frillsScore', 'Frills', 'Feel test: run fingers along the beard, frills and foot edge.', [
    [0, '0 — Ideal', 'Edges dry and firm but not sharp. Frills dry and elastic'],
    [1, '1 — Warning', 'Frill tips stiffening, foot edge starting to sharpen'],
    [3, '3 — Failed', 'Frills and beard spiky and crusty, foot edge sharp and hard']]],
  ['shapeScore', 'Shape', 'Look at the gap where the frill meets the adductor muscle. Look for curl and dents.', [
    [0, '0 — Ideal', 'Tight, closed shape. Small to no gap between frill and adductor'],
    [1, '1 — Warning', 'Gap widening, edges starting to curl'],
    [3, '3 — Failed', 'Big gap where the frill has pulled away from the adductor; dents and distortion']]],
  ['colourScore', 'Colour', 'Compare against the Score 0 reference photo for the same day. Darkening is only a defect when ahead of schedule.', [
    [0, '0 — Ideal', 'Colour matches the reference for this day'],
    [1, '1 — Warning', 'Slightly darker than the reference'],
    [3, '3 — Failed', 'Clearly darker, well ahead of schedule']]],
  ['wrinklesScore', 'Wrinkles', 'Look at the side of the foot. Pass or fail only.', [
    [0, '0 — Pass', 'Smooth'],
    [2, '2 — Fail', 'Wrinkled']]],
  ['stickyScore', 'Sticky', 'Slide a clean, dry finger across the skin. Pass or fail only.', [
    [0, '0 — Pass', 'Smooth and dry, finger slides freely'],
    [2, '2 — Fail', 'Sticky, finger cannot slide over the skin']]],
  ['mouldScore', 'Mould', 'Zero tolerance. Turn pieces over. Check the underside and every point where pieces touch each other or the trolley. Mould vs bloom: fully dried product can grow an even dry white bloom of protein, which is quality, not mould. Mould is raised or fuzzy spots, usually where pieces touch. If in doubt, score 2 and call supervision. Score 2 or 3: remove and isolate the affected pieces immediately and check the remaining pieces one by one.', [
    [0, '0 — None', 'No spots'],
    [2, '2 — Isolated', 'One or two small spots (white, grey, green or black) on a single piece'],
    [3, '3 — Spread', 'Spots on more than one piece, fuzzy growth, or any spread']]],
  ['odourScore', 'Odour', 'Smell the trolley.', [
    [0, '0 — Clean', 'Clean, normal dried smell'],
    [1, '1 — Warning', 'Slightly sour'],
    [3, '3 — Failed', 'Clearly sour, ammonia or off odour']]],
  ['steamTimingScore', 'Steam timing', 'Read the trolley card and compare the recorded steam times with the schedule. The Day 1 morning steam (straight out of Windhoek) is the most critical steam: missing it scores 3 immediately.', [
    [0, '0 — On schedule', 'All steams done in their round'],
    [1, '1 — Late', 'A steam done late, after its round'],
    [3, '3 — Missed', 'A steam missed, or the Day 1 morning steam not done']]],
];

const sign = ([key, label, howToCheck, opts]) => fld(key, label, 'scored-select', {
  required: true, group: 'Checks', options: opts.map((o) => String(o[0])),
  extra: {
    howToCheck,
    scoreOptions: opts.map(([value, lab, detail]) => ({ value, label: lab, detail, photoUrl: '' })),
    contributesToScore: true, showPhotoWhenAbove: 0, redPrompt: 'correctiveActions', showInTable: false,
  },
});

// removed Yes/No checks: Yes was the problem on all five
const OLD = [
  ['mouldVisible', 'Mould visible'], ['whiteSaltOnSurface', 'White salt on surface'], ['caseHardening', 'Case hardening'],
  ['surfaceShine', 'Surface shine'], ['footDamage', 'Foot damage'],
];
const REMOVED = OLD.map((o) => o[0]);
const NEW_KEYS = [...SIGNS.map((s) => s[0]), 'worstScore', 'totalScore', 'batchStatus', 'ncEntryId', ...OLD.map(([k]) => k + 'Old')];

const prior = def.fields;
const trolleys = prior.find((f) => f.key === 'trolleysClearlyMarked');
const corrective = prior.find((f) => f.key === 'correctiveActions');
if (!trolleys || !corrective) throw new Error('trolleysClearlyMarked / correctiveActions missing');
trolleys.extraJson = { ...(trolleys.extraJson || {}), good: 'Yes', redPrompt: 'correctiveActions' };

const out = (key, label, type, extra) => fld(key, label, type, { readOnly: true, group: 'Checks', extra, unit: extra.unit });
const checkFields = [
  ...SIGNS.map(sign),
  out('worstScore', 'Worst score', 'number', { scoreOutput: 'worst' }),
  out('totalScore', 'Total score', 'number', { scoreOutput: 'total' }),
  out('batchStatus', 'Batch status', 'text', { scoreOutput: 'status' }),
  trolleys,
  corrective,
  fld('ncEntryId', 'NC reference', 'text', { readOnly: true, group: 'Checks', extra: { hidden: true } }),
  ...OLD.map(([k, l]) => fld(k + 'Old', l + ' (old)', 'text', { readOnly: true, group: 'Checks',
    extra: { legacy: true, legacyFrom: k, legacyBad: 'Yes', showWhen: { nonEmpty: true } } })),
];

const rest = prior.filter((f) => !REMOVED.includes(f.key) && !NEW_KEYS.includes(f.key)
  && f.key !== 'trolleysClearlyMarked' && f.key !== 'correctiveActions');
// put the Checks block where the old one sat (before "Comments")
const at = rest.findIndex((f) => f.group === 'Comments');
rest.splice(at < 0 ? rest.length : at, 0, ...checkFields);
rest.forEach((f, i) => { f.position = i; });
def.fields = rest;

def.extraJson = {
  ...(def.extraJson || {}),
  scoring: {
    signs: SIGNS.map((s) => s[0]),
    worst: 'worstScore', total: 'totalScore', status: 'batchStatus', ncRef: 'ncEntryId', maxTotal: 28,
    // overdrying signs / underdrying signs / steam: drive the interpretation line and the pop-up steps
    over: ['skinScore', 'coreScore', 'frillsScore', 'shapeScore', 'colourScore'],
    under: [{ key: 'stickyScore', min: 2 }, { key: 'mouldScore', min: 2 }, { key: 'odourScore', min: 1 }],
    steam: 'steamTimingScore',
    interpretation: {
      over: 'Possible overdrying (case hardening)',
      under: 'Possible underdrying',
      both: 'Possible overdrying and underdrying signs present — check trolley carefully',
      steam: 'Steam timing issue — no product defect signs yet',
    },
    statuses: ['Green', 'Amber', 'Red', 'Critical'],   // index = worst score
    actions: {
      Amber: ['Find the cause (steam timing, airflow, orientation, loading).', 'Start an intervention plan.', 'Notify the dried supervisor this shift.', 'Recheck within 4 hours.'],
      Red: ['Start the intervention plan immediately.', 'Notify the dried manager and QC manager now.', 'Recheck every 2 hours until Amber.'],
      Critical: ['Ring fence the trolley and tag it.', 'Do not move it to packing.', 'Notify Rowan and Phila immediately, with photos.'],
    },
    steps: {
      over: ['Overdrying signs: add an extra steam, reduce wind, rotate the trolley.'],
      under: ['Underdrying signs: steam now, move to Windhoek with maximum airflow, remove and isolate mould pieces.'],
      steam: ['Steam deviation: record the deviation and complete the steam immediately.'],
    },
    autoNc: true, ncCategory: 'Product quality',
  },
};
if (typeof def.version === 'number') def.version += 1;

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-monitoring:', def.fields.length, 'fields; version', def.version ?? '(n/a)');
