# Work Instructions — Full Content Extract

**Status:** Closes Section 6, item 1 of the [Processing Department Field Inventory](Processing-Department-Field-Inventory.md). The "Work Instructions" content that a plain page read misses (it renders in a panel that the audit noted as hidden-until-"Show") has now been captured for every record that carries it.

## Method

Extracted directly from source, not the browser. Every record page defines its Work Instructions as a `config.instructions` array of `{ label, text }` objects, rendered by `public/lib/form-record.js:543-547` into the `.fr-instructions` panel. Pulling from the config is exact and complete — no truncation, no need to trigger the "Show" toggle per record.

## Coverage

| | Count |
|---|---|
| Records carrying Work Instructions content | 52 |
| Records with no `instructions` block (nothing to capture) | 68 |
| Total REC records | 120 |

The 68 without an `instructions` block have no Work Instructions data — this is not truncation, the field is simply absent on those records.

## Content by record

### Live intake / handling

- **REC 1 — Gonad Inspection Report**
  - *Stage 0:* Immature, sex indeterminate, digestive gland visible as grey/brown mass.
  - *Stage 1:* Sex determinable, gonad small, colouration, tip pointed.
  - *Stage 2:* Gonad large, tip rounded but not swollen.
  - *Stage 3:* Gonad very large, tip rounded and swollen, bulging at shell edge.
- **REC 7.1.0 — Daily Weight Sampling**
  - *Purpose:* Sample basket weights daily by size range and farm.
- **REC 7.1.00 — Fixed Reader Checks**
  - *Purpose:* Check that RFID tags match the QDE system reading at each fixed reader location.
- **REC 7.1.6 — Scrubbing Check (Supervisor)**
  - *Purpose:* Supervisor check that abalone is cleaned effectively during scrubbing, and any damage is recorded.
- **REC 7.2.2 — Scrubbing Checklist (QC)**
  - *Purpose:* QC check of scrubbing quality — crates inspected, damage, and whether abalone is scrubbed clean.
- **REC 7.2 — Sampling Log**
  - *Purpose:* Record any product samples taken (AG code / DW / dry job number / live tag / ranched incoming date) and why.
- **Live Leftovers Log**
  - *Note:* Tracks live product leftover weight by size class after packing — a standalone running log, separate from the per-pack leftovers fields on REC 7.5.2 Live Pack Checklist.
- **Mortality Counts by Customer**
  - *Note:* The paper version used one spreadsheet tab per date with a customer × size-band matrix that varies in width each time — this roster form captures the same data (customer, size band, mortality count) as flexible rows instead.
- **REC 7.5.3 — Live Packing Bag Quality Check**
  - *Purpose:* On the day of packing (or the shift before), all bags allocated for the live pack must be checked by a team of 2 from live sorting and 2 from processing.

### Dry processing

- **REC 7.4.1 — Drying Process**
  - *Note:* The paper form has one Date/Time per steam cycle (up to 14). This digital version records the date of each steam turn — steam 1 through 14 — plus the milestone dates either side.
- **REC 7.4.5 — Boxing and Labelling**
  - *Note:* The bin code is used as the "box code" on the label.

### Canning

- **REC 01 — Cans Released Form**
  - *Purpose:* Record cans released from hold, awaiting NRCS clearance.
- **REC 7.1 — Incubator Cans Log**
  - *Purpose:* Track cans sent for incubation/micro testing until they are cleared.
  - *How to fill this in:* The three sections are done at different times on the same job. Fill in section 1 when the cans go in and submit it — that section then locks. When you come back, pick the job no. under "Continue a job" to reopen it and fill in the next section. A section already submitted can still be corrected, but you must give a reason and your name.

### Cleaning

- **REC 7.6.1 — Daily Cleaning Inspection**
  - *Cleaning instruction:* Perform cleaning per the master cleaning schedule. Food contact surfaces cleaned at start of shift, between jobs and at end of shift. Sanitise work surfaces at end of shift. Raise a corrective action immediately on visual inspection failure at end of shift. Open a CAR for areas non-conforming more than once a week. Tick C if cleaning is done, NC if not.
- **REC 7.6.1.1 — Deep Cleaning Record (Weekly)**
  - *Cleaning instruction:* Perform cleaning per the master cleaning schedule. Raise a corrective action immediately on visual inspection failure at end of shift. Open a CAR for areas non-conforming more than once a week. Tick C if cleaning is done, NC if not.
- **REC 7.6.8 — Allergen Cleaning Verification**
  - *Note:* Swabbing tests for the presence/absence of protein traces after cleaning, which indirectly indicates presence/absence of the allergens of concern for the products involved.
