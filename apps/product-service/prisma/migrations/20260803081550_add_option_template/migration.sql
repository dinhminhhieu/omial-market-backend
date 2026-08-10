-- CreateTable
CREATE TABLE "OptionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionTemplateItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OptionTemplate_name_key" ON "OptionTemplate"("name");

-- CreateIndex
CREATE INDEX "OptionTemplateItem_templateId_idx" ON "OptionTemplateItem"("templateId");

-- AddForeignKey
ALTER TABLE "OptionTemplateItem" ADD CONSTRAINT "OptionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OptionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
