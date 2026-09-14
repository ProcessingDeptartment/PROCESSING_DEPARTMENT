-- AlterTable
ALTER TABLE "sub_abalone_packing_specification" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "pcs",
ADD COLUMN     "pcs" DOUBLE PRECISION,
DROP COLUMN "drainedWeight",
ADD COLUMN     "drainedWeight" DOUBLE PRECISION,
DROP COLUMN "ingoWeight",
ADD COLUMN     "ingoWeight" DOUBLE PRECISION,
DROP COLUMN "minSpec",
ADD COLUMN     "minSpec" DOUBLE PRECISION,
DROP COLUMN "maxSpec",
ADD COLUMN     "maxSpec" DOUBLE PRECISION,
DROP COLUMN "cookoutPct",
ADD COLUMN     "cookoutPct" DOUBLE PRECISION,
DROP COLUMN "newMinIngo",
ADD COLUMN     "newMinIngo" DOUBLE PRECISION,
DROP COLUMN "newMaxIngo",
ADD COLUMN     "newMaxIngo" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_abalone_receiving" DROP COLUMN "receivingDate",
ADD COLUMN     "receivingDate" DATE,
DROP COLUMN "intakeWeight",
ADD COLUMN     "intakeWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_abalone_receiving_row" DROP COLUMN "basketNr",
ADD COLUMN     "basketNr" DOUBLE PRECISION,
DROP COLUMN "wholeWeight",
ADD COLUMN     "wholeWeight" DOUBLE PRECISION,
DROP COLUMN "farmCount",
ADD COLUMN     "farmCount" DOUBLE PRECISION,
DROP COLUMN "mortalityCount",
ADD COLUMN     "mortalityCount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_allergen_cleaning_verification" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "debrisInspection",
ADD COLUMN     "debrisInspection" BOOLEAN,
DROP COLUMN "equipmentCleaned",
ADD COLUMN     "equipmentCleaned" BOOLEAN,
DROP COLUMN "correctBrushwareUse",
ADD COLUMN     "correctBrushwareUse" BOOLEAN,
DROP COLUMN "protectiveClothingChanged",
ADD COLUMN     "protectiveClothingChanged" BOOLEAN,
DROP COLUMN "handsWashedGlovesChanged",
ADD COLUMN     "handsWashedGlovesChanged" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_basket_removal_shucking_gutting" DROP COLUMN "damagesOnFoot",
DROP COLUMN "foreignObjects",
DROP COLUMN "incomingTemp",
DROP COLUMN "noOfMortalities",
DROP COLUMN "signsOfParasites",
DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "damagesAfterShucking",
ADD COLUMN     "damagesAfterShucking" BOOLEAN,
DROP COLUMN "beakCutCorrect",
ADD COLUMN     "beakCutCorrect" BOOLEAN,
DROP COLUMN "damagesAfterGutting",
ADD COLUMN     "damagesAfterGutting" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_bleeding_and_salting" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfCrates",
ADD COLUMN     "noOfCrates" DOUBLE PRECISION,
DROP COLUMN "shuckWeight",
ADD COLUMN     "shuckWeight" DOUBLE PRECISION,
DROP COLUMN "saltKg",
ADD COLUMN     "saltKg" DOUBLE PRECISION,
DROP COLUMN "saltPercent",
ADD COLUMN     "saltPercent" DOUBLE PRECISION,
DROP COLUMN "bakingSodaG",
ADD COLUMN     "bakingSodaG" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_boiler_inspection_report" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "waterLevelChecked",
ADD COLUMN     "waterLevelChecked" BOOLEAN,
DROP COLUMN "airReleaseValveOpened",
ADD COLUMN     "airReleaseValveOpened" BOOLEAN,
DROP COLUMN "burnerSwitchedOn",
ADD COLUMN     "burnerSwitchedOn" BOOLEAN,
DROP COLUMN "burnerLowFire",
ADD COLUMN     "burnerLowFire" BOOLEAN,
DROP COLUMN "pressureChecked",
ADD COLUMN     "pressureChecked" BOOLEAN,
DROP COLUMN "mowbreyOpened",
ADD COLUMN     "mowbreyOpened" BOOLEAN,
DROP COLUMN "mainSteamValveOpened",
ADD COLUMN     "mainSteamValveOpened" BOOLEAN,
DROP COLUMN "burnerAdjustedHighToLow",
ADD COLUMN     "burnerAdjustedHighToLow" BOOLEAN,
DROP COLUMN "powerFailure",
ADD COLUMN     "powerFailure" BOOLEAN,
DROP COLUMN "boilerRestarted",
ADD COLUMN     "boilerRestarted" BOOLEAN,
DROP COLUMN "dieselReading",
ADD COLUMN     "dieselReading" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_boxing_and_labelling" DROP COLUMN "packingDate",
ADD COLUMN     "packingDate" DATE,
DROP COLUMN "tareWeight",
ADD COLUMN     "tareWeight" DOUBLE PRECISION,
DROP COLUMN "colourUniform",
ADD COLUMN     "colourUniform" BOOLEAN,
DROP COLUMN "correctSizeGrade",
ADD COLUMN     "correctSizeGrade" BOOLEAN,
DROP COLUMN "frillsPresent",
ADD COLUMN     "frillsPresent" BOOLEAN,
DROP COLUMN "bagAndBoxSealed",
ADD COLUMN     "bagAndBoxSealed" BOOLEAN,
DROP COLUMN "nettWeight",
ADD COLUMN     "nettWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_brine_mixing_report" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productionDateIngo",
ADD COLUMN     "productionDateIngo" DATE,
DROP COLUMN "canPieces",
ADD COLUMN     "canPieces" DOUBLE PRECISION,
DROP COLUMN "nettWeightMin",
ADD COLUMN     "nettWeightMin" DOUBLE PRECISION,
DROP COLUMN "drainMassMin",
ADD COLUMN     "drainMassMin" DOUBLE PRECISION,
DROP COLUMN "drainMassMax",
ADD COLUMN     "drainMassMax" DOUBLE PRECISION,
DROP COLUMN "saltG",
ADD COLUMN     "saltG" DOUBLE PRECISION,
DROP COLUMN "saltPercent",
ADD COLUMN     "saltPercent" DOUBLE PRECISION,
DROP COLUMN "sugarG",
ADD COLUMN     "sugarG" DOUBLE PRECISION,
DROP COLUMN "sugarPercent",
ADD COLUMN     "sugarPercent" DOUBLE PRECISION,
DROP COLUMN "maltG",
ADD COLUMN     "maltG" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_broth_cooking" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "waterLitres",
ADD COLUMN     "waterLitres" DOUBLE PRECISION,
DROP COLUMN "abaloneShellsIntakeDate",
ADD COLUMN     "abaloneShellsIntakeDate" DATE,
DROP COLUMN "driedKelpWeight",
ADD COLUMN     "driedKelpWeight" DOUBLE PRECISION,
DROP COLUMN "scallopJuiceWeight",
ADD COLUMN     "scallopJuiceWeight" DOUBLE PRECISION,
DROP COLUMN "finalBrothLitres",
ADD COLUMN     "finalBrothLitres" DOUBLE PRECISION,
DROP COLUMN "ph",
ADD COLUMN     "ph" DOUBLE PRECISION,
DROP COLUMN "salt",
ADD COLUMN     "salt" DOUBLE PRECISION,
DROP COLUMN "brix",
ADD COLUMN     "brix" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_can_filling_and_printing" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productTemp",
ADD COLUMN     "productTemp" DOUBLE PRECISION,
DROP COLUMN "nettWeightSpec",
ADD COLUMN     "nettWeightSpec" DOUBLE PRECISION,
DROP COLUMN "actualNettWeight",
ADD COLUMN     "actualNettWeight" DOUBLE PRECISION,
DROP COLUMN "printedBestBeforeDate",
ADD COLUMN     "printedBestBeforeDate" DATE,
DROP COLUMN "verifiedBeforePrinting",
ADD COLUMN     "verifiedBeforePrinting" BOOLEAN,
DROP COLUMN "verifiedAfterPrinting",
ADD COLUMN     "verifiedAfterPrinting" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_can_packing_control_sheet" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "ingoWeightSpec",
ADD COLUMN     "ingoWeightSpec" DOUBLE PRECISION,
DROP COLUMN "actualIngoWeight",
ADD COLUMN     "actualIngoWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_cans_incoming_inspection" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityReceived",
ADD COLUMN     "quantityReceived" DOUBLE PRECISION,
DROP COLUMN "productionDate",
ADD COLUMN     "productionDate" DATE,
DROP COLUMN "vehicleClean",
ADD COLUMN     "vehicleClean" BOOLEAN,
DROP COLUMN "noPestActivity",
ADD COLUMN     "noPestActivity" BOOLEAN,
DROP COLUMN "noNonFoodTransported",
ADD COLUMN     "noNonFoodTransported" BOOLEAN,
DROP COLUMN "noBrokenPalletsWetCans",
ADD COLUMN     "noBrokenPalletsWetCans" BOOLEAN,
DROP COLUMN "cansFromApprovedSupplier",
ADD COLUMN     "cansFromApprovedSupplier" BOOLEAN,
DROP COLUMN "qtyAccordingToOrder",
ADD COLUMN     "qtyAccordingToOrder" BOOLEAN,
DROP COLUMN "coaReceived",
ADD COLUMN     "coaReceived" BOOLEAN,
DROP COLUMN "seamOrFlangeDefects",
ADD COLUMN     "seamOrFlangeDefects" BOOLEAN,
DROP COLUMN "dentedScratchesDust",
ADD COLUMN     "dentedScratchesDust" BOOLEAN,
DROP COLUMN "rustedCans",
ADD COLUMN     "rustedCans" BOOLEAN,
DROP COLUMN "foreignMatter",
ADD COLUMN     "foreignMatter" BOOLEAN,
DROP COLUMN "pestInfestationSigns",
ADD COLUMN     "pestInfestationSigns" BOOLEAN,
DROP COLUMN "weldingDefects",
ADD COLUMN     "weldingDefects" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_cans_produced" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "canPieces",
ADD COLUMN     "canPieces" DOUBLE PRECISION,
DROP COLUMN "drainWeight",
ADD COLUMN     "drainWeight" DOUBLE PRECISION,
DROP COLUMN "numberOfCans",
ADD COLUMN     "numberOfCans" DOUBLE PRECISION,
DROP COLUMN "damagedCans",
ADD COLUMN     "damagedCans" DOUBLE PRECISION,
DROP COLUMN "totalDamagedCans",
ADD COLUMN     "totalDamagedCans" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_cans_released_form" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfPieces",
ADD COLUMN     "noOfPieces" DOUBLE PRECISION,
DROP COLUMN "noOfGrams",
ADD COLUMN     "noOfGrams" DOUBLE PRECISION,
DROP COLUMN "noOfCans",
ADD COLUMN     "noOfCans" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_chemical_stock_issue_register" DROP COLUMN "msdsAvailable",
ADD COLUMN     "msdsAvailable" BOOLEAN,
DROP COLUMN "expiryDate",
ADD COLUMN     "expiryDate" DATE,
DROP COLUMN "dateOfIssue",
ADD COLUMN     "dateOfIssue" DATE,
DROP COLUMN "quantityIssued",
ADD COLUMN     "quantityIssued" DOUBLE PRECISION,
DROP COLUMN "areaToBeCleaned",
ADD COLUMN     "areaToBeCleaned" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_chiller_batch_control" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "traysClearlyMarked",
ADD COLUMN     "traysClearlyMarked" BOOLEAN,
DROP COLUMN "noOfTrays",
ADD COLUMN     "noOfTrays" DOUBLE PRECISION,
DROP COLUMN "chillerTemp",
ADD COLUMN     "chillerTemp" DOUBLE PRECISION,
DROP COLUMN "totalDaysInChiller",
ADD COLUMN     "totalDaysInChiller" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_chiller_temperature_monitoring" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productCovered",
ADD COLUMN     "productCovered" BOOLEAN,
DROP COLUMN "chiller1DialTemp",
ADD COLUMN     "chiller1DialTemp" DOUBLE PRECISION,
DROP COLUMN "chiller1ProductTemp",
ADD COLUMN     "chiller1ProductTemp" DOUBLE PRECISION,
DROP COLUMN "chiller2DialTemp",
ADD COLUMN     "chiller2DialTemp" DOUBLE PRECISION,
DROP COLUMN "chiller2ProductTemp",
ADD COLUMN     "chiller2ProductTemp" DOUBLE PRECISION,
DROP COLUMN "freezerDialTemp",
ADD COLUMN     "freezerDialTemp" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_daily_cleaning_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_daily_cleaning_inspection_row" DROP COLUMN "status",
ADD COLUMN     "val_status" TEXT;

