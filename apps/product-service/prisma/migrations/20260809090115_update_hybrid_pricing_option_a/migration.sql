/*
  Warnings:

  - You are about to drop the column `isPriceSale` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `priceSale` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `priceSale` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "isPriceSale",
DROP COLUMN "priceSale",
ADD COLUMN     "compareAtPrice" DECIMAL(12,2),
ADD COLUMN     "saleEndAt" TIMESTAMP(3),
ADD COLUMN     "saleStartAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "priceSale",
ADD COLUMN     "compareAtPrice" DECIMAL(12,2),
ADD COLUMN     "saleEndAt" TIMESTAMP(3),
ADD COLUMN     "saleStartAt" TIMESTAMP(3);
