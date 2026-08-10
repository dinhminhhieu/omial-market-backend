/*
  Warnings:

  - You are about to drop the column `templateId` on the `OptionTemplateItem` table. All the data in the column will be lost.
  - Added the required column `optionTemplateId` to the `OptionTemplateItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "OptionTemplateItem" DROP CONSTRAINT "OptionTemplateItem_templateId_fkey";

-- DropIndex
DROP INDEX "OptionTemplateItem_templateId_idx";

-- AlterTable
ALTER TABLE "OptionTemplateItem" DROP COLUMN "templateId",
ADD COLUMN     "optionTemplateId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OptionTemplateItem_optionTemplateId_idx" ON "OptionTemplateItem"("optionTemplateId");

-- AddForeignKey
ALTER TABLE "OptionTemplateItem" ADD CONSTRAINT "OptionTemplateItem_optionTemplateId_fkey" FOREIGN KEY ("optionTemplateId") REFERENCES "OptionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