-- AlterTable
ALTER TABLE "sub_daily_equipment_checklist" DROP COLUMN "weekOf",
ADD COLUMN     "weekOf" DATE;

-- AlterTable
ALTER TABLE "sub_daily_equipment_checklist_row" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_daily_factory_feedback_meeting" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "seamProblem",
ADD COLUMN     "seamProblem" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_daily_factory_feedback_meeting_row" DROP COLUMN "present",
ADD COLUMN     "present" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_daily_waste_removal" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_deep_cleaning_record_weekly" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_deep_cleaning_record_weekly_row" DROP COLUMN "status",
ADD COLUMN     "val_status" TEXT;

-- AlterTable
ALTER TABLE "sub_dispatch_cleaning_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "entranceDoorClosed",
ADD COLUMN     "entranceDoorClosed" BOOLEAN,
DROP COLUMN "damagedDirtyBoxesPallets",
ADD COLUMN     "damagedDirtyBoxesPallets" BOOLEAN,
DROP COLUMN "evidenceOfDust",
ADD COLUMN     "evidenceOfDust" BOOLEAN,
DROP COLUMN "palletsStackedOnEachOther",
ADD COLUMN     "palletsStackedOnEachOther" BOOLEAN,
DROP COLUMN "loadingSpaceClean",
ADD COLUMN     "loadingSpaceClean" BOOLEAN,
DROP COLUMN "noCansOnFloor",
ADD COLUMN     "noCansOnFloor" BOOLEAN,
DROP COLUMN "ventilationOk",
ADD COLUMN     "ventilationOk" BOOLEAN,
DROP COLUMN "floorsWallsClean",
ADD COLUMN     "floorsWallsClean" BOOLEAN,
DROP COLUMN "cleaningEquipmentStoredCorrectly",
ADD COLUMN     "cleaningEquipmentStoredCorrectly" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_dispatch_loading_inspection_checklist" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfPalletsBoxes",
ADD COLUMN     "noOfPalletsBoxes" DOUBLE PRECISION,
DROP COLUMN "outerCartonSealed",
ADD COLUMN     "outerCartonSealed" BOOLEAN,
DROP COLUMN "damagedDirtyBoxesPallets",
ADD COLUMN     "damagedDirtyBoxesPallets" BOOLEAN,
DROP COLUMN "damagedStockLoaded",
ADD COLUMN     "damagedStockLoaded" BOOLEAN,
DROP COLUMN "pestInfestationStock",
ADD COLUMN     "pestInfestationStock" BOOLEAN,
DROP COLUMN "loadingSpaceClean",
ADD COLUMN     "loadingSpaceClean" BOOLEAN,
DROP COLUMN "stockNotLoadedWithNonFood",
ADD COLUMN     "stockNotLoadedWithNonFood" BOOLEAN,
DROP COLUMN "stockLoadedAsPerSalesOrder",
ADD COLUMN     "stockLoadedAsPerSalesOrder" BOOLEAN,
DROP COLUMN "truckSecuredLocked",
ADD COLUMN     "truckSecuredLocked" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_dispatch_receiving_checklist" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfPalletsBoxes",
ADD COLUMN     "noOfPalletsBoxes" DOUBLE PRECISION,
DROP COLUMN "outerCartonSealed",
ADD COLUMN     "outerCartonSealed" BOOLEAN,
DROP COLUMN "damagedDirtyBoxesPallets",
ADD COLUMN     "damagedDirtyBoxesPallets" BOOLEAN,
DROP COLUMN "damagedStockLoaded",
ADD COLUMN     "damagedStockLoaded" BOOLEAN,
DROP COLUMN "pestInfestationStock",
ADD COLUMN     "pestInfestationStock" BOOLEAN,
DROP COLUMN "loadingSpaceClean",
ADD COLUMN     "loadingSpaceClean" BOOLEAN,
DROP COLUMN "stockNotLoadedWithNonFood",
ADD COLUMN     "stockNotLoadedWithNonFood" BOOLEAN,
DROP COLUMN "rustDentSigns",
ADD COLUMN     "rustDentSigns" BOOLEAN,
DROP COLUMN "truckSecuredLocked",
ADD COLUMN     "truckSecuredLocked" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_disposition_investigation_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "hazardsReducedAcceptable",
ADD COLUMN     "hazardsReducedAcceptable" BOOLEAN,
DROP COLUMN "controlMeasuresEffective",
ADD COLUMN     "controlMeasuresEffective" BOOLEAN,
DROP COLUMN "productStillMeetsLevel",
ADD COLUMN     "productStillMeetsLevel" BOOLEAN,
DROP COLUMN "isolatedToSingleItem",
ADD COLUMN     "isolatedToSingleItem" BOOLEAN,
DROP COLUMN "potentiallyUnsafe",
ADD COLUMN     "potentiallyUnsafe" BOOLEAN,
DROP COLUMN "allProductStillOnSite",
ADD COLUMN     "allProductStillOnSite" BOOLEAN,
DROP COLUMN "analysisCanDemonstrateSafety",
ADD COLUMN     "analysisCanDemonstrateSafety" BOOLEAN,
DROP COLUMN "clientsContactedForWithdrawal",
ADD COLUMN     "clientsContactedForWithdrawal" BOOLEAN,
DROP COLUMN "dispositionNecessary",
ADD COLUMN     "dispositionNecessary" BOOLEAN,
DROP COLUMN "quarantinedSegregated",
ADD COLUMN     "quarantinedSegregated" BOOLEAN,
DROP COLUMN "dispositionDeemedNecessary",
ADD COLUMN     "dispositionDeemedNecessary" BOOLEAN,
DROP COLUMN "allPartiesNotified",
ADD COLUMN     "allPartiesNotified" BOOLEAN,
DROP COLUMN "dateReviewed",
ADD COLUMN     "dateReviewed" DATE;

-- AlterTable
ALTER TABLE "sub_dried_abalone_transfer" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "intakeWeight",
ADD COLUMN     "intakeWeight" DOUBLE PRECISION,
DROP COLUMN "actualDriedDate",
ADD COLUMN     "actualDriedDate" DATE,
DROP COLUMN "totalDriedWeight",
ADD COLUMN     "totalDriedWeight" DOUBLE PRECISION,
DROP COLUMN "dryYield",
ADD COLUMN     "dryYield" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dried_abalone_transfer_row" DROP COLUMN "crateNumber",
ADD COLUMN     "crateNumber" DOUBLE PRECISION,
DROP COLUMN "weight",
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_chiller_batch_control" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "traysClearlyMarked",
ADD COLUMN     "traysClearlyMarked" BOOLEAN,
DROP COLUMN "noOfTrays",
ADD COLUMN     "noOfTrays" DOUBLE PRECISION,
DROP COLUMN "productTemp",
ADD COLUMN     "productTemp" DOUBLE PRECISION,
DROP COLUMN "chillerTemp",
ADD COLUMN     "chillerTemp" DOUBLE PRECISION,
DROP COLUMN "totalDaysInChiller",
ADD COLUMN     "totalDaysInChiller" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_cooking" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "cookingDate",
ADD COLUMN     "cookingDate" DATE,
DROP COLUMN "abaloneKg",
ADD COLUMN     "abaloneKg" DOUBLE PRECISION,
DROP COLUMN "blanchSeaWater",
ADD COLUMN     "blanchSeaWater" DOUBLE PRECISION,
DROP COLUMN "blanchPh",
ADD COLUMN     "blanchPh" DOUBLE PRECISION,
DROP COLUMN "blanchSaltKg",
ADD COLUMN     "blanchSaltKg" DOUBLE PRECISION,
DROP COLUMN "blanchTemp",
ADD COLUMN     "blanchTemp" DOUBLE PRECISION,
DROP COLUMN "startingTemp",
ADD COLUMN     "startingTemp" DOUBLE PRECISION,
DROP COLUMN "temp20MinAfter",
ADD COLUMN     "temp20MinAfter" DOUBLE PRECISION,
DROP COLUMN "endOfCookingTemp",
ADD COLUMN     "endOfCookingTemp" DOUBLE PRECISION,
DROP COLUMN "cookSeaWater",
ADD COLUMN     "cookSeaWater" DOUBLE PRECISION,
DROP COLUMN "cookPh",
ADD COLUMN     "cookPh" DOUBLE PRECISION,
DROP COLUMN "saltKg",
ADD COLUMN     "saltKg" DOUBLE PRECISION,
DROP COLUMN "sugarKg",
ADD COLUMN     "sugarKg" DOUBLE PRECISION,
DROP COLUMN "vinegarKg",
ADD COLUMN     "vinegarKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_export_pack_front_page" DROP COLUMN "packingDate",
ADD COLUMN     "packingDate" DATE,
DROP COLUMN "noOfBoxesExported",
ADD COLUMN     "noOfBoxesExported" DOUBLE PRECISION,
DROP COLUMN "rec747Attached",
ADD COLUMN     "rec747Attached" BOOLEAN,
DROP COLUMN "rec748Attached",
ADD COLUMN     "rec748Attached" BOOLEAN,
DROP COLUMN "rec749Attached",
ADD COLUMN     "rec749Attached" BOOLEAN,
DROP COLUMN "signedPackingListsAttached",
ADD COLUMN     "signedPackingListsAttached" BOOLEAN,
DROP COLUMN "healthCertificatesAttached",
ADD COLUMN     "healthCertificatesAttached" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_dry_labelling_list" DROP COLUMN "etd",
ADD COLUMN     "etd" DATE,
DROP COLUMN "nettWeight",
ADD COLUMN     "nettWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_labelling_list_row" DROP COLUMN "boxNo",
ADD COLUMN     "boxNo" DOUBLE PRECISION,
DROP COLUMN "weight",
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_monitoring" DROP COLUMN "intakeWeight",
ADD COLUMN     "intakeWeight" DOUBLE PRECISION,
DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "cookingDate",
ADD COLUMN     "cookingDate" DATE,
DROP COLUMN "noOfTrolleys",
ADD COLUMN     "noOfTrolleys" DOUBLE PRECISION,
DROP COLUMN "trolleysClearlyMarked",
ADD COLUMN     "trolleysClearlyMarked" BOOLEAN,
DROP COLUMN "estimatedDryDate",
ADD COLUMN     "estimatedDryDate" DATE,
DROP COLUMN "mouldVisible",
ADD COLUMN     "mouldVisible" BOOLEAN,
DROP COLUMN "whiteSaltOnSurface",
ADD COLUMN     "whiteSaltOnSurface" BOOLEAN,
DROP COLUMN "caseHardening",
ADD COLUMN     "caseHardening" BOOLEAN,
DROP COLUMN "surfaceShine",
ADD COLUMN     "surfaceShine" BOOLEAN,
DROP COLUMN "footDamage",
ADD COLUMN     "footDamage" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_dry_nrcs_packs" DROP COLUMN "receivingDate",
ADD COLUMN     "receivingDate" DATE,
DROP COLUMN "dateOfInspection",
ADD COLUMN     "dateOfInspection" DATE;

