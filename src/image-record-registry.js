// Image-enabled records. Adding a record here (plus imageUploadFields in its definition) is all
// the photo API and the local archive agent need.
//   recordNo   short code used in archive filenames and folders (REC 7.4.2 -> '742')
//   jobModel   Prisma delegate of the record's sub_* table, used to look up the entry's job number
//              (entries are keyed by id; the column holding the job is jobNo on every sub_* table)
const IMAGE_RECORD_REGISTRY = {
  'dry-monitoring': { recordNo: '742', jobModel: 'sub_dry_monitoring' },
  // 'grading-boxing': { recordNo: '743', jobModel: 'sub_...' },   // add real REC numbers as records gain photos
};

module.exports = { IMAGE_RECORD_REGISTRY };
