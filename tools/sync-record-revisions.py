"""
Reconciles the revision number on every record page against the controlled Master
Index List, which is the authority. Writes to three places per record: the engine
config (docRevisionStart), the hardcoded <span class="doc-rev"> on bespoke pages,
and public/lib/master-index-data.js is regenerated separately.

    python tools/sync-record-revisions.py            # dry run, prints the plan
    python tools/sync-record-revisions.py --apply    # writes the changes

Requires openpyxl.
"""
import openpyxl, re, os, glob, sys

APPLY = '--apply' in sys.argv
XL = r'T:\Abagold Processing Facility\14. Projects\20. Paperless\6. RECORDS\FINAL\_____REC 01 Master Index List_06.2026.xlsx'
RECDIR = r'T:\Abagold Processing Facility\14. Projects\20. Paperless\PROCESSING_DEPARTMENT\public\records'

def norm(c):
    return re.sub(r'[^A-Z0-9]', '', str(c).upper())

wb = openpyxl.load_workbook(XL, data_only=True)
ws = wb['REC']
index = {}
for row in ws.iter_rows(min_row=7, values_only=True):
    code, name, rev = row[0], row[1], row[3]
    if not code or rev is None: continue
    try: rev = int(str(rev).strip())
    except: continue
    k = norm(code)
    if not k.startswith('REC') or k in index: continue
    index[k] = (str(code).strip(), str(name).strip(), rev)

# manual doc-code aliases: system code -> master index code
ALIAS = {'REC774C': 'REC7741C'}
# handled manually: the page carries the wrong doc code (see notes)
SKIP = {'REC92'}

changes = []   # (file, kind, code, old, new, indexname)
unmatched = []

for p in sorted(glob.glob(os.path.join(RECDIR, '*.html'))):
    fn = os.path.basename(p)
    if fn == 'master-record-index.html': continue
    t = open(p, encoding='utf-8').read()
    m = re.search(r"docCode:\s*'([^']*)'", t)
    kind = 'config'
    if not m:
        m = re.search(r'<span class="doc-code">([^<]*)</span>', t)
        kind = 'static'
        if not m: continue
    code = m.group(1)
    k = ALIAS.get(norm(code), norm(code))
    if k in SKIP: unmatched.append((fn, code + ' [SKIPPED - manual]')); continue
    if k not in index:
        unmatched.append((fn, code)); continue
    newrev = index[k][2]
    if kind == 'config':
        r = re.search(r'docRevisionStart:\s*(\d+)', t)
        if not r: unmatched.append((fn, code + ' [no docRevisionStart]')); continue
        old = int(r.group(1))
        if old != newrev:
            t2 = t[:r.start()] + f'docRevisionStart: {newrev}' + t[r.end():]
            changes.append((fn, kind, code, old, newrev, index[k][1]))
            if APPLY: open(p, 'w', encoding='utf-8', newline='').write(t2)
    else:
        r = re.search(r'(<span class="doc-rev">Rev )(\d+)', t)
        if not r: unmatched.append((fn, code + ' [no doc-rev span]')); continue
        old = int(r.group(2))
        if old != newrev:
            t2 = t[:r.start()] + r.group(1) + str(newrev) + t[r.end():]
            changes.append((fn, kind, code, old, newrev, index[k][1]))
            if APPLY: open(p, 'w', encoding='utf-8', newline='').write(t2)

# The Master Record Index no longer holds its own copy of the revisions -- it reads
# public/lib/master-index-data.js, which build-master-index-data.py regenerates
# straight from the same spreadsheet. Nothing to reconcile there.

print(f"{'APPLIED' if APPLY else 'DRY RUN'} — record pages changed: {len(changes)}")
for c in changes: print(f'  {c[0]:52} {c[2]:14} {c[1]:6} rev {c[3]} -> {c[4]}')
print(f"\nRecord pages with no matching doc code in the master index ({len(unmatched)}):")
for u in unmatched: print(f'  {u[0]:52} {u[1]}')
