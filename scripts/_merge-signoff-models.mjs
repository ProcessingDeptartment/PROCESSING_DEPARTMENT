import fs from 'fs';

const recordKeys = ['dry-export-pack-front-page','production-information-nrcs','dry-nrcs-packs','production-information-nrcs-rework','salting-and-tumbling','washing-control-sheet','salting-oosw','rework-log','product-label-checklist','scrubbing-checklist-qc','can-packing-control-sheet','broth-cooking','ingredient-weighing','sauce-batch-coding','dry-cooking','grading-production-log-cultivated','grading-production-log-ranched','grading-boxing-traceability','dry-labelling-list','live-packing-bag-quality-check','individual-abalone-weight-checks','production-areas-cleaning-record','live-product-areas-cleaning-record','personnel-facilities-cleaning-record','weekly-cleaning-record','pest-inspection-record','staff-hygiene-inspection-weekends','staff-hygiene-inspection','daily-equipment-checklist','glass-plastic-equipment-inspection','utensil-issue-record','safety-glass-register','goggles-register','knife-register','factory-maintenance-inspection','equipment-checklist-roof','supplier-questionnaire','emergency-evacuation-attendance-register','handling-of-emergencies-and-incidences'];

function modelName(key) { return 'Sub_' + key.replace(/-/g, '_'); }

function splitModels(src) {
  // returns map name -> full block text "model X {\n...\n}\n"
  const map = new Map();
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^model (\S+) \{/);
    if (m) {
      const start = i;
      let depth = 0;
      let j = i;
      for (; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        if (j > start && depth === 0) break;
      }
      const block = lines.slice(start, j + 1).join('\n') + '\n';
      map.set(m[1], block);
      i = j + 1;
    } else {
      i++;
    }
  }
  return map;
}

const gen = fs.readFileSync('prisma/submission-models.prisma', 'utf8');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const genModels = splitModels(gen);
const schemaModels = splitModels(schema);

let missing = [];
let replaced = [];
for (const key of recordKeys) {
  const name = modelName(key);
  const genBlock = genModels.get(name);
  const schemaBlock = schemaModels.get(name);
  if (!genBlock) { missing.push('gen:' + name); continue; }
  if (!schemaBlock) { missing.push('schema:' + name); continue; }
  if (genBlock === schemaBlock) { continue; }
  schema = schema.replace(schemaBlock, genBlock);
  replaced.push(name);
}

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('replaced:', replaced.length, replaced);
console.log('missing:', missing);
