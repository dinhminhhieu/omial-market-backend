export const INVENTORY_PATTERNS = {
  // batch: nhận DANH SÁCH ref, trả 1 lần — tránh N+1 round-trip qua RMQ
  GET_STOCK: 'inventory.get_stock',
  RECEIVE: 'inventory.receive', // phiếu nhập kho
  ISSUE: 'inventory.issue', // phiếu xuất kho thủ công (hủy/nội bộ/trả NCC)
  ADJUST: 'inventory.adjust', // phiếu kiểm kê (gửi số đếm thực tế)
  GET_MOVEMENTS: 'inventory.get_movements', // xem sổ cái, phân trang
  // Phase 2 (saga): reserve / release / commit
} as const;
