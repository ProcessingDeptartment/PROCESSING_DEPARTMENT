/*
 * CLEANING ITEM MASTER -- the single controlled source of truth for every cleanable
 * item in the facility, and the reference that all REC 7.6.x cleaning records render
 * from. See public/records/cleaning-system-reference.html for the full rationale.
 *
 * === WHY THIS FILE EXISTS ===
 * The paper system stated the same facts in up to four places. "Floors & Drains" was a
 * separate written row 26 times in REC 7.6.1 alone, another 14 times in REC 7.6.1.1, and
 * again in REC 7.6.2 -- same week, same drain, three forms, three signatures. Frequency
 * was declared in the Master Cleaning Plan AND in the Master Cleaning Checklist AND
 * implied by which form the inspector happened to be holding.
 *
 * Here each fact is stated ONCE:
 *   - frequency, responsible role, method, chemical      -> on the item
 *   - the 12 checks that repeat in every room            -> STANDARD_CHECKS, referenced
 *   - which record a line appears on                     -> item.scope, not a separate doc
 * Every REC 7.6.x page is a filtered VIEW over this array. Nothing is retyped, so nothing
 * can drift between forms.
 *
 * === SOURCE DOCUMENTS transcribed into this master ===
 *   Master Cleaning Plan Rev 2 (28/02/2024)      -- what/where/when/how/who + supplies
 *   REC 7.6.0 a/b/c Rev 1 (eff. 24/06/2026)      -- execution area lists (3 zones)
 *   REC 7.6.1 Daily Cleaning Inspection Rev 4    -- ~175 daily inspection lines
 *   REC 7.6.1.1 Deep Cleaning (Weekly) Rev 1     -- ~155 weekly deep-clean lines
 *   REC 7.6.2 Weekly Cleaning Inspection Rev 4   -- 27 weekly summary lines
 *   REC 7.6.2.2 Dispatch Cleaning Inspection Rev 2 -- 9 dispatch lines
 * REC 7.2.5.1 Master Cleaning Checklist is deliberately NOT here: its content (extruder,
 * pre-conditioner, pellet spreader, vacuum coater, bagging line) is the FEED MILL, a
 * different site and scope. It keeps its own record page.
 *
 * === SCOPES ===
 * An item's `scope` array says which records it appears on. One item can appear on
 * several -- it is still ONE item, checked once, stored once.
 *   'exec'     REC 7.6.0  -- the cleaner records that cleaning was DONE
 *   'daily'    REC 7.6.1  -- QC daily visual inspection
 *   'weekly'   REC 7.6.1.1 -- weekly deep clean inspection
 *   'summary'  REC 7.6.2  -- weekly plant-wide summary
 *   'dispatch' REC 7.6.2.2 -- dispatch/loading bay inspection
 *
 * === HONESTY RULE ON CHEMICALS ===
 * `chemical`, `concentration` and `contactTime` carry ONLY what the source documents
 * actually state. The Master Cleaning Plan names just "soap" and "dynacide" and gives no
 * concentration or contact time anywhere. Those fields are therefore null on almost every
 * item and the UI renders them as an explicit gap. They are NOT guessed -- an invented
 * concentration on a controlled cleaning record is worse than a blank one. Filling them in
 * is a required action for FSSC (ISO/TS 22002-1 s11.2 wants cleaning agents and their
 * conditions of use); see the reference page's "Open gaps" section.
 */
