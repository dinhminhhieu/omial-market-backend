export const ORDER_PATTERNS = {
  CREATE: 'order.create', // checkout: nhận items từ FE (giỏ local) — server tự định giá
  FIND_ALL: 'order.find_all', // danh sách + filter status + phân trang
  FIND_ONE: 'order.find_one',
  UPDATE_STATUS: 'order.update_status', // mọi chuyển trạng thái (kể cả huỷ) đi qua đây
  // KHÔNG có order.delete — đơn hàng quản vòng đời bằng status, không xoá.
  // Phase 2 (saga): create sẽ reserve kho, completed ghi SALE, cancelled release.
} as const;
