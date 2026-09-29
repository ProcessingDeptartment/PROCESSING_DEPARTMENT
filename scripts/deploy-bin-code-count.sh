#!/usr/bin/env bash
# One-off: seed + commit + push the REC 7.4.3.x auto-counting bin code change.
# Stages only the bin-card hunks of record-theme.css (leaves the uncommitted Tablet UI v2 pilot block out).
set -e
cd "$(dirname "$0")/.."
node scripts/seed-definitions.mjs | tail -2
git diff public/styles/record-theme.css > /tmp/rt.patch
node -e "
const fs=require('fs');const p=fs.readFileSync('/tmp/rt.patch','utf8');
const parts=p.split(/(?=^@@ )/m);
fs.writeFileSync('/tmp/rt-mine.patch',parts[0]+parts.slice(1).filter(h=>!h.includes('TABLET UI v2')).join(''));"
git apply --cached /tmp/rt-mine.patch
git add data/record-definitions.json public/data/record-defs/grading-production-log-*.json \
  public/records/REC-7.4.3.1-grading-production-log-cultivated.html \
  public/records/REC-7.4.3.2-grading-production-log-ranched.html \
  public/lib/form-record.js scripts/apply-grading-bin-no-removed.mjs
git diff --cached --stat
git commit -q -F - <<'EOF'
REC 7.4.3.1/7.4.3.2: bin code counts up per size grade

No bin number to enter: binNo is a hidden seqWithin counter, binCode
(sizeGrade-n, e.g. 8g-10g-2) is shown read-only. Card line 1 is now
grade | bin code | start | checked. form-record: cardLayout renders
hidden-column inputs (v58).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