(function () {

  // ---------------------------------------------------------------- standard checks
  // These 12 lines were written out separately in nearly every area block of REC 7.6.1
  // and REC 7.6.1.1 -- roughly 110 of 7.6.1's 175 rows. Declared once here and stamped
  // onto every saved record by version, so an auditor can always reconstruct exactly
  // what "area meets standard checks" meant on any given date.
  const STANDARD_CHECKS = [
    { id: 'sc-floors',    label: 'Floors clean, no standing water' },
    { id: 'sc-drains',    label: 'Drains clean and free-flowing' },
    { id: 'sc-walls',     label: 'Walls clean, no flaking paint or rust' },
    { id: 'sc-doors',     label: 'Doors, door seals and roller doors clean and closed' },
    { id: 'sc-ceiling',   label: 'Ceiling clean' },
    { id: 'sc-lights',    label: 'Light covers and overhead structures clean and intact' },
    { id: 'sc-windows',   label: 'Windows and window seals clean, free from dust' },
    { id: 'sc-vent',      label: 'Ventilation / extractor fans clean and working' },
    { id: 'sc-handwash',  label: 'Hand wash basin clean, warm water and paper towel available' },
    { id: 'sc-soap',      label: 'Soap and sanitiser dispenser clean and full' },
    { id: 'sc-cleaneq',   label: 'Cleaning equipment clean, stored correctly, facing away from walls' },
    { id: 'sc-waste',     label: 'Waste bin emptied and clean' }
  ];
  const STANDARD_CHECKS_VERSION = 1;

  // ---------------------------------------------------------------------- zones
  const ZONES = [
    { id: 'production', label: 'Production areas',        doc: 'REC 7.6.0 a' },
    { id: 'live',       label: 'Live product areas',      doc: 'REC 7.6.0 b' },
    { id: 'personnel',  label: 'Personnel facilities',    doc: 'REC 7.6.0 c' },
    { id: 'dispatch',   label: 'Dispatch / loading bay',  doc: 'REC 7.6.2.2' },
    { id: 'external',   label: 'External / building',     doc: 'REC 7.6.2' }
  ];

  // Shorthand used heavily below.
  const V = 'visual';      // verification is visual inspection only
  const SWAB = 'swab';     // requires a swab / ATP result to be entered

  // i(label, opts) -> item. Keeps the area tables readable.
  let seq = 0;
  function i(label, opts) {
    opts = opts || {};
    seq += 1;
    return {
      id: 'itm-' + seq,
      label: label,
      freq: opts.freq || 'Daily',
      scope: opts.scope || ['daily'],
      fcs: !!opts.fcs,                       // food contact surface
      verify: opts.verify || V,
      chemical: opts.chemical || null,       // null = not stated in any source doc
      concentration: opts.concentration || null,
      contactTime: opts.contactTime || null,
      method: opts.method || null,
      note: opts.note || null
    };
  }

  // a(id, label, zone, opts) -> area
  function a(id, label, zone, opts) {
    opts = opts || {};
    return {
      id: id,
      label: label,
      zone: zone,
      role: opts.role || 'OPERATOR',
      // Which records this area appears on at all.
      scope: opts.scope || ['exec', 'daily', 'weekly'],
      // false for areas with no room fabric of their own (e.g. a tank farm)
      standardChecks: opts.standardChecks !== false,
      items: opts.items || []
    };
  }

  // ---------------------------------------------------------------------- areas
  const AREAS = [

    // ===================================================== LIVE PRODUCT (REC 7.6.0 b)
    a('entrance-shucking', 'Entrance to Sorting / Shucking', 'live', {
      items: [
        i('Boot wash brush clean and intact', { scope: ['daily', 'weekly'] }),
        i('Boot wash taps clean and operational', { scope: ['weekly'] }),
        i('Bucket filled with water and soap', { scope: ['weekly'], chemical: 'Soap' }),
        i('PPE stored on the rails', { scope: ['daily', 'weekly'] }),
        i('Hand dryer clean and operational', { scope: ['daily', 'weekly'] }),
        i('Hand wash water temperature adequate', { scope: ['weekly'] })
      ]
    }),

    a('shucking', 'Shucking Area', 'live', {
      items: [
        i('Shucking tables, underneath tables and conveyors', { fcs: true, freq: 'Start of shift, between jobs, end of shift', scope: ['exec', 'daily', 'weekly'], verify: SWAB, chemical: 'Soap' }),
        i('Aprons', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'], chemical: 'Dynacide', method: 'Scrub with brush, soak in fresh water and dynacide for a day, wash, rinse and hang to dry' }),
        i('Blue bins and all crates', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'], chemical: 'Soap', method: 'Scrub with soap and water, rinse and let dry' }),
        i('Conveyor belt removed and cleaned', { freq: 'Weekly', scope: ['exec', 'weekly'], chemical: 'Soap' }),
        i('Black matting clean and intact', { scope: ['weekly'] }),
        i('Boot wash brush clean, no items in it', { scope: ['daily', 'weekly'] }),
        i('Hose reels clean, no rust', { scope: ['weekly'] }),
        i('No gloves lying around', { scope: ['daily', 'weekly'] }),
        i('Fire extinguisher clean', { scope: ['weekly'] }),
        i('No bins on the floor', { scope: ['daily', 'weekly'] }),
        i('Fly catcher system on and clean', { freq: 'Weekly', scope: ['daily', 'weekly'] }),
        i('Wall panels clean and intact', { scope: ['weekly'] })
      ]
    }),

    a('sorting', 'Sorting Area', 'live', {
      items: [
        i('Tables, on top and underneath', { fcs: true, freq: 'Start of shift, between jobs, end of shift', scope: ['exec', 'daily'], verify: SWAB, chemical: 'Soap' }),
        i('Scales and bins clean', { scope: ['exec', 'daily'] }),
        i('No product stored directly on the floor', { scope: ['daily'] }),
        i('No bins on the floor', { scope: ['daily'] }),
        i('No wooden crates in the area', { scope: ['daily'] }),
        i('No dirty aprons on rails', { scope: ['daily'] })
      ]
    }),

    a('live-holding', 'Live Holding Area', 'live', {
      items: [
        i('Live holding tanks', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'] }),
        i('Emergency door closed', { scope: ['daily'] }),
        i('No dirty crates in the area', { scope: ['daily'] }),
        i('Chest fridge clean and operational', { scope: ['daily'] }),
        i('No bins on the floor', { scope: ['daily'] }),
        i('No pallets in the area', { scope: ['daily'] })
      ]
    }),

    a('entrance-live-packing', 'Entrance to Live Packing', 'live', {
      items: [
        i('Boot brush clean and intact', { scope: ['daily'] }),
        i('Wall panels clean', { scope: ['daily'] })
      ]
    }),

    a('live-packing', 'Live Packing Area', 'live', {
      items: [
        i('Tables clean', { fcs: true, freq: 'Start of shift, between jobs, end of shift', scope: ['exec', 'daily'], verify: SWAB, chemical: 'Soap' }),
        i('No dirty crates in the area', { scope: ['daily'] }),
        i('No pallets in the area', { scope: ['daily'] }),
        i('No water on the floor', { scope: ['daily'] }),
        i('Aprons clean', { scope: ['exec', 'daily'] })
      ]
    }),

    a('live-packaging-store', 'Live Packaging Store', 'live', {
      items: [
        i('Packaging stored off the floor and away from walls', { scope: ['exec', 'daily'] })
      ]
    }),

    a('live-freezer', 'Freezer (Live)', 'live', {
      items: [
        i('Freezer inside', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] }),
        i('Freezer door handles', { freq: 'Daily', scope: ['exec', 'daily'] })
      ]
    }),

    a('water-tanks', 'Sea Water and Fresh Water Tanks', 'live', {
      standardChecks: false,
      scope: ['exec', 'weekly', 'summary'],
      items: [
        i('Tanks (fresh and sea water) and surrounding area', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] }),
        i('Pumps', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Taps and pipes', { freq: 'Weekly', scope: ['weekly', 'summary'] })
      ]
    }),

    a('ozone', 'Ozone System / Filters', 'live', {
      standardChecks: false,
      scope: ['exec', 'weekly', 'summary'],
      items: [
        i('Ozone unit and filters', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] })
      ]
    }),

    // ===================================================== PRODUCTION (REC 7.6.0 a)
    a('main-entrance', 'Main Entrance (Canning / Dry / Washing / FG02)', 'production', {
      items: [
        i('Boot wash brush clean and intact', { scope: ['daily', 'weekly'] }),
        i('Hand dryer clean and working', { scope: ['daily', 'weekly'] })
      ]
    }),

    a('washing-salting', 'Salting / Washing Area', 'production', {
      items: [
        i('Washing machine', { fcs: true, freq: 'After use', scope: ['exec', 'daily', 'weekly', 'summary'], verify: SWAB, chemical: 'Soap', method: 'Damp the scourer in water and soap, scrub the motors' }),
        i('Salting bins', { freq: 'After use', scope: ['exec', 'daily', 'weekly'], chemical: 'Soap', method: 'Remove all remaining salt, scrub with soap and water, rinse and let dry' }),
        i('Salt and sugar storage bins', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Yellow and grey crates', { freq: 'Daily', scope: ['exec', 'daily'], chemical: 'Soap' }),
        i('Plastic pallets', { freq: 'Weekly', scope: ['exec', 'weekly'], chemical: 'Soap' }),
        i('Scale clean', { scope: ['exec', 'daily'] }),
        i('White board clean', { scope: ['daily', 'weekly'] }),
        i('Bleeding crates traceability', { scope: ['daily', 'weekly'] }),
        i('Motors and panels clean, no rust', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Yellow buckets clean', { scope: ['weekly'] }),
        i('No pipe on the floor', { scope: ['weekly'] })
      ]
    }),

    a('dry-cooking', 'Dry Cooking Area', 'production', {
      items: [
        i('Cooking pots, inside and outside', { fcs: true, freq: 'After use', scope: ['exec', 'daily', 'weekly'], verify: SWAB, chemical: 'Soap', method: 'Brush the pots inside and out using water and soap, rinse' }),
        i('Steam pipes', { freq: 'Weekly', scope: ['daily', 'weekly', 'summary'] }),
        i('Humidifier machine clean', { freq: 'Weekly', scope: ['daily', 'weekly', 'summary'] }),
        i('Temperature loggers working', { scope: ['daily'] }),
        i('Tables and scales clean', { fcs: true, scope: ['exec', 'daily', 'weekly'] }),
        i('Hose pipe stored correctly', { scope: ['weekly'] }),
        i('Allergen utensils separated and stored in allergen area', { freq: 'Every changeover', scope: ['exec', 'daily', 'weekly'], verify: SWAB, note: 'Allergen changeover also requires REC 7.6.8' }),
        i('Fly catcher system on and clean', { freq: 'Weekly', scope: ['daily', 'weekly'] })
      ]
    }),

    a('windhoek', 'Windhoek', 'production', {
      items: [
        i('No scales or used empties in the area', { scope: ['daily'] }),
        i('No stagnant water on the floor', { scope: ['daily'] }),
        i('Board clean', { scope: ['weekly'] }),
        i('No bins or crates', { scope: ['weekly'] })
      ]
    }),

    a('steamer', 'Steamer', 'production', {
      items: [
        i('Steamer clean', { fcs: true, freq: 'After use', scope: ['exec', 'daily', 'weekly'], verify: SWAB }),
        i('Fans clean and working', { scope: ['daily', 'weekly'] })
      ]
    }),

    a('dry-hanging', 'Dry Hanging Area', 'production', {
      items: [
        i('Dry room rails and hooks', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] }),
        i('Humidifiers and heaters', { freq: 'Weekly', scope: ['weekly', 'summary'] })
      ]
    }),

    a('dry-storage-passage', 'Dry Storage and Passage Area', 'production', {
      scope: ['exec', 'weekly'],
      items: [
        i('Crates clean, no broken crates', { freq: 'Weekly', scope: ['exec', 'weekly'] }),
        i('Humidifier clean', { freq: 'Weekly', scope: ['weekly'] }),
        i('Electrical panel clean', { freq: 'Weekly', scope: ['weekly'] }),
        i('No rust on fittings', { freq: 'Weekly', scope: ['weekly'] }),
        i('No scales or used empties', { freq: 'Weekly', scope: ['weekly'] })
      ]
    }),

    a('scrubbing', 'Scrubbing Area', 'production', {
      items: [
        i('Debeaking and scrubbing tables', { fcs: true, freq: 'Start of shift, between jobs, end of shift', scope: ['exec', 'daily', 'weekly'], verify: SWAB, chemical: 'Soap' }),
        i('Storage and salting bins, traceability labels correct', { scope: ['exec', 'daily', 'weekly'] }),
        i('Crates clean and intact, no broken crates', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'], chemical: 'Soap' }),
        i('Empty bins clean', { scope: ['daily', 'weekly'] }),
        i('Chillers inside', { freq: 'Daily', scope: ['exec', 'daily', 'weekly', 'summary'], chemical: 'Soap', method: 'Remove all trolleys, scrub floor, doors and door handles, rinse' }),
        i('Chiller and freezer door handles', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'] }),
        i('No dripping water from fans', { scope: ['daily', 'weekly'] }),
        i('No product underneath the fans', { scope: ['daily', 'weekly'] }),
        i('Only allergens stored in the allergen area', { scope: ['daily', 'weekly'], note: 'Allergen changeover also requires REC 7.6.8' }),
        i('Old freezer clean', { scope: ['daily', 'weekly'] }),
        i('Aprons', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'], chemical: 'Dynacide' }),
        i('No electric cables on the floor', { scope: ['daily'] })
      ]
    }),

    a('crate-storage', 'Crate Storage Area', 'production', {
      items: [
        i('Crates clean and stacked off the floor', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('No broken crates', { scope: ['exec', 'daily'] })
      ]
    }),

    a('pre-cooking', 'Pre-Cooking Area', 'production', {
      items: [
        i('Cooking pot', { fcs: true, freq: 'After use', scope: ['exec', 'daily', 'weekly'], verify: SWAB, chemical: 'Soap', method: 'Brush the pots inside and out using water and soap, rinse' }),
        i('Scale clean', { scope: ['exec', 'daily', 'weekly'] }),
        i('Crates clean and intact', { scope: ['exec', 'daily', 'weekly'] }),
        i('No electric cables on the floor', { scope: ['daily', 'weekly'] }),
        i('Thermometer working', { scope: ['weekly'], note: 'Verification recorded on REC 7.10.3' })
      ]
    }),

    a('canning', 'Canning Area', 'production', {
      items: [
        i('Grader, canning table and conveyors', { fcs: true, freq: 'Start of shift, between jobs, end of shift', scope: ['exec', 'daily', 'weekly'], verify: SWAB, chemical: 'Soap' }),
        i('Seamer', { fcs: true, freq: 'After use', scope: ['exec', 'daily', 'weekly', 'summary'], verify: SWAB, chemical: 'Soap', method: 'Spray water to wash off debris, brush off remaining debris with water and soap, use a scourer to remove sauce, rinse, dry and grease the seamer' }),
        i('Seamer inside', { fcs: true, freq: 'After use', scope: ['weekly'], verify: SWAB }),
        i('Seamer outside, no grease underneath', { freq: 'After use', scope: ['daily', 'weekly'] }),
        i('Seamer lubricant cover', { scope: ['weekly'] }),
        i('Seamer conveyor belt', { fcs: true, scope: ['weekly'] }),
        i('Lids filler', { fcs: true, scope: ['weekly'] }),
        i('White bins and buckets', { scope: ['exec', 'daily', 'weekly'] }),
        i('Blue trays and white trays', { scope: ['exec', 'daily', 'weekly'] }),
        i('Trolleys', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'], chemical: 'Soap' }),
        i('Scales', { scope: ['exec', 'daily', 'weekly'] }),
        i('Can dust blower', { scope: ['daily', 'weekly'] }),
        i('Canning conveyor belt', { fcs: true, freq: 'Monthly', scope: ['exec', 'daily', 'weekly'], chemical: 'Dynacide', method: 'Remove the conveyor belt from the frame, soak in dynacide, scrub with soap and water, rinse and let dry' }),
        i('Blue conveyor belt', { fcs: true, scope: ['weekly'] }),
        i('White conveyor belt', { fcs: true, scope: ['weekly'] }),
        i('Steam collector', { scope: ['daily', 'weekly'] }),
        i('Hose reels clean', { scope: ['weekly'] }),
        i('White board clean', { scope: ['weekly'] }),
        i('Fire extinguisher clean', { scope: ['weekly'] }),
        i('Ink on the floor treated', { scope: ['daily'] }),
        i('Wooden pallets', { scope: ['daily', 'weekly'] })
      ]
    }),

    a('retort', 'Retort Area', 'production', {
      items: [
        i('Retort inside', { freq: 'Monthly', scope: ['exec', 'daily', 'weekly', 'summary'], chemical: 'Soap', method: 'Use brush to scrub the inside, rinse with fresh water' }),
        i('Retort outside', { freq: 'Monthly', scope: ['exec', 'daily', 'weekly', 'summary'], chemical: 'Soap', method: 'Use towel to wash the retort outside' }),
        i('Trays and trolleys', { scope: ['exec', 'daily'] })
      ]
    }),

    a('bin-wash', 'Bin Washing Area', 'production', {
      items: [
        i('Bin wash area', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('White doors clean, no dust', { scope: ['daily'] })
      ]
    }),

    a('utensil-wash', 'Utensil Wash Area', 'production', {
      scope: ['exec', 'weekly'],
      items: [
        i('Utensils stored off the floor', { freq: 'Weekly', scope: ['exec', 'weekly'] }),
        i('No dirty utensils left standing', { freq: 'Weekly', scope: ['exec', 'weekly'] }),
        i('Unused utensils removed from the area', { freq: 'Weekly', scope: ['weekly'] })
      ]
    }),

    a('fg02', 'FG02 (Finished Goods)', 'production', {
      items: [
        i('Roller door clean and closed', { scope: ['exec', 'daily', 'weekly'] }),
        i('No dust build-up', { scope: ['daily', 'weekly'] }),
        i('Product traceability labels correct', { scope: ['daily', 'weekly'] }),
        i('No broken pallets', { scope: ['daily', 'weekly'] })
      ]
    }),

    a('dry-grading', 'Dry Grading Area', 'production', {
      items: [
        i('Product stored away from walls and off the floor', { scope: ['exec', 'daily'] }),
        i('No broken containers', { scope: ['daily'] }),
        i('Entrance free from dust', { scope: ['daily'] }),
        i('Bait station not obstructed', { scope: ['daily'], note: 'Bait station findings go to REC 7.6.6' }),
        i('Entrance gate locked', { scope: ['daily'] })
      ]
    }),

    a('raw-material-store', 'Raw Material and Packaging Store', 'production', {
      items: [
        i('Raw materials sealed', { scope: ['exec', 'daily'] }),
        i('Scales clean', { scope: ['exec', 'daily'] }),
        i('Batch code displayed on the wall', { scope: ['daily'] }),
        i('Pallets against the wall', { scope: ['daily'] }),
        i('No bins or crates on the floor', { scope: ['daily'] }),
        i('No dust at the packaging area', { scope: ['daily'] })
      ]
    }),

    a('chillers', 'Chillers', 'production', {
      items: [
        i('Chillers and freezers inside', { freq: 'Daily', scope: ['exec', 'daily', 'weekly', 'summary'], chemical: 'Soap' }),
        i('Trolleys removed before cleaning', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('Door handles', { freq: 'Daily', scope: ['exec', 'daily'] })
      ]
    }),

    a('drains-production', 'Drains (plant-wide)', 'production', {
      standardChecks: false,
      items: [
        i('Drain channels brushed and rinsed', { freq: 'Daily', scope: ['exec', 'daily'], chemical: 'Soap', method: 'Use a drain brush to wash the drain channel, spray debris to the drain, brush with water and soap, rinse off' }),
        i('Deep clean all drains', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] })
      ]
    }),

    a('waste-removal', 'Waste Removal Area', 'production', {
      items: [
        i('Dust bins emptied, scrubbed and dried', { freq: 'Daily', scope: ['exec', 'daily'], chemical: 'Soap', method: 'Remove the plastic bag, scrub with soap and water, rinse and let dry' }),
        i('Waste area clean and free from odour', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] })
      ]
    }),

    // ===================================================== PERSONNEL (REC 7.6.0 c)
    a('canteen', 'Canteen', 'personnel', {
      items: [
        i('Fans clean and operational', { scope: ['daily', 'weekly'] }),
        i('Dishwash basin clean, soap available', { scope: ['daily', 'weekly'] }),
        i('Fly catcher system on and working', { scope: ['daily', 'weekly'] }),
        i('Food lockers clean, only food stored inside, no spillages', { scope: ['daily', 'weekly'] }),
        i('Fridge clean', { scope: ['weekly'] }),
        i('Microwave clean', { scope: ['weekly'] }),
        i('Sinks clean, no dirty utensils', { scope: ['weekly'] }),
        i('Fire extinguisher clean', { scope: ['weekly'] }),
        i('Fly screens up', { scope: ['daily'] })
      ]
    }),

    a('locker-area', 'Locker Area / Change Rooms', 'personnel', {
      items: [
        i('PPE lockers neat and correctly organised', { scope: ['daily', 'weekly'] }),
        i('PPE stored correctly, no dirty PPE lying around', { scope: ['daily', 'weekly'] }),
        i('No gloves stored in lockers', { scope: ['weekly'] })
      ]
    }),

    a('toilets-mens', "Men's Toilets", 'personnel', {
      items: [
        i('Toilets clean and flushing', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'] }),
        i('Hand dryer clean and working', { scope: ['exec', 'daily', 'weekly'] })
      ]
    }),

    a('toilets-ladies', "Ladies' Toilets", 'personnel', {
      items: [
        i('Toilets clean and flushing', { freq: 'Daily', scope: ['exec', 'daily', 'weekly'] }),
        i('Hand dryer clean and working', { scope: ['exec', 'daily', 'weekly'] })
      ]
    }),

    a('hygiene-stations', 'Boot Wash / Soap / Paper Towel Stations', 'personnel', {
      standardChecks: false,
      items: [
        i('Boot wash stations filled with soap', { freq: 'Daily', scope: ['exec', 'daily'], chemical: 'Soap' }),
        i('Soap dispensers filled', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('Paper towel dispensers filled', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('Deep clean brooms, mops, squeegees, brushes and buckets', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] })
      ]
    }),

    a('refuse', 'Refuse Bins and Removal Area', 'personnel', {
      items: [
        i('Refuse bins emptied and clean', { freq: 'Daily', scope: ['exec', 'daily'] }),
        i('Refuse removal area clean', { freq: 'Daily', scope: ['exec', 'daily'] })
      ]
    }),

    a('chemical-room', 'Chemical Room', 'personnel', {
      items: [
        i('Chemical room locked', { scope: ['daily', 'weekly', 'summary'] }),
        i('Chemicals labelled', { scope: ['daily', 'weekly', 'summary'], note: 'Stock movements recorded on REC 7.6.4' })
      ]
    }),

    // ===================================================== DISPATCH (REC 7.6.2.2)
    a('dispatch', 'Dispatch / Loading Bay', 'dispatch', {
      role: 'OPERATOR',
      scope: ['exec', 'dispatch'],
      items: [
        i('Entrance area door closed', { scope: ['dispatch'] }),
        i('No damaged or dirty boxes or pallets', { scope: ['exec', 'dispatch'] }),
        i('No evidence of dust', { scope: ['dispatch'] }),
        i('Pallets not stacked on each other', { scope: ['dispatch'] }),
        i('Loading space clean, free from odours and mould growth', { scope: ['exec', 'dispatch'] }),
        i('No cans on the floor', { scope: ['dispatch'] }),
        i('Ventilation in the area adequate', { scope: ['dispatch'] }),
        i('Floors and walls clean', { scope: ['exec', 'dispatch'] }),
        i('Cleaning equipment stored correctly', { scope: ['dispatch'] })
      ]
    }),

    // ===================================================== EXTERNAL (REC 7.6.2)
    a('external', 'Building Exterior and Roof', 'external', {
      standardChecks: false,
      scope: ['exec', 'weekly', 'summary'],
      items: [
        i('Around outside of building', { freq: 'Weekly', scope: ['exec', 'weekly', 'summary'] }),
        i('Roof', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Outside alley walkway clean, no bird droppings', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('No pallets near bait station', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Outside area in front of roller door and loading bay', { freq: 'Weekly', scope: ['weekly', 'summary'] }),
        i('Fans and extractors', { freq: 'Monthly', scope: ['exec', 'weekly'], chemical: 'Soap', method: 'Remove the frame of the fan, wash off the dirt on the wall, brush the dust off the fan frame' })
      ]
    })
  ];

  // ------------------------------------------------------------------ derived views
  function areasForScope(scope) {
    return AREAS
      .map(function (ar) {
        const items = ar.items.filter(function (it) { return it.scope.indexOf(scope) !== -1; });
        if (!items.length && (ar.scope.indexOf(scope) === -1)) return null;
        if (!items.length && !ar.standardChecks) return null;
        return Object.assign({}, ar, { items: items });
      })
      .filter(Boolean);
  }

  function areasForZone(zone, scope) {
    return areasForScope(scope).filter(function (ar) { return ar.zone === zone; });
  }

  // Every food contact surface that needs objective (swab/ATP) verification, not just a look.
  function swabItems() {
    const out = [];
    AREAS.forEach(function (ar) {
      ar.items.forEach(function (it) {
        if (it.verify === SWAB) out.push({ area: ar.label, areaId: ar.id, item: it });
      });
    });
    return out;
  }

  // Items whose cleaning agent is not documented -- the FSSC gap list, computed not typed.
  function itemsMissingChemical() {
    const out = [];
    AREAS.forEach(function (ar) {
      ar.items.forEach(function (it) {
        if (it.fcs && !it.chemical) out.push({ area: ar.label, item: it.label });
      });
    });
    return out;
  }

  function counts() {
    let items = 0;
    AREAS.forEach(function (ar) { items += ar.items.length; });
    return {
      areas: AREAS.length,
      items: items,
      standardChecks: STANDARD_CHECKS.length,
      daily: areasForScope('daily').length,
      weekly: areasForScope('weekly').length
    };
  }

  window.CleaningMaster = {
    meta: {
      version: 1,
      standardChecksVersion: STANDARD_CHECKS_VERSION,
      sourceDocs: [
        'Master Cleaning Plan Rev 2 (28/02/2024)',
        'REC 7.6.0 a/b/c Rev 1 (eff. 24/06/2026)',
        'REC 7.6.1 Rev 4 (17/06/2026)',
        'REC 7.6.1.1 Rev 1 (01/06/2023)',
        'REC 7.6.2 Rev 4 (22/09/2022)',
        'REC 7.6.2.2 Rev 2 (13/09/2023)'
      ]
    },
    ZONES: ZONES,
    STANDARD_CHECKS: STANDARD_CHECKS,
    STANDARD_CHECKS_VERSION: STANDARD_CHECKS_VERSION,
    AREAS: AREAS,
    areasForScope: areasForScope,
    areasForZone: areasForZone,
    swabItems: swabItems,
    itemsMissingChemical: itemsMissingChemical,
    counts: counts
  };
})();
