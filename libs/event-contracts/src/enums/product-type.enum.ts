/**
 * Phân loại sản phẩm — MIRROR enum `ProductType` trong schema.prisma của
 * product-service. PHẢI định nghĩa lại ở đây, TUYỆT ĐỐI không import từ
 * `apps/product-service/src/generated/prisma`:
 * - `libs/event-contracts` dùng chung với api-gateway — nơi KHÔNG có Prisma.
 * - `libs/*` không được phụ thuộc ngược vào `apps/*` (sai chiều dependency):
 *   build gateway sẽ phải chờ product-service chạy `prisma generate` trước.
 * - Jest không resolve được path `apps/...` từ libs → test suite gãy.
 *
 * Giá trị phải khớp 1-1 với Prisma enum. Thêm/bớt giá trị → sửa CẢ HAI nơi.
 */
export enum ProductType {
  SIMPLE = 'SIMPLE', // 1 SKU, không option/variant
  OPTION = 'OPTION', // có option groups (chỉ cộng extraPrice, vẫn 1 SKU)
  VARIANT = 'VARIANT', // nhiều SKU, mỗi biến thể 1 tồn kho riêng
}
