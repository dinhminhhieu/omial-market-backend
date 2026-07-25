---
name: update-spec
description: Cập nhật spec trong .claude/specs/ sau khi thêm hoặc sửa module, service, hay tính năng. Dùng ngay sau khi code xong một thay đổi để session sau không phải đọc lại toàn bộ code. Cũng dùng khi thêm service mới (tạo spec mới + cập nhật CLAUDE.md).
---

# Skill: update-spec

Giữ `.claude/specs/*.md` và `CLAUDE.md` khớp với code, để mỗi session đọc spec
là đủ (khỏi grep lại repo — tiết kiệm token).

## Khi nào chạy
Ngay sau khi: thêm/sửa một service, module, controller, message pattern, DTO,
endpoint, env, hoặc đổi kiến trúc.

## Các bước
1. **Xác định phạm vi thay đổi** — nó động vào service/lib nào? (auth-service,
   api-gateway, shared-libs, hay service mới).
2. **Đọc spec tương ứng** trong `.claude/specs/` (đừng đọc lại toàn bộ code —
   chỉ đọc code phần vừa đổi + spec cũ).
3. **Cập nhật spec** cho khớp thực tế:
   - Bản đồ file (thêm/xoá dòng).
   - Bảng message patterns / endpoints / clients.
   - Env mới.
   - Mục **Trạng thái & TODO** (đánh ✅ cái vừa xong, bỏ khỏi ⬜).
   - Giữ NGẮN GỌN: bảng + bullet, KHÔNG chép code.
4. **Nếu là service MỚI**:
   - Tạo `.claude/specs/<service>.md` theo khuôn các spec sẵn có
     (Vai trò · Queue/Endpoint · Bản đồ file · Contract/Pattern · Env · Quy ước · Trạng thái).
   - Thêm dòng vào bảng trong [.claude/specs/README.md](../specs/README.md).
   - Cập nhật `CLAUDE.md`: mục "Specs chi tiết" + bảng "Trạng thái migrate".
5. **Kiểm tra chéo nhanh**: tên file/pattern/env trong spec có đúng với code không.

## Nguyên tắc
- Spec là **chỉ mục để hiểu nhanh**, không phải tài liệu đầy đủ — link tới code.
- Thà thiếu còn hơn sai: nếu không chắc, ghi `⬜ cần xác minh` thay vì phỏng đoán.
- Mỗi thay đổi kiến trúc quan trọng → phản ánh vào `CLAUDE.md` (file luôn được nạp).
