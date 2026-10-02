const g = require('../src/dry-stock-guard.js');
const cfg = require('../public/data/record-defs/dry-stock-control.json');
const blk = (n) => ({ by: n, title: 'T', date: '2026-10-02', signature: 'sig' });
let pass = 0, fail = 0; const t = (n, c) => { c ? pass++ : (fail++, console.log('FAIL', n)); };
const mk = (id, vals, o = {}) => Object.assign({ id, status: 'submitted', createdAt: 1, values: Object.assign({ jobNo: 'DPR1' }, vals) }, o);
const w = (prev, inc, o) => g.guardWrite(prev ? JSON.stringify(prev) : null, JSON.stringify(inc), Object.assign({ cfg, user: 'anna' }, o));
// 3: before trigger submits with no sign-off
let r = w(null, [mk('a', { dateIn: '2026-10-01' })]); t('no trigger ok', r.ok);
let e = JSON.parse(r.value)[0]; t('stage1', e.stage.no === 1 && e.stage.signoffRequired === false && e.stage.submittedBy === 'anna' && e.stage.status === 'in_progress');
// each trigger field, value 0 counts, dates/others never
for (const k of ['weightIn','countInFactory','countInFinance','weightOut','countOutFactory','countOutFinance']) {
  r = w(null, [mk('a', { [k]: '0' })]); t('trigger '+k, !r.ok && r.status === 422 && /Completed by and Finance/.test(r.error));
}
for (const k of ['dateIn','dateOut','cookingDate','noOfTrolleys','wholeWeight']) { r = w(null, [mk('a', { [k]: '5' })]); t('no trigger '+k, r.ok); }
// 5: partial
r = w(null, [mk('a', { weightIn: '5' }, { completedBy: blk('A') })]); t('finance missing', !r.ok && /Finance representative/.test(r.error) && !/Completed by and/.test(r.error));
r = w(null, [mk('a', { weightIn: '5' }, { financeRep: blk('F') })]); t('completed missing', !r.ok && /Completed by [(]/.test(r.error));
r = w(null, [mk('a', { weightIn: '5' }, { completedBy: { by: 'A', title: '', date: 'x', signature: 's' }, financeRep: blk('F') })]); t('incomplete block', !r.ok);
r = w(null, [mk('a', { weightIn: '5' }, { completedBy: blk('A'), financeRep: blk('F') })]); t('both ok', r.ok);
const s1 = JSON.parse(r.value);
// 6: carried-forward value triggers in stage 3
r = w(s1, s1.concat([mk('b', { weightIn: '5', dateOut: '2026-10-05' })])); t('carried trigger needs signs', !r.ok);
r = w(s1, s1.concat([mk('b', { weightIn: '5', dateOut: '2026-10-05' }, { completedBy: blk('B'), financeRep: blk('F2') })])); t('stage2 ok', r.ok);
const s2 = JSON.parse(r.value); t('stage2 no/prev', s2[1].stage.no === 2 && s2[1].stage.previousId === 'a' && s2[0].stage.no === 1);
// immutability: tamper with stored stage
const tam = JSON.parse(JSON.stringify(s2)); tam[0].values.weightIn = '999'; tam[0].financeRep = null;
r = w(s2, tam); t('immutable', JSON.parse(r.value)[0].values.weightIn === '5' && JSON.parse(r.value)[0].financeRep.by === 'F');
// stale client drops a submitted stage: restored
r = w(s2, [s2[1]]); t('restore dropped', JSON.parse(r.value).length === 2);
// complete lock
const full = { weightIn: '1', dateIn: 'd', countInFactory: '1', countInFinance: '1', weightOut: '1', dateOut: 'd', countOutFactory: '1', countOutFinance: '1' };
r = w(s2, s2.concat([mk('c', full, { completedBy: blk('C'), financeRep: blk('F3') })])); t('complete status', r.ok && JSON.parse(r.value)[2].stage.status === 'complete' && JSON.parse(r.value)[2].stage.no === 3);
const s3 = JSON.parse(r.value);
r = w(s3, s3.concat([mk('d', { dateIn: 'x' })])); t('complete job locked', !r.ok && r.status === 409);
// drafts: no stage, no sign-off needed
r = w(null, [mk('x', { weightIn: '5' }, { status: 'draft' })]); t('draft ok', r.ok && !JSON.parse(r.value)[0].stage);
// other job independent numbering
r = w(s1, s1.concat([mk('z', { dateIn: 'd' }, { values: { jobNo: 'DPR2', dateIn: 'd' } })])); t('job2 stage1', JSON.parse(r.value)[1].stage.no === 1);
// legacy rows
const legacy = [mk('l1', { weightIn: '3' }, { submittedAt: 100 }), mk('l2', { weightIn: '4' }, { submittedAt: 200 })];
g.fillLegacyStages(legacy, cfg); t('legacy stages', legacy[0].stage.no === 1 && legacy[1].stage.no === 2 && legacy[1].stage.previousId === 'l1' && legacy[1].stage.signoffRequired === true);
r = w(legacy, legacy.concat([mk('n', { dateIn: 'd' })])); t('legacy then new = stage 3', r.ok && JSON.parse(r.value)[2].stage.no === 3 && JSON.parse(r.value)[2].stage.previousId === 'l2');
console.log(pass + ' passed, ' + fail + ' failed');
