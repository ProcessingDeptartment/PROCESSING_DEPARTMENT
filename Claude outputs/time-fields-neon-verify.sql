-- Verify the time/datetime field-type update landed correctly.
-- Expect: 49 rows, all type = 'time' or 'datetime'.

SELECT "recordKey", key, type, label
FROM "RecordFieldDef"
WHERE (key, "recordKey") IN (
  ('startTime','fixed-reader-checks'), ('endTime','fixed-reader-checks'),
  ('startTime','salting-and-tumbling'), ('finishTime','salting-and-tumbling'),
  ('bleedingStartTime','bleeding-and-salting'), ('bleedingFinishTime','bleeding-and-salting'),
  ('saltingStartTime','bleeding-and-salting'), ('saltingFinishTime','bleeding-and-salting'),
  ('timeStarted','washing-control-sheet'),
  ('time','scrubbing-check-supervisor'),
  ('time','scrubbing-checklist-qc'),
  ('precookingStartTime','precooking-check-sheet'),
  ('time','can-packing-control-sheet'),
  ('startTime','can-filling-and-printing'),
  ('time','printing-control-sheet'),
  ('timeTrolleyIn','cans-produced'),
  ('time','retorting-control-sheet'), ('timeTrolleyIn','retorting-control-sheet'), ('timeTrolleyOut','retorting-control-sheet'),
  ('timeTrolleyIn','retort-inspection-report'),
  ('startTime','dry-cooking'), ('timeOut','dry-cooking'),
  ('timeOfTransfer','dry-stock-transfers'),
  ('startTime','live-pack-checklist'), ('timeFinishedPacking','live-pack-checklist'),
  ('timeOfBreakage','glass-breakage-clearance-certificate'), ('timeOfRestart','glass-breakage-clearance-certificate'),
  ('time','plaster-dressing-inspection'), ('breakTime','plaster-dressing-inspection'), ('lunchTime','plaster-dressing-inspection'), ('knockOffTime','plaster-dressing-inspection'),
  ('time','first-aid-checklist-record'), ('breakTime','first-aid-checklist-record'),
  ('time','chiller-batch-control'),
  ('time','dry-chiller-batch-control'),
  ('timeStarted','maintenance-job-card'), ('timeFinished','maintenance-job-card'),
  ('timeOfCollection','daily-waste-removal'),
  ('timeBoilerStarted','boiler-inspection-report'), ('timeBoilerTurnedOff','boiler-inspection-report'),
  ('timeOfCheck','lha-water-monitoring'),
  ('dateTimeStarted','withdrawal-mock-recall-record'), ('dateTimeFinished','withdrawal-mock-recall-record'),
  ('startTime','traceability'), ('finishTime','traceability'),
  ('timeStarted','emergency-evacuation-attendance-register'), ('timeEnded','emergency-evacuation-attendance-register'),
  ('timeEvacuating','handling-of-emergencies-and-incidences'), ('timeReturning','handling-of-emergencies-and-incidences')
)
ORDER BY "recordKey", key;