-- AlterTable
ALTER TABLE "sub_dry_room_temp_humidity_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "startShiftTemp",
ADD COLUMN     "startShiftTemp" DOUBLE PRECISION,
DROP COLUMN "startShiftHumidity",
ADD COLUMN     "startShiftHumidity" DOUBLE PRECISION,
DROP COLUMN "duringProdTemp",
ADD COLUMN     "duringProdTemp" DOUBLE PRECISION,
DROP COLUMN "duringProdHumidity",
ADD COLUMN     "duringProdHumidity" DOUBLE PRECISION,
DROP COLUMN "endShiftTemp",
ADD COLUMN     "endShiftTemp" DOUBLE PRECISION,
DROP COLUMN "endShiftHumidity",
ADD COLUMN     "endShiftHumidity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_stock_control" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "wholeWeight",
ADD COLUMN     "wholeWeight" DOUBLE PRECISION,
DROP COLUMN "cookingDate",
ADD COLUMN     "cookingDate" DATE,
DROP COLUMN "noOfTrolleys",
ADD COLUMN     "noOfTrolleys" DOUBLE PRECISION,
DROP COLUMN "weightIn",
ADD COLUMN     "weightIn" DOUBLE PRECISION,
DROP COLUMN "dateIn",
ADD COLUMN     "dateIn" DATE,
DROP COLUMN "countInFactory",
ADD COLUMN     "countInFactory" DOUBLE PRECISION,
DROP COLUMN "countInFinance",
ADD COLUMN     "countInFinance" DOUBLE PRECISION,
DROP COLUMN "weightOut",
ADD COLUMN     "weightOut" DOUBLE PRECISION,
DROP COLUMN "dateOut",
ADD COLUMN     "dateOut" DATE,
DROP COLUMN "countOutFactory",
ADD COLUMN     "countOutFactory" DOUBLE PRECISION,
DROP COLUMN "countOutFinance",
ADD COLUMN     "countOutFinance" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_dry_stock_transfers" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfBoxes",
ADD COLUMN     "noOfBoxes" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_drying_process" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "wholeWeight",
ADD COLUMN     "wholeWeight" DOUBLE PRECISION,
DROP COLUMN "cookingDate",
ADD COLUMN     "cookingDate" DATE,
DROP COLUMN "cookingWeight",
ADD COLUMN     "cookingWeight" DOUBLE PRECISION,
DROP COLUMN "movementToDryRoom1Date",
ADD COLUMN     "movementToDryRoom1Date" DATE,
DROP COLUMN "steam1Date",
ADD COLUMN     "steam1Date" DATE,
DROP COLUMN "steam2Date",
ADD COLUMN     "steam2Date" DATE,
DROP COLUMN "steam3Date",
ADD COLUMN     "steam3Date" DATE,
DROP COLUMN "steam4Date",
ADD COLUMN     "steam4Date" DATE,
DROP COLUMN "steam5Date",
ADD COLUMN     "steam5Date" DATE,
DROP COLUMN "steam6Date",
ADD COLUMN     "steam6Date" DATE,
DROP COLUMN "steam7Date",
ADD COLUMN     "steam7Date" DATE,
DROP COLUMN "steam8Date",
ADD COLUMN     "steam8Date" DATE,
DROP COLUMN "steam9Date",
ADD COLUMN     "steam9Date" DATE,
DROP COLUMN "steam10Date",
ADD COLUMN     "steam10Date" DATE,
DROP COLUMN "steam11Date",
ADD COLUMN     "steam11Date" DATE,
DROP COLUMN "steam12Date",
ADD COLUMN     "steam12Date" DATE,
DROP COLUMN "steam13Date",
ADD COLUMN     "steam13Date" DATE,
DROP COLUMN "steam14Date",
ADD COLUMN     "steam14Date" DATE,
DROP COLUMN "movementToContainerDate",
ADD COLUMN     "movementToContainerDate" DATE,
DROP COLUMN "removedFromTrolleysDate",
ADD COLUMN     "removedFromTrolleysDate" DATE,
DROP COLUMN "movementToGradingRoomDate",
ADD COLUMN     "movementToGradingRoomDate" DATE,
DROP COLUMN "dateDeString",
ADD COLUMN     "dateDeString" DATE,
DROP COLUMN "dateGraded",
ADD COLUMN     "dateGraded" DATE,
DROP COLUMN "totalDryingTimeDays",
ADD COLUMN     "totalDryingTimeDays" DOUBLE PRECISION,
DROP COLUMN "dryWeight",
ADD COLUMN     "dryWeight" DOUBLE PRECISION,
DROP COLUMN "estimateYield",
ADD COLUMN     "estimateYield" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_emergency_evacuation_attendance_register" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_equipment_checklist_roof" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_facility_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_facility_inspection_nc_report" DROP COLUMN "inspectionDate",
ADD COLUMN     "inspectionDate" DATE,
DROP COLUMN "verificationDate",
ADD COLUMN     "verificationDate" DATE;

-- AlterTable
ALTER TABLE "sub_facility_inspection_nc_report_row" DROP COLUMN "targetDate",
ADD COLUMN     "targetDate" DATE,
DROP COLUMN "actualDateCompleted",
ADD COLUMN     "actualDateCompleted" DATE;

-- AlterTable
ALTER TABLE "sub_factory_maintenance_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_final_sauce_mix" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "ph",
ADD COLUMN     "ph" DOUBLE PRECISION,
DROP COLUMN "salt",
ADD COLUMN     "salt" DOUBLE PRECISION,
DROP COLUMN "brix",
ADD COLUMN     "brix" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_first_aid_checklist_record" DROP COLUMN "dateOfIncident",
ADD COLUMN     "dateOfIncident" DATE,
DROP COLUMN "intact",
ADD COLUMN     "intact" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_fixed_reader_checks" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "itemNo",
ADD COLUMN     "itemNo" DOUBLE PRECISION,
DROP COLUMN "qdeMatch",
ADD COLUMN     "qdeMatch" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_glass_breakage_clearance_certificate" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "finishedProductContaminated",
ADD COLUMN     "finishedProductContaminated" BOOLEAN,
DROP COLUMN "rawMaterialContaminated",
ADD COLUMN     "rawMaterialContaminated" BOOLEAN,
DROP COLUMN "packagingContaminated",
ADD COLUMN     "packagingContaminated" BOOLEAN,
DROP COLUMN "machineEquipContaminated",
ADD COLUMN     "machineEquipContaminated" BOOLEAN,
DROP COLUMN "areaIsolated",
ADD COLUMN     "areaIsolated" BOOLEAN,
DROP COLUMN "areasEquipmentCleaned",
ADD COLUMN     "areasEquipmentCleaned" BOOLEAN,
DROP COLUMN "clothingFootwearChecked",
ADD COLUMN     "clothingFootwearChecked" BOOLEAN,
DROP COLUMN "clothingContainedRemoved",
ADD COLUMN     "clothingContainedRemoved" BOOLEAN,
DROP COLUMN "staffExcluded",
ADD COLUMN     "staffExcluded" BOOLEAN,
DROP COLUMN "cleaningEquipmentDiscarded",
ADD COLUMN     "cleaningEquipmentDiscarded" BOOLEAN,
DROP COLUMN "minCleanersUsed",
ADD COLUMN     "minCleanersUsed" BOOLEAN,
DROP COLUMN "glassSampleRetained",
ADD COLUMN     "glassSampleRetained" BOOLEAN,
DROP COLUMN "allFragmentsRemoved",
ADD COLUMN     "allFragmentsRemoved" BOOLEAN,
DROP COLUMN "affectedMaterialIsolated",
ADD COLUMN     "affectedMaterialIsolated" BOOLEAN,
DROP COLUMN "areaInspectedAfterCleaning",
ADD COLUMN     "areaInspectedAfterCleaning" BOOLEAN,
DROP COLUMN "contaminatedProductDiscarded",
ADD COLUMN     "contaminatedProductDiscarded" BOOLEAN,
DROP COLUMN "safeToRestart",
ADD COLUMN     "safeToRestart" BOOLEAN,
DROP COLUMN "carCompleted",
ADD COLUMN     "carCompleted" BOOLEAN,
DROP COLUMN "rootCauseIdentified",
ADD COLUMN     "rootCauseIdentified" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_glass_breakage_clearance_certificate_row" DROP COLUMN "qty",
ADD COLUMN     "qty" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_glass_plastic_equipment_inspection" DROP COLUMN "weekOf",
ADD COLUMN     "weekOf" DATE;

