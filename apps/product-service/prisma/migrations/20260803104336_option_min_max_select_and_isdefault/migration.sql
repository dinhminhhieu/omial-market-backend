/*
  Warnings:

  - You are about to drop the column `multiple` on the `OptionTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `required` on the `OptionTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `multiple` on the `ProductOptionGroup` table. All the data in the column will be lost.
  - You are about to drop the column `required` on the `ProductOptionGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OptionTemplate" DROP COLUMN "multiple",
DROP COLUMN "required",
ADD COLUMN     "maxSelect" INTEGER,
ADD COLUMN     "minSelect" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OptionTemplateItem" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductOptionGroup" DROP COLUMN "multiple",
DROP COLUMN "required",
ADD COLUMN     "maxSelect" INTEGER,
ADD COLUMN     "minSelect" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductOptionItem" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;
