# Bartender + Argox Label Printing — Integration Instructions
**Processing System · Abagold**  
Date: 2026-10-07

---

## 1. Current Setup

- **Printer:** Argox (connected to a Windows PC)
- **Software:** BarTender (currently triggered manually — operator opens BarTender, selects a template, prints)
- **Goal:** The processing system generates barcode IDs and triggers label printing automatically when a receiving record is submitted — no manual BarTender steps required

---

## 2. Integration Approach

BarTender has two ways to receive print commands from an external system:

### Option A — BarTender Integration Builder (Commander) — RECOMMENDED
BarTender's **Integration Builder** (available in Automation and Enterprise editions) watches a folder or HTTP endpoint for trigger files. When it sees one, it prints automatically.

**Flow:**
1. Processing system (web app) generates barcode IDs on record submit
2. Web server writes a small trigger file (XML or CSV) to a watched folder on the Windows PC
3. BarTender Integration Builder detects the file, merges data into the label template, sends to Argox
4. Labels print — no one touches BarTender manually

### Option B — Print via CSV data file (simpler, works with all BarTender editions)
1. Processing system generates a CSV of barcodes to print (one row per label)
2. Operator opens BarTender, does **File → Print**, selects the CSV as the data source
3. Prints the batch

This is a manual step but far simpler than today — operator just confirms a print job rather than typing anything.

---

## 3. Which BarTender Edition Do You Have?

The integration approach depends on your edition:

| Edition | Integration Builder? | Recommended approach |
|---------|---------------------|---------------------|
| **Starter** | ❌ No | Option B (CSV data file) |
| **Professional** | ❌ No | Option B (CSV data file) |
| **Automation** | ✅ Yes | Option A (automatic trigger) |
| **Enterprise** | ✅ Yes | Option A (automatic trigger) |

Check in BarTender: **Help → About BarTender** to see your edition.

---

## 4. Option A — Automatic Trigger via Integration Builder

### 4.1 What BarTender Watches

Create a folder on the Windows PC, e.g.:
```
C:\BarTender\PrintQueue\
```

The processing system's web server writes a trigger file here whenever labels need printing.

### 4.2 Trigger File Format (XML)

BarTender's Integration Builder reads XML trigger files natively:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<XMLScript Version="2.0">
  <Command>
    <Print>
      <Format>C:\BarTender\Templates\CrateLabel.btw</Format>
      <PrintSetup>
        <Printer>Argox</Printer>
        <IdenticalCopiesOfLabel>1</IdenticalCopiesOfLabel>
      </PrintSetup>
      <RecordSets>
        <RecordSet>
          <Record>
            <FieldData Name="BarcodeID">AGA-CR-00142</FieldData>
            <FieldData Name="Product">Abalone</FieldData>
            <FieldData Name="JobNumber">AG-2026-1042</FieldData>
            <FieldData Name="Date">2026-10-07</FieldData>
            <FieldData Name="Weight">18.5 kg</FieldData>
          </Record>
          <Record>
            <FieldData Name="BarcodeID">AGA-CR-00143</FieldData>
            <FieldData Name="Product">Abalone</FieldData>
            <FieldData Name="JobNumber">AG-2026-1042</FieldData>
            <FieldData Name="Date">2026-10-07</FieldData>
            <FieldData Name="Weight">21.0 kg</FieldData>
          </Record>
        </RecordSet>
      </RecordSets>
    </Print>
  </Command>
</XMLScript>
```

One file per print job. Multiple `<Record>` blocks = multiple labels printed in one run.

### 4.3 BarTender Integration Builder Setup

In BarTender → Integration Builder:

1. Create new integration: **File Folder** trigger type
2. Watch folder: `C:\BarTender\PrintQueue\`
3. File filter: `*.xml`
4. Action: **Print** → select `CrateLabel.btw` template
5. Data source: **XML data from trigger file**
6. After print: **Move trigger file** to `C:\BarTender\PrintQueue\Done\` (so it doesn't print twice)
7. Enable and start the integration

### 4.4 How the Web Server Writes the Trigger File

The processing system (Node/Express server on Render) cannot write directly to `C:\BarTender\PrintQueue\` — it runs in the cloud, not on the Windows PC. Two options to bridge this:

**Option A1 — Shared network folder + polling script on the PC**

Run a small script on the Windows PC that polls the processing system's API every 10 seconds and writes the trigger file locally when a print job is queued:

```javascript
// print-agent.js — runs on the Windows PC (Node.js)
const fs   = require('fs');
const path = require('path');
const https = require('https');

const API_URL    = 'https://processing-department.onrender.com/api/print-queue/pending';
const QUEUE_DIR  = 'C:\\BarTender\\PrintQueue\\';
const DONE_DIR   = 'C:\\BarTender\\PrintQueue\\Done\\';
const PASSKEY    = 'your-internal-api-key';