-- AlterTable
ALTER TABLE "sub_glove_issuing_register" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityIssued",
ADD COLUMN     "quantityIssued" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_goggles_register" DROP COLUMN "weekStarting",
ADD COLUMN     "weekStarting" DATE;

-- AlterTable
ALTER TABLE "sub_gonad_inspection_report" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_grading_boxing_traceability" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "dateCreated",
ADD COLUMN     "dateCreated" DATE;

-- AlterTable
ALTER TABLE "sub_grading_production_log_cultivated" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "driedWeightReceived",
ADD COLUMN     "driedWeightReceived" DOUBLE PRECISION,
DROP COLUMN "actualDriedWeight",
ADD COLUMN     "actualDriedWeight" DOUBLE PRECISION,
DROP COLUMN "dateIntoGradingRoom",
ADD COLUMN     "dateIntoGradingRoom" DATE,
DROP COLUMN "gradingDate",
ADD COLUMN     "gradingDate" DATE,
DROP COLUMN "under8g",
ADD COLUMN     "under8g" DOUBLE PRECISION,
DROP COLUMN "g8to10",
ADD COLUMN     "g8to10" DOUBLE PRECISION,
DROP COLUMN "g11to13",
ADD COLUMN     "g11to13" DOUBLE PRECISION,
DROP COLUMN "g14to16",
ADD COLUMN     "g14to16" DOUBLE PRECISION,
DROP COLUMN "g17to20",
ADD COLUMN     "g17to20" DOUBLE PRECISION,
DROP COLUMN "g21to23",
ADD COLUMN     "g21to23" DOUBLE PRECISION,
DROP COLUMN "g24to25",
ADD COLUMN     "g24to25" DOUBLE PRECISION,
DROP COLUMN "g26to28",
ADD COLUMN     "g26to28" DOUBLE PRECISION,
DROP COLUMN "g29to31",
ADD COLUMN     "g29to31" DOUBLE PRECISION,
DROP COLUMN "g32to35",
ADD COLUMN     "g32to35" DOUBLE PRECISION,
DROP COLUMN "g36to39",
ADD COLUMN     "g36to39" DOUBLE PRECISION,
DROP COLUMN "g40to44",
ADD COLUMN     "g40to44" DOUBLE PRECISION,
DROP COLUMN "g45to50",
ADD COLUMN     "g45to50" DOUBLE PRECISION,
DROP COLUMN "g51to55",
ADD COLUMN     "g51to55" DOUBLE PRECISION,
DROP COLUMN "g56to60",
ADD COLUMN     "g56to60" DOUBLE PRECISION,
DROP COLUMN "g60plus",
ADD COLUMN     "g60plus" DOUBLE PRECISION,
DROP COLUMN "bGrade",
ADD COLUMN     "bGrade" DOUBLE PRECISION,
DROP COLUMN "actualGradedWeight",
ADD COLUMN     "actualGradedWeight" DOUBLE PRECISION,
DROP COLUMN "yield",
ADD COLUMN     "yield" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_grading_production_log_cultivated_row" DROP COLUMN "binWeightStart",
ADD COLUMN     "binWeightStart" DOUBLE PRECISION,
DROP COLUMN "fullBoxWeight",
ADD COLUMN     "fullBoxWeight" DOUBLE PRECISION,
DROP COLUMN "finalBinWeight",
ADD COLUMN     "finalBinWeight" DOUBLE PRECISION,
DROP COLUMN "gradedWeight",
ADD COLUMN     "gradedWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_grading_production_log_ranched" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "driedWeightReceived",
ADD COLUMN     "driedWeightReceived" DOUBLE PRECISION,
DROP COLUMN "actualDriedWeight",
ADD COLUMN     "actualDriedWeight" DOUBLE PRECISION,
DROP COLUMN "dateIntoGradingRoom",
ADD COLUMN     "dateIntoGradingRoom" DATE,
DROP COLUMN "gradingDate",
ADD COLUMN     "gradingDate" DATE,
DROP COLUMN "under50g",
ADD COLUMN     "under50g" DOUBLE PRECISION,
DROP COLUMN "g51to80",
ADD COLUMN     "g51to80" DOUBLE PRECISION,
DROP COLUMN "g81to100",
ADD COLUMN     "g81to100" DOUBLE PRECISION,
DROP COLUMN "g101to150",
ADD COLUMN     "g101to150" DOUBLE PRECISION,
DROP COLUMN "g151to200",
ADD COLUMN     "g151to200" DOUBLE PRECISION,
DROP COLUMN "g200plus",
ADD COLUMN     "g200plus" DOUBLE PRECISION,
DROP COLUMN "darkUnder100g",
ADD COLUMN     "darkUnder100g" DOUBLE PRECISION,
DROP COLUMN "dark100gPlus",
ADD COLUMN     "dark100gPlus" DOUBLE PRECISION,
DROP COLUMN "bGrade",
ADD COLUMN     "bGrade" DOUBLE PRECISION,
DROP COLUMN "actualGradedWeight",
ADD COLUMN     "actualGradedWeight" DOUBLE PRECISION,
DROP COLUMN "yield",
ADD COLUMN     "yield" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_grading_production_log_ranched_row" DROP COLUMN "binWeightStart",
ADD COLUMN     "binWeightStart" DOUBLE PRECISION,
DROP COLUMN "fullBoxWeight",
ADD COLUMN     "fullBoxWeight" DOUBLE PRECISION,
DROP COLUMN "finalBinWeight",
ADD COLUMN     "finalBinWeight" DOUBLE PRECISION,
DROP COLUMN "gradedWeight",
ADD COLUMN     "gradedWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_grading_room_temp_humidity_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "startShiftTemp",
ADD COLUMN     "startShiftTemp" DOUBLE PRECISION,
DROP COLUMN "startShiftHumidity",
ADD COLUMN     "startShiftHumidity" DOUBLE PRECISION,
DROP COLUMN "duringProdTemp",
ADD COLUMN     "duringProdTemp" DOUBLE PRECISION,
DROP COLUMN "duringProdHumidity",
ADD COLUMN     "duringProdHumidity" DOUBLE PRECISION,
DROP COLUMN "endShiftTemp",
ADD COLUMN     "endShiftTemp" DOUBLE PRECISION,
DROP COLUMN "endShiftHumidity",
ADD COLUMN     "endShiftHumidity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_handling_of_emergencies_and_incidences" DROP COLUMN "foreignMatterSigns",
ADD COLUMN     "foreignMatterSigns" BOOLEAN,
DROP COLUMN "dryCookingWithinSpec",
ADD COLUMN     "dryCookingWithinSpec" BOOLEAN,
DROP COLUMN "retortReportWithinSpec",
ADD COLUMN     "retortReportWithinSpec" BOOLEAN,
DROP COLUMN "hygieneInspectionAfterDrill",
ADD COLUMN     "hygieneInspectionAfterDrill" BOOLEAN,
DROP COLUMN "ppeChangedAfterEvacuation",
ADD COLUMN     "ppeChangedAfterEvacuation" BOOLEAN,
DROP COLUMN "completedDate",
ADD COLUMN     "completedDate" DATE,
DROP COLUMN "verifiedDate",
ADD COLUMN     "verifiedDate" DATE;

-- AlterTable
ALTER TABLE "sub_incoming_goods_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityReceived",
ADD COLUMN     "quantityReceived" DOUBLE PRECISION,
DROP COLUMN "expiryDate",
ADD COLUMN     "expiryDate" DATE,
DROP COLUMN "coaReceived",
ADD COLUMN     "coaReceived" BOOLEAN,
DROP COLUMN "fromApprovedSupplier",
ADD COLUMN     "fromApprovedSupplier" BOOLEAN,
DROP COLUMN "receivedAccordingToOrder",
ADD COLUMN     "receivedAccordingToOrder" BOOLEAN,
DROP COLUMN "vehicleConditionAcceptable",
ADD COLUMN     "vehicleConditionAcceptable" BOOLEAN,
DROP COLUMN "pestSignsInVehicle",
ADD COLUMN     "pestSignsInVehicle" BOOLEAN,
DROP COLUMN "foreignObjectsRisk",
ADD COLUMN     "foreignObjectsRisk" BOOLEAN,
DROP COLUMN "contaminatingProductsTransported",
ADD COLUMN     "contaminatingProductsTransported" BOOLEAN,
DROP COLUMN "packagedLabelledCorrectly",
ADD COLUMN     "packagedLabelledCorrectly" BOOLEAN,
DROP COLUMN "conformsToSpecification",
ADD COLUMN     "conformsToSpecification" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_incoming_goods_inspection_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "approvedSupplier",
ADD COLUMN     "approvedSupplier" BOOLEAN,
DROP COLUMN "quantity",
ADD COLUMN     "quantity" DOUBLE PRECISION,
DROP COLUMN "carRequired",
ADD COLUMN     "carRequired" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_incoming_ppe_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "approvedSupplier",
ADD COLUMN     "approvedSupplier" BOOLEAN,
DROP COLUMN "quantity",
ADD COLUMN     "quantity" DOUBLE PRECISION,
DROP COLUMN "carRequired",
ADD COLUMN     "carRequired" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_incubator_cans_log" DROP COLUMN "dateIn",
ADD COLUMN     "dateIn" TIMESTAMP(3),
DROP COLUMN "pieces",
ADD COLUMN     "pieces" INTEGER,
DROP COLUMN "quantity",
ADD COLUMN     "quantity" INTEGER,
DROP COLUMN "dateOutForMicro",
ADD COLUMN     "dateOutForMicro" TIMESTAMP(3),
DROP COLUMN "qtyOutForTesting",
ADD COLUMN     "qtyOutForTesting" INTEGER,
DROP COLUMN "productCleared",
ADD COLUMN     "productCleared" BOOLEAN,
DROP COLUMN "dateCleared",
ADD COLUMN     "dateCleared" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sub_incubator_temperature_check" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "startShiftTemp",
ADD COLUMN     "startShiftTemp" DOUBLE PRECISION,
DROP COLUMN "lunchTemp",
ADD COLUMN     "lunchTemp" DOUBLE PRECISION,
DROP COLUMN "endShiftTemp",
ADD COLUMN     "endShiftTemp" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_individual_abalone_weight_checks" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_individual_abalone_weight_checks_row" DROP COLUMN "approved",
ADD COLUMN     "approved" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_ingredient_weighing" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "chickenFlavourWeight",
ADD COLUMN     "chickenFlavourWeight" DOUBLE PRECISION,
DROP COLUMN "vegetableBaseWeight",
ADD COLUMN     "vegetableBaseWeight" DOUBLE PRECISION,
DROP COLUMN "gelatineWeight",
ADD COLUMN     "gelatineWeight" DOUBLE PRECISION,
DROP COLUMN "xanthanGumWeight",
ADD COLUMN     "xanthanGumWeight" DOUBLE PRECISION,
DROP COLUMN "maltSugarWeight",
ADD COLUMN     "maltSugarWeight" DOUBLE PRECISION,
DROP COLUMN "tapiocaStarchWeight",
ADD COLUMN     "tapiocaStarchWeight" DOUBLE PRECISION,
DROP COLUMN "brownSugarWeight",
ADD COLUMN     "brownSugarWeight" DOUBLE PRECISION,
DROP COLUMN "sherloneSauceWeight",
ADD COLUMN     "sherloneSauceWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_internal_car" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "closeDate",
ADD COLUMN     "closeDate" DATE,
DROP COLUMN "verifiedDate",
ADD COLUMN     "verifiedDate" DATE;