- **Master Cleaning Plan**
  - *Purpose:* The reference cleaning schedule that REC 7.6.1 (Daily Cleaning Inspection), REC 7.6.1.1 (Deep Cleaning Record Weekly) and REC 7.6.2 (Weekly Cleaning Record) point to. Update this when the cleaning method, frequency or responsible party for any part/area changes.
- **Master Cleaning Checklist**
  - *Note:* The paper form has separate Day/Night tick columns for every day of the week. This digital version records one row per equipment item per day — use the day field to log which day/shift a cleaning was done, and add a row per occurrence.

### Pest control

- **REC 7.6.5 — Internal Pest Sightings Log**
  - *Instruction:* If any pest or presence of pest activity is noted or reported, the Internal Pest Controller completes this log and informs management.
- **REC 7.6.6 — Pest Inspection Record**
  - *Instruction:* Weekly inspections are done to determine the presence of pests and signs of activity. If any presence/activity is noted, complete the Pest Sightings Log and inform the pest control company. Bird droppings or pests present inside the facility must be recorded on a CAR.

### Staff hygiene

- **REC 7.6.7 — Staff Hygiene Inspection**
  - *Work instruction:* Complete record at start-up of each working shift. Inspect per the Personnel Hygiene Procedure. Key: ✓ = Compliance, x = Non-compliance, A = Absent.
- **REC 7.6.7a — Staff Hygiene Inspection (Weekends)**
  - *Work instruction:* Complete record at start-up of each working shift. Inspect per the Personnel Hygiene Procedure. Non-compliance observed should be recorded and reported to supervisors.
- **REC 8.2.8.1 — RFH Medical Result**
  - *Screening covers:* Chronic medication acknowledgement, urine test, blood pressure & pulse, glucose blood test (if glucosuria/diabetic), Snellen eye test (both eyes), physical inspection of scalp/ears/nose/mouth/teeth/hands/nails.
- **RTW Medical Questionnaire**
  - *Note:* Ticking "yes" does not automatically make the employee unfit for duty — it provides baseline health statistics and supports health & safety legislation compliance. If any question is answered yes, refer the employee to a medical practitioner; if all no, the employee is fit to resume duties.

### PPE / utensils / equipment

- **REC 7.7.1 — Daily Equipment Checklist**
  - *Inspection:* Inspect all equipment and devices daily. ✓ = Good condition/working, X = Faulty/damaged.
- **REC 7.7.2 — Glass & Plastic Equipment Inspection**
  - *Key:* Y = Inspected and in order. N = Inspected but not conforming.
  - *What to check:* Every morning before starting up, check light fittings, windows, temperature dial displays, extractor fan grids, wall clocks, computer screens and plastic crates. Check equipment/machinery (rollers, conveyers, racking, trolleys, tanks) is in good repair. Detail any non-conformance in Comments.
- **REC 7.7.4 — Utensil Issue Record**
  - *Work instruction:* Knives remove gut & beak; scrapers remove flesh from shell (shucking); scrubbing brushes scrub abalone; needles for stringing dry, scissors for destringing dry. Record quantity issued. Condition: ✓ = good condition, X = faulty/damaged. Faulty/damaged utensils returned to supervisor and discarded, with type & number recorded. Utensils go into Dynacide solution when not in use.
- **REC 7.7.4.1.a — Safety Glass Register**
  - *Key:* ✓ = Compliance, x = Non-compliance.
- **REC 7.7.4.1.b — Goggles Register**
  - *Key:* ✓ = Compliance, x = Non-compliance, N/A = Not issued.
- **REC 7.7.4.1.c — Knife Register**
  - *Key:* ✓ = Compliance, x = Non-compliance.
- **REC 7.8.12 — Factory Maintenance Inspection**
  - *Work instruction:* Conduct inspections at start of shift, checking that all listed areas are clean and in good, functioning condition, and that equipment/machinery is in a good state of repair and intact. Detail any non-conformance in the Comments column. Key: Y = Inspected and in order, N = Inspected but not conforming.
- **REC 7.8.12.1 — Equipment Checklist (Roof)**
  - *To-do — daily:* Drain the compressor tank. Empty the drip tray underneath the 250-pipe connection.
  - *To-do — weekly:* Drain and clean the filters.

### Monitoring logs

- **REC 7.9.1 — Chiller Temperature Monitoring**
  - *Temperature parameters:* 0°C to +10°C. Defrost temperature not above +20°C.
  - *Frequency of monitoring:* Start of shift, lunch break and end of shift.
  - *If out of spec:* If the temperature varies by more than 0.5°C from the accepted parameters, corrective action must be recorded and the temperature checked again within 1 hour.
- **REC 7.9.2 — Incubator Temperature Check**
  - *Target range:* 36.1°C – 37.8°C, recorded at start of shift, lunch and end of shift.
