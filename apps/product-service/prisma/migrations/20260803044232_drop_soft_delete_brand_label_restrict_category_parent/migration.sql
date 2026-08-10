/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `Brand` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Brand` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Label` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Label` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";

-- AlterTable
ALTER TABLE "Brand" DROP COLUMN "deletedAt",
DROP COLUMN "isDeleted";

-- AlterTable
ALTER TABLE "Label" DROP COLUMN "deletedAt",
DROP COLUMN "isDeleted";

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
