-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'OPTION', 'VARIANT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'SIMPLE';