-- Quick sanity count: should return 49
SELECT count(*) AS updated_field_count
FROM "RecordFieldDef"
WHERE (key, "recordKey") IN (
  ('startTime','fixed-reader-checks'), ('endTime','fixed-reader-checks'),
  ('startTime','salting-and-tumbling'), ('finishTime','salting-and-tumbling'),
  ('bleedingStartTime','bleeding-and-salting'), ('bleedingFinishTime','bleeding-and-salting'),
  ('saltingStartTime','bleeding-and-salting'), ('saltingFinishTime','bleeding-and-salting'),
  ('timeStarted','washing-control-sheet'),
  ('time','scrubbing-check-supervisor'),
  ('time','scrubbing-checklist-qc'),
  ('precookingStartTime','precooking-check-sheet'),
  ('time','can-packing-control-sheet'),
  ('startTime','can-filling-and-printing'),
  ('time','printing-control-sheet'),
  ('timeTrolleyIn','cans-produced'),
  ('time','retorting-control-sheet'), ('timeTrolleyIn','retorting-control-sheet'), ('timeTrolleyOut','retorting-control-sheet'),
  ('timeTrolleyIn','retort-inspection-report'),
  ('startTime','dry-cooking'), ('timeOut','dry-cooking'),
  ('timeOfTransfer','dry-stock-transfers'),
  ('startTime','live-pack-checklist'), ('timeFinishedPacking','live-pack-checklist'),
  ('timeOfBreakage','glass-breakage-clearance-certificate'), ('timeOfRestart','glass-breakage-clearance-certificate'),
  ('time','plaster-dressing-inspection'), ('breakTime','plaster-dressing-inspection'), ('lunchTime','plaster-dressing-inspection'), ('knockOffTime','plaster-dressing-inspection'),
  ('time','first-aid-checklist-record'), ('breakTime','first-aid-checklist-record'),
  ('time','chiller-batch-control'),
  ('time','dry-chiller-batch-control'),
  ('timeStarted','maintenance-job-card'), ('timeFinished','maintenance-job-card'),
  ('timeOfCollection','daily-waste-removal'),
  ('timeBoilerStarted','boiler-inspection-report'), ('timeBoilerTurnedOff','boiler-inspection-report'),
  ('timeOfCheck','lha-water-monitoring'),
  ('dateTimeStarted','withdrawal-mock-recall-record'), ('dateTimeFinished','withdrawal-mock-recall-record'),
  ('startTime','traceability'), ('finishTime','traceability'),
  ('timeStarted','emergency-evacuation-attendance-register'), ('timeEnded','emergency-evacuation-attendance-register'),
  ('timeEvacuating','handling-of-emergencies-and-incidences'), ('timeReturning','handling-of-emergencies-and-incidences')
)
AND type IN ('time','datetime');

-- Any of these 49 that DIDN'T end up as time/datetime (should return 0 rows)
SELECT "recordKey", key, type
FROM "RecordFieldDef"
WHERE (key, "recordKey") IN (
  ('startTime','fixed-reader-checks'), ('endTime','fixed-reader-checks'),
  ('startTime','salting-and-tumbling'), ('finishTime','salting-and-tumbling'),
  ('bleedingStartTime','bleeding-and-salting'), ('bleedingFinishTime','bleeding-and-salting'),
  ('saltingStartTime','bleeding-and-salting'), ('saltingFinishTime','bleeding-and-salting'),
  ('timeStarted','washing-control-sheet'),
  ('time','scrubbing-check-supervisor'),
  ('time','scrubbing-checklist-qc'),
  ('precookingStartTime','precooking-check-sheet'),
  ('time','can-packing-control-sheet'),
  ('startTime','can-filling-and-printing'),
  ('time','printing-control-sheet'),
  ('timeTrolleyIn','cans-produced'),
  ('time','retorting-control-sheet'), ('timeTrolleyIn','retorting-control-sheet'), ('timeTrolleyOut','retorting-control-sheet'),
  ('timeTrolleyIn','retort-inspection-report'),
  ('startTime','dry-cooking'), ('timeOut','dry-cooking'),
  ('timeOfTransfer','dry-stock-transfers'),
  ('startTime','live-pack-checklist'), ('timeFinishedPacking','live-pack-checklist'),
  ('timeOfBreakage','glass-breakage-clearance-certificate'), ('timeOfRestart','glass-breakage-clearance-certificate'),
  ('time','plaster-dressing-inspection'), ('breakTime','plaster-dressing-inspection'), ('lunchTime','plaster-dressing-inspection'), ('knockOffTime','plaster-dressing-inspection'),
  ('time','first-aid-checklist-record'), ('breakTime','first-aid-checklist-record'),
  ('time','chiller-batch-control'),
  ('time','dry-chiller-batch-control'),
  ('timeStarted','maintenance-job-card'), ('timeFinished','maintenance-job-card'),
  ('timeOfCollection','daily-waste-removal'),
  ('timeBoilerStarted','boiler-inspection-report'), ('timeBoilerTurnedOff','boiler-inspection-report'),
  ('timeOfCheck','lha-water-monitoring'),
  ('dateTimeStarted','withdrawal-mock-recall-record'), ('dateTimeFinished','withdrawal-mock-recall-record'),
  ('startTime','traceability'), ('finishTime','traceability'),
  ('timeStarted','emergency-evacuation-attendance-register'), ('timeEnded','emergency-evacuation-attendance-register'),
  ('timeEvacuating','handling-of-emergencies-and-incidences'), ('timeReturning','handling-of-emergencies-and-incidences')
)
AND type NOT IN ('time','datetime');