-- AlterTable
ALTER TABLE "sub_internal_pest_sightings_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "carCompleted",
ADD COLUMN     "carCompleted" BOOLEAN,
DROP COLUMN "pestControlCompanyNotified",
ADD COLUMN     "pestControlCompanyNotified" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_knife_register" DROP COLUMN "weekStarting",
ADD COLUMN     "weekStarting" DATE;

-- AlterTable
ALTER TABLE "sub_knife_register_row" DROP COLUMN "issued",
ADD COLUMN     "issued" BOOLEAN,
DROP COLUMN "returned",
ADD COLUMN     "returned" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_labelling_of_cans" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityLabelsIssued",
ADD COLUMN     "quantityLabelsIssued" DOUBLE PRECISION,
DROP COLUMN "quantityIssued",
ADD COLUMN     "quantityIssued" DOUBLE PRECISION,
DROP COLUMN "boxesFull",
ADD COLUMN     "boxesFull" BOOLEAN,
DROP COLUMN "cansCheckedBeforeLabelling",
ADD COLUMN     "cansCheckedBeforeLabelling" BOOLEAN,
DROP COLUMN "cansCheckedAfterLabelling",
ADD COLUMN     "cansCheckedAfterLabelling" BOOLEAN,
DROP COLUMN "correctLabelUsed",
ADD COLUMN     "correctLabelUsed" BOOLEAN,
DROP COLUMN "labellingRequirementCorrect",
ADD COLUMN     "labellingRequirementCorrect" BOOLEAN,
DROP COLUMN "cartonLabelsCorrespond",
ADD COLUMN     "cartonLabelsCorrespond" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_labelling_of_dry_boxes" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityOfBoxes",
ADD COLUMN     "quantityOfBoxes" DOUBLE PRECISION,
DROP COLUMN "agCodeMatchesInspection",
ADD COLUMN     "agCodeMatchesInspection" BOOLEAN,
DROP COLUMN "sizeRangeCorrectAcrossBoxes",
ADD COLUMN     "sizeRangeCorrectAcrossBoxes" BOOLEAN,
DROP COLUMN "boxCountMatchesPackingList",
ADD COLUMN     "boxCountMatchesPackingList" BOOLEAN,
DROP COLUMN "addressMatchesPackingList",
ADD COLUMN     "addressMatchesPackingList" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_lha_water_monitoring" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "chillerUnitOperating",
ADD COLUMN     "chillerUnitOperating" BOOLEAN,
DROP COLUMN "temperature",
ADD COLUMN     "temperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_lids_incoming_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityReceived",
ADD COLUMN     "quantityReceived" DOUBLE PRECISION,
DROP COLUMN "vehicleClean",
ADD COLUMN     "vehicleClean" BOOLEAN,
DROP COLUMN "noPestActivity",
ADD COLUMN     "noPestActivity" BOOLEAN,
DROP COLUMN "noNonFoodTransported",
ADD COLUMN     "noNonFoodTransported" BOOLEAN,
DROP COLUMN "noBrokenPalletsWetCans",
ADD COLUMN     "noBrokenPalletsWetCans" BOOLEAN,
DROP COLUMN "cansFromApprovedSupplier",
ADD COLUMN     "cansFromApprovedSupplier" BOOLEAN,
DROP COLUMN "qtyAccordingToOrder",
ADD COLUMN     "qtyAccordingToOrder" BOOLEAN,
DROP COLUMN "coaReceived",
ADD COLUMN     "coaReceived" BOOLEAN,
DROP COLUMN "seamOrFlangeDefects",
ADD COLUMN     "seamOrFlangeDefects" BOOLEAN,
DROP COLUMN "dentedScratchesDust",
ADD COLUMN     "dentedScratchesDust" BOOLEAN,
DROP COLUMN "rustedCans",
ADD COLUMN     "rustedCans" BOOLEAN,
DROP COLUMN "foreignMatter",
ADD COLUMN     "foreignMatter" BOOLEAN,
DROP COLUMN "pestInfestationSigns",
ADD COLUMN     "pestInfestationSigns" BOOLEAN,
DROP COLUMN "weldingDefects",
ADD COLUMN     "weldingDefects" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_lids_incoming_inspection_internal" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityReceived",
ADD COLUMN     "quantityReceived" DOUBLE PRECISION,
DROP COLUMN "containerClean",
ADD COLUMN     "containerClean" BOOLEAN,
DROP COLUMN "noPestActivity",
ADD COLUMN     "noPestActivity" BOOLEAN,
DROP COLUMN "noNonFoodStored",
ADD COLUMN     "noNonFoodStored" BOOLEAN,
DROP COLUMN "noBrokenPalletsWetCans",
ADD COLUMN     "noBrokenPalletsWetCans" BOOLEAN,
DROP COLUMN "containerCleanConfirmed",
ADD COLUMN     "containerCleanConfirmed" BOOLEAN,
DROP COLUMN "doorClosed",
ADD COLUMN     "doorClosed" BOOLEAN,
DROP COLUMN "cansLidsFreeOfDustRust",
ADD COLUMN     "cansLidsFreeOfDustRust" BOOLEAN,
DROP COLUMN "qtyAccordingToOrder",
ADD COLUMN     "qtyAccordingToOrder" BOOLEAN,
DROP COLUMN "coaReceived",
ADD COLUMN     "coaReceived" BOOLEAN,
DROP COLUMN "seamOrFlangeDefects",
ADD COLUMN     "seamOrFlangeDefects" BOOLEAN,
DROP COLUMN "dentedScratchesDust",
ADD COLUMN     "dentedScratchesDust" BOOLEAN,
DROP COLUMN "rustedCans",
ADD COLUMN     "rustedCans" BOOLEAN,
DROP COLUMN "foreignMatter",
ADD COLUMN     "foreignMatter" BOOLEAN,
DROP COLUMN "pestInfestationSigns",
ADD COLUMN     "pestInfestationSigns" BOOLEAN,
DROP COLUMN "weldingDefects",
ADD COLUMN     "weldingDefects" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_live_leftovers_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "weight",
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_live_pack_checklist" DROP COLUMN "productionDate",
ADD COLUMN     "productionDate" DATE,
DROP COLUMN "numberOfCartons",
ADD COLUMN     "numberOfCartons" DOUBLE PRECISION,
DROP COLUMN "scaleTareWeight",
ADD COLUMN     "scaleTareWeight" DOUBLE PRECISION,
DROP COLUMN "waterTemp",
ADD COLUMN     "waterTemp" DOUBLE PRECISION,
DROP COLUMN "cleaningInspectionBefore",
ADD COLUMN     "cleaningInspectionBefore" BOOLEAN,
DROP COLUMN "mortalitiesWhilePacking",
ADD COLUMN     "mortalitiesWhilePacking" BOOLEAN,
DROP COLUMN "noOfMortalities",
ADD COLUMN     "noOfMortalities" DOUBLE PRECISION,
DROP COLUMN "damagesOnAbalone",
ADD COLUMN     "damagesOnAbalone" BOOLEAN,
DROP COLUMN "shellsCleanedWhite",
ADD COLUMN     "shellsCleanedWhite" BOOLEAN,
DROP COLUMN "signsOfParasites",
ADD COLUMN     "signsOfParasites" BOOLEAN,
DROP COLUMN "allBoxesHaveSponges",
ADD COLUMN     "allBoxesHaveSponges" BOOLEAN,
DROP COLUMN "noOfIcepacksPerBox",
ADD COLUMN     "noOfIcepacksPerBox" DOUBLE PRECISION,
DROP COLUMN "gasInjectedInEachBox",
ADD COLUMN     "gasInjectedInEachBox" BOOLEAN,
DROP COLUMN "boxesSealedAndLabelled",
ADD COLUMN     "boxesSealedAndLabelled" BOOLEAN,
DROP COLUMN "allBoxesLoadedInTruck",
ADD COLUMN     "allBoxesLoadedInTruck" BOOLEAN,
DROP COLUMN "truckLockedSealed",
ADD COLUMN     "truckLockedSealed" BOOLEAN,
DROP COLUMN "cleaningInspectionAfter",
ADD COLUMN     "cleaningInspectionAfter" BOOLEAN,
DROP COLUMN "leftoversWeight",
ADD COLUMN     "leftoversWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_live_packing_bag_quality_check" DROP COLUMN "dateOfChecking",
ADD COLUMN     "dateOfChecking" DATE,
DROP COLUMN "dateOfPacking",
ADD COLUMN     "dateOfPacking" DATE,
DROP COLUMN "noOfBagsScheduled",
ADD COLUMN     "noOfBagsScheduled" DOUBLE PRECISION,
DROP COLUMN "noOfBagsToBeChecked",
ADD COLUMN     "noOfBagsToBeChecked" DOUBLE PRECISION,
DROP COLUMN "waterTemperature",
ADD COLUMN     "waterTemperature" DOUBLE PRECISION,
DROP COLUMN "totalMortalityWeight",
ADD COLUMN     "totalMortalityWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_live_packing_bag_quality_check_row" DROP COLUMN "dateSorted",
ADD COLUMN     "dateSorted" DATE,
DROP COLUMN "bagsInTank",
ADD COLUMN     "bagsInTank" DOUBLE PRECISION,
DROP COLUMN "mortalitiesRemoved",
ADD COLUMN     "mortalitiesRemoved" BOOLEAN,
DROP COLUMN "mortalitiesQuantity",
ADD COLUMN     "mortalitiesQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_live_product_areas_cleaning_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_live_product_areas_cleaning_record_row" DROP COLUMN "status",
ADD COLUMN     "val_status" TEXT;

