-- AlterTable
ALTER TABLE "sub_dry_stock_control" DROP COLUMN "month",
ADD COLUMN     "month" DATE;

-- AlterTable
ALTER TABLE "sub_factory_maintenance_inspection" DROP COLUMN "month",
ADD COLUMN     "month" DATE;

-- AlterTable
ALTER TABLE "sub_lha_water_monitoring" DROP COLUMN "month",
ADD COLUMN     "month" DATE;

-- AlterTable
ALTER TABLE "sub_salting_and_tumbling_row" DROP COLUMN "startTime",
ADD COLUMN     "startTime" TIME,
DROP COLUMN "finishTime",
ADD COLUMN     "finishTime" TIME;

-- AlterTable
ALTER TABLE "sub_thermometer_correction_factors" DROP COLUMN "month",
ADD COLUMN     "month" DATE;

-- AlterTable
ALTER TABLE "sub_water_monitoring" DROP COLUMN "month",
ADD COLUMN     "month" DATE;

