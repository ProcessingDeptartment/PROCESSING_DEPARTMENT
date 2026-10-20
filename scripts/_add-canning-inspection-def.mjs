// One-time script to add the canning-inspection entry to data/record-definitions.json
// node scripts/_add-canning-inspection-def.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

if (data.definitions.some(d => d.recordKey === 'canning-inspection')) {
  console.log('canning-inspection already present, skipping');
  process.exit(0);
}

const entry = {
  recordKey: 'canning-inspection',
  engine: 'form-record',
  mount: '#frRoot',
  pageFile: 'REC-7.2.11-canning-inspection.html',
  docCode: 'REC 7.2.11',
  title: 'Canning Inspection Record',
  docRevisionStart: 1,
  jobInfoGroup: 'Job info',
  clientHook: null,
  extraJson: {
    listColumns: ['dateOfProduction', 'jobNo', 'productionCode'],
    printCompact: true
  },
  sections: [
    { title: 'Job info', kind: 'fields', position: 0,
      extraJson: { collapsible: true, summaryField: ['jobNo', 'productionCode'], cols: 2 } },
    { title: 'Water Reading', kind: 'fields', position: 1, extraJson: { cols: 3 } },
    { title: 'Can Measurements', kind: 'roster', position: 2,
      extraJson: { rosterKey: 'cans', transposedTable: true, colTitle: 'Can',
        specsWatchField: 'productionCode', specsFields: { productDescription: 'productDescription' },
        startEmpty: false, printTable: true } },
    { title: 'Visual Checks', kind: 'roster', position: 3,
      extraJson: { rosterKey: 'visual', transposedTable: true, colTitle: 'Can',
        specsWatchField: 'productionCode', startEmpty: false, printTable: true } }
  ],
  fields: [
    { key: 'jobNo', label: 'Job No.', type: 'jobsearch', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: 0, computeFn: null, computeArgs: null, recordPickSource: null, linkField: 'jobNo', linkRelation: 'self', validateJson: null, extraJson: null },
    { key: 'dateOfProduction', label: 'Date of Production', type: 'date', required: true, readOnly: false, unit: null, options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: 1, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'productionCode', label: 'Production Code (AG Code)', type: 'text', required: true, readOnly: false, unit: null, options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: 2, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'productDescription', label: 'Product Description', type: 'text', required: false, readOnly: true, unit: null, options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: 3, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'phMeasured', label: 'pH Measured', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 1, parentFieldKey: null, position: 0, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'brixMeasured', label: 'Brix Measured', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 1, parentFieldKey: null, position: 1, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'saltMeasured', label: 'Salt Measured (%)', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 1, parentFieldKey: null, position: 2, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'canContents', label: 'Can Contents', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 0, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'nettWeightSpec', label: 'Nett Weight Min (g)', type: 'text', required: false, readOnly: true, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 1, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: { specFrom: 'nettWeightMin' } },
    { key: 'nettWeightMeasured', label: 'Nett Weight Measured (g)', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 2, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: { ncBelow: 'nettWeightMin' } },
    { key: 'drainWeightSpec', label: 'Drain Weight Min (g)', type: 'text', required: false, readOnly: true, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 3, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: { specFrom: 'drainWeightMin' } },
    { key: 'drainWeightMeasured', label: 'Drain Weight Measured (g)', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 4, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: { ncBelow: 'drainWeightMin' } },
    { key: 'ingoWeight', label: 'Ingo Weight (g)', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 5, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'vacuum', label: 'Vacuum (kPa)', type: 'number', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 2, parentFieldKey: null, position: 6, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'appearance', label: 'Appearance', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 3, parentFieldKey: null, position: 0, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'odours', label: 'Odours', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 3, parentFieldKey: null, position: 1, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'texture', label: 'Texture / Consistency', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 3, parentFieldKey: null, position: 2, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'taste', label: 'Taste of Product', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 3, parentFieldKey: null, position: 3, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null },
    { key: 'generalComments', label: 'General Comments', type: 'text', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: 3, parentFieldKey: null, position: 4, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, extraJson: null }
  ],
  autofills: []
};

data.definitions.push(entry);
data.count = data.definitions.length;

fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(`Added canning-inspection. Total: ${data.count} definitions`);