-- AlterTable
ALTER TABLE "sub_live_production_pack" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "packingDate",
ADD COLUMN     "packingDate" DATE,
DROP COLUMN "livePackChecklistAttached",
ADD COLUMN     "livePackChecklistAttached" BOOLEAN,
DROP COLUMN "purgeStartDate",
ADD COLUMN     "purgeStartDate" DATE,
DROP COLUMN "purgeEndDate",
ADD COLUMN     "purgeEndDate" DATE,
DROP COLUMN "purgeDays",
ADD COLUMN     "purgeDays" DOUBLE PRECISION,
DROP COLUMN "bagsIntoPurge",
ADD COLUMN     "bagsIntoPurge" DOUBLE PRECISION,
DROP COLUMN "massIntoPurge",
ADD COLUMN     "massIntoPurge" DOUBLE PRECISION,
DROP COLUMN "massOutOfPurge",
ADD COLUMN     "massOutOfPurge" DOUBLE PRECISION,
DROP COLUMN "purgeLoss",
ADD COLUMN     "purgeLoss" DOUBLE PRECISION,
DROP COLUMN "bagsPacked",
ADD COLUMN     "bagsPacked" DOUBLE PRECISION,
DROP COLUMN "boxesPacked",
ADD COLUMN     "boxesPacked" DOUBLE PRECISION,
DROP COLUMN "massPacked",
ADD COLUMN     "massPacked" DOUBLE PRECISION,
DROP COLUMN "signedPackingListsAttached",
ADD COLUMN     "signedPackingListsAttached" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_maintenance_job_card" DROP COLUMN "issueDate",
ADD COLUMN     "issueDate" DATE,
DROP COLUMN "suitablyCarriedOut",
ADD COLUMN     "suitablyCarriedOut" BOOLEAN,
DROP COLUMN "nutsBoltsAccountedFor",
ADD COLUMN     "nutsBoltsAccountedFor" BOOLEAN,
DROP COLUMN "areaCleanedAfter",
ADD COLUMN     "areaCleanedAfter" BOOLEAN,
DROP COLUMN "verificationDate",
ADD COLUMN     "verificationDate" DATE;

-- AlterTable
ALTER TABLE "sub_master_cleaning_checklist" DROP COLUMN "weekOf",
ADD COLUMN     "weekOf" DATE;

-- AlterTable
ALTER TABLE "sub_master_cleaning_checklist_row" DROP COLUMN "done",
ADD COLUMN     "done" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_master_cleaning_plan" DROP COLUMN "effectiveDate",
ADD COLUMN     "effectiveDate" DATE;

-- AlterTable
ALTER TABLE "sub_mortalities_log" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "mortalitiesKg",
ADD COLUMN     "mortalitiesKg" DOUBLE PRECISION,
DROP COLUMN "totalPack",
ADD COLUMN     "totalPack" DOUBLE PRECISION,
DROP COLUMN "percent",
ADD COLUMN     "percent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_mortality_counts_by_customer" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_mortality_counts_by_customer_row" DROP COLUMN "noMortalities",
ADD COLUMN     "noMortalities" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_personnel_facilities_cleaning_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_personnel_facilities_cleaning_record_row" DROP COLUMN "status",
ADD COLUMN     "val_status" TEXT;

-- AlterTable
ALTER TABLE "sub_pest_inspection_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "birdDroppingsSeen",
ADD COLUMN     "birdDroppingsSeen" BOOLEAN,
DROP COLUMN "baitStationsObstructed",
ADD COLUMN     "baitStationsObstructed" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_pest_inspection_record_row" DROP COLUMN "ratsMice",
ADD COLUMN     "ratsMice" BOOLEAN,
DROP COLUMN "flies",
ADD COLUMN     "flies" BOOLEAN,
DROP COLUMN "cockroaches",
ADD COLUMN     "cockroaches" BOOLEAN,
DROP COLUMN "birds",
ADD COLUMN     "birds" BOOLEAN,
DROP COLUMN "ants",
ADD COLUMN     "ants" BOOLEAN,
DROP COLUMN "moths",
ADD COLUMN     "moths" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_ph_verification" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "buffer4Reading",
ADD COLUMN     "buffer4Reading" DOUBLE PRECISION,
DROP COLUMN "buffer7Reading",
ADD COLUMN     "buffer7Reading" DOUBLE PRECISION,
DROP COLUMN "buffer10Reading",
ADD COLUMN     "buffer10Reading" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_plaster_dressing_inspection" DROP COLUMN "dateOfIncident",
ADD COLUMN     "dateOfIncident" DATE;

-- AlterTable
ALTER TABLE "sub_precooking_check_sheet" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "precookingDate",
ADD COLUMN     "precookingDate" DATE,
DROP COLUMN "litresWaterPerCook",
ADD COLUMN     "litresWaterPerCook" DOUBLE PRECISION,
DROP COLUMN "sugarKgUsed",
ADD COLUMN     "sugarKgUsed" DOUBLE PRECISION,
DROP COLUMN "temperature",
ADD COLUMN     "temperature" DOUBLE PRECISION,
DROP COLUMN "waterInPotChanged",
ADD COLUMN     "waterInPotChanged" BOOLEAN,
DROP COLUMN "rinseWaterChanged",
ADD COLUMN     "rinseWaterChanged" BOOLEAN,
DROP COLUMN "cleanWeight",
ADD COLUMN     "cleanWeight" DOUBLE PRECISION,
DROP COLUMN "precookWeight",
ADD COLUMN     "precookWeight" DOUBLE PRECISION,
DROP COLUMN "totalWholeWeight",
ADD COLUMN     "totalWholeWeight" DOUBLE PRECISION,
DROP COLUMN "totalCleanWeight",
ADD COLUMN     "totalCleanWeight" DOUBLE PRECISION,
DROP COLUMN "totalPrecookWeight",
ADD COLUMN     "totalPrecookWeight" DOUBLE PRECISION,
DROP COLUMN "percentCleanWeight",
ADD COLUMN     "percentCleanWeight" DOUBLE PRECISION,
DROP COLUMN "percentPrecookWeight",
ADD COLUMN     "percentPrecookWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_printing_control_sheet" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productionDate",
ADD COLUMN     "productionDate" DATE,
DROP COLUMN "codeCorrect",
ADD COLUMN     "codeCorrect" BOOLEAN,
DROP COLUMN "actualCanPieces",
ADD COLUMN     "actualCanPieces" DOUBLE PRECISION,
DROP COLUMN "piecesOnCan",
ADD COLUMN     "piecesOnCan" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_product_label_checklist" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "quantityOrdered",
ADD COLUMN     "quantityOrdered" DOUBLE PRECISION,
DROP COLUMN "quantityReceived",
ADD COLUMN     "quantityReceived" DOUBLE PRECISION,
DROP COLUMN "generalConditionAtReceiving",
ADD COLUMN     "generalConditionAtReceiving" BOOLEAN,
DROP COLUMN "labelDimensionsCorrect",
ADD COLUMN     "labelDimensionsCorrect" BOOLEAN,
DROP COLUMN "artworkCorrect",
ADD COLUMN     "artworkCorrect" BOOLEAN,
DROP COLUMN "ingredientStatementCorrect",
ADD COLUMN     "ingredientStatementCorrect" BOOLEAN,
DROP COLUMN "allergenDeclarationComplies",
ADD COLUMN     "allergenDeclarationComplies" BOOLEAN,
DROP COLUMN "labelCompliesApproved",
ADD COLUMN     "labelCompliesApproved" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_production_areas_cleaning_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_production_areas_cleaning_record_row" DROP COLUMN "status",
ADD COLUMN     "val_status" TEXT;

-- AlterTable
ALTER TABLE "sub_production_information_nrcs" DROP COLUMN "receivingDate",
ADD COLUMN     "receivingDate" DATE,
DROP COLUMN "dateOfInspection",
ADD COLUMN     "dateOfInspection" DATE;

-- AlterTable
ALTER TABLE "sub_production_information_nrcs_rework" DROP COLUMN "reworkDate",
ADD COLUMN     "reworkDate" DATE,
DROP COLUMN "dateOfInspection",
ADD COLUMN     "dateOfInspection" DATE;

-- AlterTable
ALTER TABLE "sub_qa1_damaged_cans_and_lids" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "noOfCansEnds",
ADD COLUMN     "noOfCansEnds" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_qc_report" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "canPieces",
ADD COLUMN     "canPieces" DOUBLE PRECISION,
DROP COLUMN "nettMassMin",
ADD COLUMN     "nettMassMin" DOUBLE PRECISION,
DROP COLUMN "drainMassMin",
ADD COLUMN     "drainMassMin" DOUBLE PRECISION,
DROP COLUMN "drainMassMax",
ADD COLUMN     "drainMassMax" DOUBLE PRECISION,
DROP COLUMN "ph",
ADD COLUMN     "ph" DOUBLE PRECISION,
DROP COLUMN "brix",
ADD COLUMN     "brix" DOUBLE PRECISION,
DROP COLUMN "waterReading",
ADD COLUMN     "waterReading" DOUBLE PRECISION,
DROP COLUMN "saltPercent",
ADD COLUMN     "saltPercent" DOUBLE PRECISION,
DROP COLUMN "vacuum",
ADD COLUMN     "vacuum" DOUBLE PRECISION,
DROP COLUMN "rustOnCans",
ADD COLUMN     "rustOnCans" BOOLEAN,
DROP COLUMN "rustOnLids",
ADD COLUMN     "rustOnLids" BOOLEAN,
DROP COLUMN "dentsOnBatch",
ADD COLUMN     "dentsOnBatch" BOOLEAN,
DROP COLUMN "oddOursOnOpening",
ADD COLUMN     "oddOursOnOpening" BOOLEAN,
DROP COLUMN "damagedPcsInCans",
ADD COLUMN     "damagedPcsInCans" BOOLEAN,
DROP COLUMN "bluingBlackSpots",
ADD COLUMN     "bluingBlackSpots" BOOLEAN,
DROP COLUMN "sauceColour",
ADD COLUMN     "sauceColour" BOOLEAN,
DROP COLUMN "visualAppearance",
ADD COLUMN     "visualAppearance" BOOLEAN,
DROP COLUMN "textureOfAbalone",
ADD COLUMN     "textureOfAbalone" BOOLEAN,
DROP COLUMN "tasteOfProduct",
ADD COLUMN     "tasteOfProduct" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_rapid_food_handler_medicals" DROP COLUMN "dateOfAssessment",
ADD COLUMN     "dateOfAssessment" DATE,
DROP COLUMN "signatureDate",
ADD COLUMN     "signatureDate" DATE;

