/**
 * MIRROR 2 enum `StockRefType` + `StockMovementType` trong schema.prisma của
 * inventory-service. PHẢI định nghĩa lại ở đây, TUYỆT ĐỐI không import từ
 * `apps/inventory-service/src/generated/prisma` (cùng lý do với ProductType:
 * gateway không có Prisma, sai chiều dependency libs → apps, Jest không resolve).
 *
 * Giá trị phải khớp 1-1 với Prisma enum. Thêm/bớt giá trị → sửa CẢ HAI nơi.
 */

/** Đơn vị lưu kho trỏ tới cái gì bên product-service. */
export enum StockRefType {
  PRODUCT = 'PRODUCT', // Product type SIMPLE / OPTION — tồn theo sản phẩm
  VARIANT = 'VARIANT', // Product type VARIANT — tồn theo từng biến thể
}

/** Loại chứng từ trong sổ cái kho (append-only). */
export enum StockMovementType {
  RECEIVE = 'RECEIVE', // phiếu nhập kho (delta +)
  ISSUE = 'ISSUE', // phiếu xuất kho thủ công: hủy/hỏng, nội bộ, trả NCC (delta -)
  ADJUST = 'ADJUST', // phiếu kiểm kê / điều chỉnh (delta +/-)
  SALE = 'SALE', // xuất bán — sinh từ đơn hàng (Phase 2 saga)
  RETURN = 'RETURN', // hoàn hàng về kho (Phase 2)
}