async function pollAndPrint() {
  const jobs = await fetch(API_URL, { headers: { 'x-api-key': PASSKEY } }).then(r => r.json());
  for (const job of jobs) {
    const xml  = buildXml(job);
    const file = path.join(QUEUE_DIR, `print-${job.id}.xml`);
    fs.writeFileSync(file, xml, 'utf8');
    await fetch(`https://processing-department.onrender.com/api/print-queue/${job.id}/acknowledge`, {
      method: 'POST', headers: { 'x-api-key': PASSKEY }
    });
  }
}

setInterval(pollAndPrint, 10000); // every 10 seconds
```

This runs silently in the background on the Windows PC (can be set up as a Windows Service or a startup Task Scheduler entry).

**Option A2 — Direct folder share (if server is on local network)**

If the web server is ever moved to a local machine on the same network as the printer PC, it can write directly to the shared folder. Simpler but requires local hosting.

---

## 5. Option B — CSV Data File (Manual Confirm, No Integration Builder)

If BarTender edition doesn't have Integration Builder, or while setting up Option A:

### 5.1 Processing System Generates a CSV

After the receiving record is submitted, the system shows a **Download labels CSV** button. Operator downloads it. The CSV looks like:

```csv
BarcodeID,Product,JobNumber,Date,Weight
AGA-CR-00142,Abalone,AG-2026-1042,2026-10-07,18.5 kg
AGA-CR-00143,Abalone,AG-2026-1042,2026-10-07,21.0 kg
AGA-CR-00144,Abalone,AG-2026-1042,2026-10-07,19.2 kg
```

### 5.2 BarTender Template Setup

In the `CrateLabel.btw` template:
- Set **Database Connection** to a text/CSV file (generic text driver)
- Map each column to a field on the label
- When printing, BarTender prompts for the file path — operator selects the downloaded CSV

This means the operator downloads the CSV, opens BarTender (or it's already open), triggers print, selects the file. About 3 clicks. Not fully automatic but zero manual data entry.

---

## 6. Label Template Design (in BarTender)

Create one template per label type. Minimum fields:

### Crate label (`CrateLabel.btw`)
- Barcode (Code 128): field = `BarcodeID`
- Text below barcode: `BarcodeID`
- Product name
- Job number
- Date
- Weight
- Abagold logo (optional)
- Label size: 102mm × 51mm or 57mm × 32mm — choose based on what fits on your crates

### Job sheet label (`JobLabel.btw`)
- Barcode (Code 128): field = `BarcodeID`
- Job number (large text)
- Product, date, total crate count

### Box label (`BoxLabel.btw`)
- Barcode (Code 128): field = `BarcodeID`
- Box ID, product, grade, weight, pack date, job number

### Location labels (printed once, fixed to walls/equipment)
- Barcode (Code 128): field = `BarcodeID`
- Location name (large text, e.g. "DRYING ROOM 01")
- Print on polyester/polypropylene stock — these stay permanent

---

## 7. Print Queue in the Database

Add a `print_queue` table so the processing system can track what needs printing:

```sql
CREATE TABLE print_queue (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  job_number      TEXT NOT NULL,
  label_type      TEXT NOT NULL,             -- 'crate' | 'job' | 'box'
  label_data      JSONB NOT NULL,            -- array of label records to print
  status          TEXT DEFAULT 'pending',    -- pending | acknowledged | printed | failed
  acknowledged_at TIMESTAMPTZ,              -- when the print agent picked it up
  printed_at      TIMESTAMPTZ               -- when BarTender confirmed print (if available)
);

CREATE INDEX idx_print_queue_status ON print_queue(status);
```

**API endpoint for the print agent:**
```
GET  /api/print-queue/pending         — returns all pending jobs
POST /api/print-queue/:id/acknowledge — marks as acknowledged (prevents double-print)
POST /api/print-queue/:id/printed     — marks as printed
```

---

## 8. Implementation Steps

### Step 1 — BarTender template (do this now, no coding required)
- Open BarTender
- Create `CrateLabel.btw` with the fields listed in §6
- Test print with dummy data to confirm Argox prints correctly
- Save template to `C:\BarTender\Templates\`

### Step 2 — Decide on edition / approach
- Check BarTender edition (Help → About)
- Automation/Enterprise → go to Option A (Integration Builder)
- Starter/Professional → use Option B (CSV download) for now

### Step 3 — Option B (CSV) — quick win, works immediately
- Add **Download labels CSV** button to the receiving record post-submit screen
- Format: one row per barcode ID generated, with all label fields
- Test: download CSV → open in BarTender → print

### Step 4 — Option A (automatic) — longer term
- Set up `print_queue` table in Neon
- Build the polling print agent script (§4.4) on the Windows PC
- Configure Integration Builder to watch the queue folder
- Test end-to-end: submit record → label prints automatically

---

## 9. Notes

- The Argox printer must be set as the default printer in BarTender for automatic printing to work
- Label stock: make sure what's loaded in the Argox matches the template size in BarTender — a size mismatch is the most common print error
- The print agent script requires Node.js installed on the Windows PC (free download from nodejs.org)
- If the Windows PC goes to sleep, the print agent stops polling — set power settings to prevent sleep while the system is in use