-- AlterTable
ALTER TABLE "sub_receiving_live_returns" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "count",
ADD COLUMN     "count" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_retort_inspection_report" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "retortDoorRubberSprayed",
ADD COLUMN     "retortDoorRubberSprayed" BOOLEAN,
DROP COLUMN "preHeatCycleDone",
ADD COLUMN     "preHeatCycleDone" BOOLEAN,
DROP COLUMN "airFilterOk",
ADD COLUMN     "airFilterOk" BOOLEAN,
DROP COLUMN "stackingPatternCorrect",
ADD COLUMN     "stackingPatternCorrect" BOOLEAN,
DROP COLUMN "autoclaveTapeOnTrolley",
ADD COLUMN     "autoclaveTapeOnTrolley" BOOLEAN,
DROP COLUMN "correctTempOnRecipe",
ADD COLUMN     "correctTempOnRecipe" BOOLEAN,
DROP COLUMN "correctPressureOnRecipe",
ADD COLUMN     "correctPressureOnRecipe" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_retorting_control_sheet" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "pressureOnGauge",
ADD COLUMN     "pressureOnGauge" DOUBLE PRECISION,
DROP COLUMN "tempOnGauge",
ADD COLUMN     "tempOnGauge" DOUBLE PRECISION,
DROP COLUMN "pressureOnScreen",
ADD COLUMN     "pressureOnScreen" DOUBLE PRECISION,
DROP COLUMN "tempOnScreen",
ADD COLUMN     "tempOnScreen" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_rework_log" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productionDateOrFg01TransferDate",
ADD COLUMN     "productionDateOrFg01TransferDate" DATE,
DROP COLUMN "quantityCans",
ADD COLUMN     "quantityCans" DOUBLE PRECISION,
DROP COLUMN "newProductionDate",
ADD COLUMN     "newProductionDate" DATE,
DROP COLUMN "quantityProduced",
ADD COLUMN     "quantityProduced" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_rfh_medical_result" DROP COLUMN "dateOfMedicalAssessment",
ADD COLUMN     "dateOfMedicalAssessment" DATE,
DROP COLUMN "chronicMedicationUnderControl",
ADD COLUMN     "chronicMedicationUnderControl" BOOLEAN,
DROP COLUMN "examinerDate",
ADD COLUMN     "examinerDate" DATE,
DROP COLUMN "verifiedDate",
ADD COLUMN     "verifiedDate" DATE;

-- AlterTable
ALTER TABLE "sub_rtw_medical_questionnaire" DROP COLUMN "skinRashes",
ADD COLUMN     "skinRashes" BOOLEAN,
DROP COLUMN "gumsThroatMouthDisease",
ADD COLUMN     "gumsThroatMouthDisease" BOOLEAN,
DROP COLUMN "diarrhoeaVomiting",
ADD COLUMN     "diarrhoeaVomiting" BOOLEAN,
DROP COLUMN "earsNoseEyesDischarge",
ADD COLUMN     "earsNoseEyesDischarge" BOOLEAN,
DROP COLUMN "coldsCoughsFever",
ADD COLUMN     "coldsCoughsFever" BOOLEAN,
DROP COLUMN "employeeSignatureDate",
ADD COLUMN     "employeeSignatureDate" DATE;

-- AlterTable
ALTER TABLE "sub_safety_glass_register" DROP COLUMN "weekStarting",
ADD COLUMN     "weekStarting" DATE;

-- AlterTable
ALTER TABLE "sub_safety_glass_register_row" DROP COLUMN "issued",
ADD COLUMN     "issued" BOOLEAN,
DROP COLUMN "returned",
ADD COLUMN     "returned" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_salt_issuing_register" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_salting_and_tumbling" DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_salting_and_tumbling_row" DROP COLUMN "standardSaltingTime",
ADD COLUMN     "standardSaltingTime" DOUBLE PRECISION,
DROP COLUMN "noOfCrates",
ADD COLUMN     "noOfCrates" DOUBLE PRECISION,
DROP COLUMN "totalTumblingTime",
ADD COLUMN     "totalTumblingTime" DOUBLE PRECISION,
DROP COLUMN "shuckWeight",
ADD COLUMN     "shuckWeight" DOUBLE PRECISION,
DROP COLUMN "saltKg",
ADD COLUMN     "saltKg" DOUBLE PRECISION,
DROP COLUMN "saltPercentUsed",
ADD COLUMN     "saltPercentUsed" DOUBLE PRECISION,
DROP COLUMN "bakingSodaKg",
ADD COLUMN     "bakingSodaKg" DOUBLE PRECISION,
DROP COLUMN "sugarKg",
ADD COLUMN     "sugarKg" DOUBLE PRECISION,
DROP COLUMN "sugarPercentUsed",
ADD COLUMN     "sugarPercentUsed" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_salting_oosw" DROP COLUMN "sizeRange",
DROP COLUMN "wholeWeight",
DROP COLUMN "intakeDate",
ADD COLUMN     "intakeDate" DATE,
DROP COLUMN "supervisorDate",
ADD COLUMN     "supervisorDate" DATE;

-- AlterTable
ALTER TABLE "sub_salting_oosw_row" ADD COLUMN     "sizeRange" TEXT,
ADD COLUMN     "wholeWeight" DOUBLE PRECISION,
DROP COLUMN "weight",
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_sampling_log" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "pieces",
ADD COLUMN     "pieces" DOUBLE PRECISION,
DROP COLUMN "quantity",
ADD COLUMN     "quantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_sauce_batch_coding" DROP COLUMN "dateOfMix",
ADD COLUMN     "dateOfMix" DATE,
DROP COLUMN "bucketNumber",
ADD COLUMN     "bucketNumber" DOUBLE PRECISION,
DROP COLUMN "weightOfBucket",
ADD COLUMN     "weightOfBucket" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_sauce_mixing" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "brothBatchDate",
ADD COLUMN     "brothBatchDate" DATE,
DROP COLUMN "litres",
ADD COLUMN     "litres" DOUBLE PRECISION,
DROP COLUMN "phBroth",
ADD COLUMN     "phBroth" DOUBLE PRECISION,
DROP COLUMN "brixBroth",
ADD COLUMN     "brixBroth" DOUBLE PRECISION,
DROP COLUMN "saltBroth",
ADD COLUMN     "saltBroth" DOUBLE PRECISION,
DROP COLUMN "chickenLiquidWeight",
ADD COLUMN     "chickenLiquidWeight" DOUBLE PRECISION,
DROP COLUMN "smokeyFlavourWeight",
ADD COLUMN     "smokeyFlavourWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_scrubbing_check_supervisor" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "abaloneSize",
ADD COLUMN     "abaloneSize" DOUBLE PRECISION,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "productCleanedEffectively",
ADD COLUMN     "productCleanedEffectively" BOOLEAN,
DROP COLUMN "damagedAbalone",
ADD COLUMN     "damagedAbalone" BOOLEAN,
DROP COLUMN "weightDamagedAbalone",
ADD COLUMN     "weightDamagedAbalone" DOUBLE PRECISION,
DROP COLUMN "weightDamagedTrimmed",
ADD COLUMN     "weightDamagedTrimmed" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_scrubbing_checklist_qc" DROP COLUMN "acceptableDamageTrimmed",
DROP COLUMN "allScrubbedClean",
DROP COLUMN "damagedAbalone",
DROP COLUMN "noOfCratesInspected",
DROP COLUMN "sizeRange",
DROP COLUMN "time",
DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_seamer_inspection_report" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "preCleaningDone",
ADD COLUMN     "preCleaningDone" BOOLEAN,
DROP COLUMN "compressorPressureChecked",
ADD COLUMN     "compressorPressureChecked" BOOLEAN,
DROP COLUMN "steamValveChecked",
ADD COLUMN     "steamValveChecked" BOOLEAN,
DROP COLUMN "seamerMainRunDone",
ADD COLUMN     "seamerMainRunDone" BOOLEAN,
DROP COLUMN "seamsChecked",
ADD COLUMN     "seamsChecked" BOOLEAN,
DROP COLUMN "chutesClean",
ADD COLUMN     "chutesClean" BOOLEAN,
DROP COLUMN "noCansLidsFromPreviousShift",
ADD COLUMN     "noCansLidsFromPreviousShift" BOOLEAN,
DROP COLUMN "cleaningOfSeamerDone",
ADD COLUMN     "cleaningOfSeamerDone" BOOLEAN,
DROP COLUMN "rollersLubricated",
ADD COLUMN     "rollersLubricated" BOOLEAN,
DROP COLUMN "seamerCoverRemoved",
ADD COLUMN     "seamerCoverRemoved" BOOLEAN,
DROP COLUMN "oilLevelChecked",
ADD COLUMN     "oilLevelChecked" BOOLEAN,
DROP COLUMN "lidsEmptiedFromChute",
ADD COLUMN     "lidsEmptiedFromChute" BOOLEAN,
DROP COLUMN "cansLidsTakenToFG02",
ADD COLUMN     "cansLidsTakenToFG02" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_staff_hygiene_inspection" DROP COLUMN "weekStarting",
ADD COLUMN     "weekStarting" DATE;

-- AlterTable
ALTER TABLE "sub_staff_hygiene_inspection_row" DROP COLUMN "protectiveClothing",
ADD COLUMN     "protectiveClothing" BOOLEAN,
DROP COLUMN "hairBootsClean",
ADD COLUMN     "hairBootsClean" BOOLEAN,
DROP COLUMN "fingernails",
ADD COLUMN     "fingernails" BOOLEAN,
DROP COLUMN "noJewelleryMakeup",
ADD COLUMN     "noJewelleryMakeup" BOOLEAN,
DROP COLUMN "handWash",
ADD COLUMN     "handWash" BOOLEAN,
DROP COLUMN "noFoodDrink",
ADD COLUMN     "noFoodDrink" BOOLEAN,
DROP COLUMN "injuryIllness",
ADD COLUMN     "injuryIllness" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_staff_hygiene_inspection_weekends" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_staff_hygiene_inspection_weekends_row" DROP COLUMN "protectiveClothing",
ADD COLUMN     "protectiveClothing" BOOLEAN,
DROP COLUMN "hairBootsClean",
ADD COLUMN     "hairBootsClean" BOOLEAN,
DROP COLUMN "fingernails",
ADD COLUMN     "fingernails" BOOLEAN,
DROP COLUMN "noJewelleryMakeup",
ADD COLUMN     "noJewelleryMakeup" BOOLEAN,
DROP COLUMN "handWash",
ADD COLUMN     "handWash" BOOLEAN,
DROP COLUMN "injuryIllness",
ADD COLUMN     "injuryIllness" BOOLEAN,
DROP COLUMN "noFood",
ADD COLUMN     "noFood" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_stock_loading" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "canPieces",
ADD COLUMN     "canPieces" DOUBLE PRECISION,
DROP COLUMN "drainedWeight",
ADD COLUMN     "drainedWeight" DOUBLE PRECISION,
DROP COLUMN "numberOfCans",
ADD COLUMN     "numberOfCans" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_stock_transfers" DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE,
DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "numberOfBoxes",
ADD COLUMN     "numberOfBoxes" DOUBLE PRECISION,
DROP COLUMN "pieces",
ADD COLUMN     "pieces" DOUBLE PRECISION,
DROP COLUMN "drainedWeight",
ADD COLUMN     "drainedWeight" DOUBLE PRECISION,
DROP COLUMN "numberOfCans",
ADD COLUMN     "numberOfCans" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_supplier_approval_record" DROP COLUMN "dateOfEvaluation",
ADD COLUMN     "dateOfEvaluation" DATE,
DROP COLUMN "totalPercent",
ADD COLUMN     "totalPercent" DOUBLE PRECISION,
DROP COLUMN "verificationDate",
ADD COLUMN     "verificationDate" DATE;

