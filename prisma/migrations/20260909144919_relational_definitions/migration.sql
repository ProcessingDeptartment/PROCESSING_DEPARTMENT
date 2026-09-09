-- CreateTable
CREATE TABLE "RecordDefinition" (
    "recordKey" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "mount" TEXT,
    "pageFile" TEXT NOT NULL,
    "docCode" TEXT,
    "title" TEXT,
    "docRevisionStart" INTEGER,
    "jobInfoGroup" TEXT,
    "clientHook" TEXT,
    "primaryBatchField" TEXT,
    "extraBatchFields" TEXT[],
    "extraJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecordDefinition_pkey" PRIMARY KEY ("recordKey")
);
-- CreateTable
CREATE TABLE "RecordSectionDef" (
    "id" TEXT NOT NULL,
    "recordKey" TEXT NOT NULL,
    "title" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'fields',
    "position" INTEGER NOT NULL,
    "extraJson" JSONB,
    CONSTRAINT "RecordSectionDef_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "RecordFieldDef" (
    "id" TEXT NOT NULL,
    "recordKey" TEXT NOT NULL,
    "sectionIndex" INTEGER,
    "parentFieldKey" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "options" TEXT[],
    "group" TEXT,
    "position" INTEGER NOT NULL,
    "computeFn" TEXT,
    "computeArgs" JSONB,
    "recordPickSource" TEXT,
    "linkField" TEXT,
    "linkRelation" TEXT,
    "validateJson" JSONB,
    "extraJson" JSONB,
    CONSTRAINT "RecordFieldDef_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "RecordAutofillDef" (
    "id" TEXT NOT NULL,
    "recordKey" TEXT NOT NULL,
    "watchKey" TEXT,
    "sourceRecordKey" TEXT,
    "matchField" TEXT,
    "fillMap" JSONB NOT NULL,
    "extraJson" JSONB,
    CONSTRAINT "RecordAutofillDef_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "RecordLink" (
    "id" SERIAL NOT NULL,
    "linkValue" TEXT NOT NULL,
    "linkField" TEXT NOT NULL,
    "recordName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'self',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecordLink_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "RecordSectionDef_recordKey_idx" ON "RecordSectionDef"("recordKey");
-- CreateIndex
CREATE INDEX "RecordFieldDef_recordKey_idx" ON "RecordFieldDef"("recordKey");
-- CreateIndex
CREATE INDEX "RecordFieldDef_key_idx" ON "RecordFieldDef"("key");
-- CreateIndex
CREATE INDEX "RecordFieldDef_linkField_idx" ON "RecordFieldDef"("linkField");
-- CreateIndex
CREATE UNIQUE INDEX "RecordFieldDef_recordKey_key_parentFieldKey_key" ON "RecordFieldDef"("recordKey", "key", "parentFieldKey");
-- CreateIndex
CREATE INDEX "RecordAutofillDef_recordKey_idx" ON "RecordAutofillDef"("recordKey");
-- CreateIndex
CREATE INDEX "RecordLink_linkValue_linkField_idx" ON "RecordLink"("linkValue", "linkField");
-- CreateIndex
CREATE INDEX "RecordLink_recordName_recordId_idx" ON "RecordLink"("recordName", "recordId");
-- CreateIndex
CREATE UNIQUE INDEX "RecordLink_linkValue_linkField_recordName_recordId_relation_key" ON "RecordLink"("linkValue", "linkField", "recordName", "recordId", "relation");
-- AddForeignKey
ALTER TABLE "RecordSectionDef" ADD CONSTRAINT "RecordSectionDef_recordKey_fkey" FOREIGN KEY ("recordKey") REFERENCES "RecordDefinition"("recordKey") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RecordFieldDef" ADD CONSTRAINT "RecordFieldDef_recordKey_fkey" FOREIGN KEY ("recordKey") REFERENCES "RecordDefinition"("recordKey") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RecordAutofillDef" ADD CONSTRAINT "RecordAutofillDef_recordKey_fkey" FOREIGN KEY ("recordKey") REFERENCES "RecordDefinition"("recordKey") ON DELETE CASCADE ON UPDATE CASCADE;
