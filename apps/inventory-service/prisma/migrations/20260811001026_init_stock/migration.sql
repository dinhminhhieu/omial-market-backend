-- CreateEnum
CREATE TYPE "StockRefType" AS ENUM ('PRODUCT', 'VARIANT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIVE', 'ADJUST', 'SALE', 'RETURN');

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "refType" "StockRefType" NOT NULL,
    "refId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_sku_key" ON "StockItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_refType_refId_key" ON "StockItem"("refType", "refId");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== CHECK constraints (Prisma schema không khai được — thêm tay) =====
-- Lưới an toàn CUỐI CÙNG ở tầng DB: dù service có bug, dữ liệu kho vô lý
-- (tồn âm, giữ chỗ nhiều hơn tồn) cũng không ghi xuống được.
ALTER TABLE "StockItem" ADD CONSTRAINT "stock_item_on_hand_non_negative" CHECK ("onHand" >= 0);
ALTER TABLE "StockItem" ADD CONSTRAINT "stock_item_reserved_non_negative" CHECK ("reserved" >= 0);
ALTER TABLE "StockItem" ADD CONSTRAINT "stock_item_reserved_lte_on_hand" CHECK ("reserved" <= "onHand");

-- Chứng từ delta = 0 là vô nghĩa — sổ cái chỉ ghi biến động thật.
ALTER TABLE "StockMovement" ADD CONSTRAINT "stock_movement_delta_not_zero" CHECK ("delta" <> 0);