-- AlterTable
ALTER TABLE "sub_supplier_questionnaire" DROP COLUMN "certificateOfAcceptability",
ADD COLUMN     "certificateOfAcceptability" BOOLEAN,
DROP COLUMN "facilityCertified",
ADD COLUMN     "facilityCertified" BOOLEAN,
DROP COLUMN "certificateDate",
ADD COLUMN     "certificateDate" DATE,
DROP COLUMN "certificateAttached",
ADD COLUMN     "certificateAttached" BOOLEAN,
DROP COLUMN "completedByDate",
ADD COLUMN     "completedByDate" DATE,
DROP COLUMN "sqaApprovalDate",
ADD COLUMN     "sqaApprovalDate" DATE;

-- AlterTable
ALTER TABLE "sub_thermometer_correction_factors" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "referenceReading",
ADD COLUMN     "referenceReading" DOUBLE PRECISION,
DROP COLUMN "testReading",
ADD COLUMN     "testReading" DOUBLE PRECISION,
DROP COLUMN "difference",
ADD COLUMN     "difference" DOUBLE PRECISION,
DROP COLUMN "correctionUsed",
ADD COLUMN     "correctionUsed" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_thermometer_verification" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "coldReferenceReading",
ADD COLUMN     "coldReferenceReading" DOUBLE PRECISION,
DROP COLUMN "coldTestReading",
ADD COLUMN     "coldTestReading" DOUBLE PRECISION,
DROP COLUMN "coldDeviation",
ADD COLUMN     "coldDeviation" DOUBLE PRECISION,
DROP COLUMN "hotReferenceReading",
ADD COLUMN     "hotReferenceReading" DOUBLE PRECISION,
DROP COLUMN "hotTestReading",
ADD COLUMN     "hotTestReading" DOUBLE PRECISION,
DROP COLUMN "hotDeviation",
ADD COLUMN     "hotDeviation" DOUBLE PRECISION,
DROP COLUMN "verifiedDate",
ADD COLUMN     "verifiedDate" DATE;

-- AlterTable
ALTER TABLE "sub_traceability" DROP COLUMN "dateInitiated",
ADD COLUMN     "dateInitiated" DATE,
DROP COLUMN "totalAmountReceivedProduced",
ADD COLUMN     "totalAmountReceivedProduced" DOUBLE PRECISION,
DROP COLUMN "receivingMatchesShipped",
ADD COLUMN     "receivingMatchesShipped" BOOLEAN,
DROP COLUMN "amountRawWarehouse",
ADD COLUMN     "amountRawWarehouse" DOUBLE PRECISION,
DROP COLUMN "amountOnHold",
ADD COLUMN     "amountOnHold" DOUBLE PRECISION,
DROP COLUMN "amountInProcess",
ADD COLUMN     "amountInProcess" DOUBLE PRECISION,
DROP COLUMN "amountFinishedWarehouse",
ADD COLUMN     "amountFinishedWarehouse" DOUBLE PRECISION,
DROP COLUMN "amountShipped",
ADD COLUMN     "amountShipped" DOUBLE PRECISION,
DROP COLUMN "percentageAccountedFor",
ADD COLUMN     "percentageAccountedFor" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_traceability_mock_recall_canned_abalone" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_traceability_mock_recall_canned_braised_abalone" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_traceability_mock_recall_canned_minced_abalone" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_traceability_mock_recall_dried_abalone" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_traceability_mock_recall_live_abalone" DROP COLUMN "recallInitiationDate",
ADD COLUMN     "recallInitiationDate" DATE,
DROP COLUMN "packingDate",
ADD COLUMN     "packingDate" DATE;

-- AlterTable
ALTER TABLE "sub_training_register" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_training_register_row" DROP COLUMN "competencyConfirmed",
ADD COLUMN     "competencyConfirmed" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_utensil_issue_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "sub_utensil_issue_record_row" DROP COLUMN "qtyIssued",
ADD COLUMN     "qtyIssued" DOUBLE PRECISION,
DROP COLUMN "qtyReturned",
ADD COLUMN     "qtyReturned" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_washing_control_sheet" DROP COLUMN "abaloneCleanAfterWash",
DROP COLUMN "binsTraysPerWash",
DROP COLUMN "date",
DROP COLUMN "machineNo",
DROP COLUMN "sizeRange",
DROP COLUMN "timeStarted",
DROP COLUMN "totalWashingTime",
DROP COLUMN "washNumber",
DROP COLUMN "jiReceivingDate",
ADD COLUMN     "jiReceivingDate" DATE;

-- AlterTable
ALTER TABLE "sub_water_monitoring" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "freshWaterPh",
ADD COLUMN     "freshWaterPh" DOUBLE PRECISION,
DROP COLUMN "seaWaterSalt",
ADD COLUMN     "seaWaterSalt" DOUBLE PRECISION,
DROP COLUMN "seaWaterPh",
ADD COLUMN     "seaWaterPh" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_water_tank_inspection" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "filtersClean",
ADD COLUMN     "filtersClean" BOOLEAN,
DROP COLUMN "tankSoiled",
ADD COLUMN     "tankSoiled" BOOLEAN,
DROP COLUMN "tankCleaned",
ADD COLUMN     "tankCleaned" BOOLEAN,
DROP COLUMN "dateOfVerification",
ADD COLUMN     "dateOfVerification" DATE;

-- AlterTable
ALTER TABLE "sub_weekly_cleaning_record" DROP COLUMN "weekOf",
ADD COLUMN     "weekOf" DATE;

-- AlterTable
ALTER TABLE "sub_weekly_cleaning_record_row" DROP COLUMN "done",
ADD COLUMN     "done" BOOLEAN;

-- AlterTable
ALTER TABLE "sub_withdrawal_mock_recall_record" DROP COLUMN "date",
ADD COLUMN     "date" DATE,
DROP COLUMN "bestBeforeDate",
ADD COLUMN     "bestBeforeDate" DATE,
DROP COLUMN "amountStockProduced",
ADD COLUMN     "amountStockProduced" DOUBLE PRECISION,
DROP COLUMN "amountDistributedStock",
ADD COLUMN     "amountDistributedStock" DOUBLE PRECISION,
DROP COLUMN "amountCurrentlyInStock",
ADD COLUMN     "amountCurrentlyInStock" DOUBLE PRECISION,
DROP COLUMN "amountAtCustomer",
ADD COLUMN     "amountAtCustomer" DOUBLE PRECISION,
DROP COLUMN "amountSoldByCustomer",
ADD COLUMN     "amountSoldByCustomer" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "sub_basket_removal_shucking_gutting_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "incomingTemp" DOUBLE PRECISION,
    "noOfMortalities" DOUBLE PRECISION,
    "signsOfParasites" BOOLEAN,
    "foreignObjects" BOOLEAN,
    "damagesOnFoot" BOOLEAN,

    CONSTRAINT "sub_basket_removal_shucking_gutting_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_washing_control_sheet_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "date" DATE,
    "timeStarted" TEXT,
    "washNumber" TEXT,
    "sizeRange" TEXT,
    "machineNo" TEXT,
    "binsTraysPerWash" TEXT,
    "totalWashingTime" TEXT,
    "abaloneCleanAfterWash" BOOLEAN,

    CONSTRAINT "sub_washing_control_sheet_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_scrubbing_checklist_qc_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "sizeRange" TEXT,
    "noOfCratesInspected" DOUBLE PRECISION,
    "damagedAbalone" BOOLEAN,
    "allScrubbedClean" BOOLEAN,
    "acceptableDamageTrimmed" BOOLEAN,

    CONSTRAINT "sub_scrubbing_checklist_qc_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_basket_removal_shucking_gutting_row_parentId_idx" ON "sub_basket_removal_shucking_gutting_row"("parentId");

-- CreateIndex
CREATE INDEX "sub_washing_control_sheet_row_parentId_idx" ON "sub_washing_control_sheet_row"("parentId");

-- CreateIndex
CREATE INDEX "sub_scrubbing_checklist_qc_row_parentId_idx" ON "sub_scrubbing_checklist_qc_row"("parentId");

-- RenameForeignKey
ALTER TABLE "sub_traceability_mock_recall_canned_braised_abalone_row" RENAME CONSTRAINT "sub_traceability_mock_recall_canned_braised_abalone_row_parentI" TO "sub_traceability_mock_recall_canned_braised_abalone_row_pa_fkey";

-- RenameForeignKey
ALTER TABLE "sub_traceability_mock_recall_canned_minced_abalone_row" RENAME CONSTRAINT "sub_traceability_mock_recall_canned_minced_abalone_row_parentId" TO "sub_traceability_mock_recall_canned_minced_abalone_row_par_fkey";

-- AddForeignKey
ALTER TABLE "sub_basket_removal_shucking_gutting_row" ADD CONSTRAINT "sub_basket_removal_shucking_gutting_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_basket_removal_shucking_gutting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_washing_control_sheet_row" ADD CONSTRAINT "sub_washing_control_sheet_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_washing_control_sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_scrubbing_checklist_qc_row" ADD CONSTRAINT "sub_scrubbing_checklist_qc_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_scrubbing_checklist_qc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "sub_traceability_mock_recall_canned_braised_abalone_row_parentI" RENAME TO "sub_traceability_mock_recall_canned_braised_abalone_row_par_idx";

-- RenameIndex
ALTER INDEX "sub_traceability_mock_recall_canned_minced_abalone_row_parentId" RENAME TO "sub_traceability_mock_recall_canned_minced_abalone_row_pare_idx";

