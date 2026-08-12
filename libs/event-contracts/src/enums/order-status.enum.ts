/**
 * MIRROR enum `OrderStatus` trong schema.prisma của order-service.
 * PHẢI định nghĩa lại ở đây, TUYỆT ĐỐI không import từ generated Prisma
 * (cùng lý do ProductType/StockRefType: gateway không có Prisma, sai chiều
 * dependency libs → apps, Jest không resolve). Sửa enum → sửa CẢ HAI nơi.
 *
 * Máy trạng thái (service gác):
 *   PENDING → CONFIRMED | CANCELLED
 *   CONFIRMED → SHIPPING | CANCELLED
 *   SHIPPING → COMPLETED | CANCELLED (giao thất bại)
 *   COMPLETED / CANCELLED = terminal
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPING = 'SHIPPING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