- **REC 7.9.3.1 — Dry Room Temp/Humidity Log**
  - *Check:* Check temperature & relative humidity on the dial inside the dry room. Temperature should be 25–32°C; any deviation must be reported.
- **REC 7.9.3.2 — Grading Room Temp/Humidity Log**
  - *Check:* Check temperature & relative humidity on the dial inside the grading room. Temperature should be 25–32°C; any deviation must be reported.
- **REC 7.8.9 — Water Monitoring**
  - *Note:* Targets for fresh water pH and sea water pH/salt are not specified on the paper form — set them under Thresholds once confirmed. Readings are recorded either way.
- **REC 7.8.9.1 — LHA Water Monitoring**
  - *Scope:* Live Holding Area chiller unit — separate from the general Water Monitoring record (REC 7.8.9), which covers a different water source.
  - *Frequency:* Complete record twice per shift.
  - *Parameter:* Temperature 12-18°C.
- **REC 7.10.2 — pH Verification**
  - *Weekly:* Measure 20ml of buffer pH 4, insert probe, take reading. Repeat with buffer pH 7 and pH 10. Meter should read within 3.9–4.1 (buffer 4.01), 6.9–7.1 (buffer 7.01), 9.9–10.1 (buffer 10.01). If outside range, record the deviation and repeat the monthly calibration; if still out of spec, record it and report the issue.
  - *Monthly:* Measure 20ml of buffer pH 4, 7 and 10, click CAL on the pH meter and follow the instructions. Record that the calibration was done successfully.
- **REC 7.10.3 — Thermometer Verification**
  - *Verify thermometer accuracy:* Verification must be done using a standard reference thermometer and a test thermometer. Deviation should not be larger than 0.5°C — if it is, complete REC 7.10.4 to add a correction factor.
  - *Cold verification (0–5°C):* Crush ice, fill half a jar, top up with water and stir. Insert reference probe and test thermometer, wait to stabilise, then record.
  - *Hot verification (85–95°C):* Boil water, insert reference probe and test thermometer, wait to stabilise and record. If the reading exceeds the specified limits, a corrective action must be recorded.
  - *Frequency:* Weekly.
- **REC 7.10.4 — Thermometer Correction Factors**
  - *Verify thermometer accuracy:* Verification must be done using a standard reference thermometer or master thermometer calibrated by a SANAS accredited authority.
  - *How to establish correction factors:* Place the probes in one container filled with water and allow the thermometer to read for 2 minutes, then record the findings.
  - *Tolerance:* Readings should not exceed a difference of 0.5°C. If exceeded, report the thermometer and add the correction factor.
  - *Frequency:* Weekly.

### Waste / incoming goods

- **REC 7.8.2 — Daily Waste Removal**
  - *Note:* Once the waste is offloaded, the person at the dumpsite or area of dumping must sign the form.
- **REC 7.8.7 — Incoming Goods Inspection**
  - *Sampling:* On receiving of lot/batches, refer to the sampling tables (PRO 8.2.18) to determine sampling size for inspection. If the product does not comply, do not accept the delivery.

### Quality / HR / traceability

- **REC 8.1.4 — Withdrawal / Mock Recall Record**
  - *Note:* Mock recall to be completed within 72 hours due to time difference to country of export.
- **REC 8.1.6 — Traceability Mock Recall (Canned Abalone)**
  - *Note:* Static reference checklist — each row references another REC record by code/label rather than pulling live data from it (cross-record data linking is a future enhancement).
- **REC 8.1.6a — Traceability Mock Recall (Canned Braised Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.6b — Traceability Mock Recall (Canned Minced Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.7 — Traceability Mock Recall (Dried Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.8 — Traceability Mock Recall (Live Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.2.2 — Supplier Approval Record**
  - *Scoring:* The supplier is rated on the 6 criteria below. A score of 70% or more adds them to the Approved Supplier List. An ad-hoc supplier used before the selection process is complete needs Food Safety Team Leader approval.
- **REC 8.4.b — Handling of Emergencies and Incidences**
  - *Purpose:* Food safety factors to consider during an emergency drill — process for managing incidents that seriously compromise hygiene, food safety, quality, personnel or premises. Key factors: time and temperature.
- **REC 9.1 — Daily Factory Feedback Meeting**
  - *Note:* Attendance is a roster (name + present) rather than a fixed name list, so it stays accurate as staff changes.

---

## Note for database design

These `instructions` entries are **static instructional text tied to the record type**, not per-submission data capture. They belong in the record/template definition (one set per record type), not in the submissions table. They mix three kinds of content — legend/keys (✓/x meanings), procedural steps, and digital-vs-paper migration notes — but all are record-level metadata.
