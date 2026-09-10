// Offline unit test for src/validate-submission.js -- fakes the one Prisma call
// assembleRecordConfig makes, so no Neon connection is needed.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { validateWrite } = require('../src/validate-submission.js');

const DEF = {
  recordKey: 'test-rec', engine: 'form-record', mount: '#frRoot', pageFile: 'x.html',
  docCode: null, title: null, docRevisionStart: null, jobInfoGroup: null, clientHook: null,
  primaryBatchField: null, extraBatchFields: [], extraJson: {}, version: 1, autofills: [],
  sections: [
    { title: 'Main', kind: 'fields', position: 0, extraJson: {} },
    { title: 'Rows', kind: 'roster', position: 1, extraJson: {} },
  ],
  fields: [
    { key: 'operator', label: 'Operator', type: 'text', required: true, sectionIndex: 0, parentFieldKey: null, position: 0, options: [], extraJson: {} },
    { key: 'shift', label: 'Shift', type: 'select', required: false, sectionIndex: 0, parentFieldKey: null, position: 1, options: ['Day', 'Night'], extraJson: {} },
    { key: 'coldReading', label: 'Cold', type: 'number', required: false, sectionIndex: 0, parentFieldKey: null, position: 2, options: [], extraJson: {} },
    { key: 'coldStandard', label: 'Std', type: 'number', required: false, sectionIndex: 0, parentFieldKey: null, position: 3, options: [], extraJson: {} },
    { key: 'coldDev', label: 'Dev', type: 'computed', required: false, sectionIndex: 0, parentFieldKey: null, position: 4, options: [],
      computeFn: 'subtract', computeArgs: { a: 'coldReading', b: 'coldStandard' }, extraJson: {} },
    { key: 'weight', label: 'Weight', type: 'number', required: true, sectionIndex: 1, parentFieldKey: null, position: 0, options: [], extraJson: {} },
  ],
};

const fakePrisma = { recordDefinition: { findUnique: async () => JSON.parse(JSON.stringify(DEF)) } };
const run = (entries) => validateWrite(fakePrisma, 'formrecord:test-rec', JSON.stringify(entries));

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name); } };

// 1. clean submitted entry -> no violations
let r = await run([{ status: 'submitted', values: { operator: 'JB', shift: 'Day', coldReading: '5', coldStandard: '3', coldDev: '2' }, roster: [{ weight: '10' }] }]);
check('clean entry has no violations', r.ok && r.violations.length === 0);

// 2. missing required top field
r = await run([{ status: 'submitted', values: { shift: 'Day' }, roster: [{ weight: '1' }] }]);
check('missing required operator flagged', r.violations.some(v => /Operator.*required/.test(v)));

// 3. bad select option
r = await run([{ status: 'submitted', values: { operator: 'X', shift: 'Evening' }, roster: [{ weight: '1' }] }]);
check('bad select option flagged', r.violations.some(v => /Shift.*not one of the allowed/.test(v)));

// 4. non-numeric number field
r = await run([{ status: 'submitted', values: { operator: 'X', coldReading: 'abc' }, roster: [{ weight: '1' }] }]);
check('non-numeric number flagged', r.violations.some(v => /Cold.*not a number/.test(v)));

// 5. computeFn mismatch
r = await run([{ status: 'submitted', values: { operator: 'X', coldReading: '10', coldStandard: '3', coldDev: '99' }, roster: [{ weight: '1' }] }]);
check('compute mismatch flagged', r.violations.some(v => /coldDev|Dev/.test(v) && /subtract/.test(v)));

// 6. roster required missing
r = await run([{ status: 'submitted', values: { operator: 'X' }, roster: [{ weight: '' }] }]);
check('roster missing required weight flagged', r.violations.some(v => /roster row 1.*Weight.*required/.test(v)));

// 7. draft entry is NOT checked
r = await run([{ status: 'draft', values: {}, roster: [] }]);
check('draft entry not validated', r.ok && r.violations.length === 0);

// 8. report-only: ok stays true even with violations
r = await run([{ status: 'submitted', values: {}, roster: [] }]);
check('report-only keeps ok=true', r.ok === true && r.violations.length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
