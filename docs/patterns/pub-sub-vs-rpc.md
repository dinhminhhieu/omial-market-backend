# Pub/Sub (event) vs RPC (`send`) — cú lật tư duy của Phase 2

## Vấn đề nào buộc phải dùng

Trước Phase 2, `auth.register()` gọi thẳng `mail.sendOtpEmail()` và **await** nó.
Hai việc chẳng liên quan về nghiệp vụ — "tạo tài khoản" và "gửi mail" — bị dính
cứng vào nhau trong cùng một luồng:

- Gmail SMTP chậm 2–3 giây → khách bấm "Đăng ký" đứng hình 2–3 giây.
- **SMTP sập = chức năng đăng ký sập**, dù user đã được tạo thành công trong DB.
- Muốn thêm "gửi SMS chào mừng" phải **sửa code register** — mỗi tính năng mới là
  một lần đụng vào luồng cốt lõi.

## Không có thì hệ thống hỏng thế nào (đo được)

Smoke test thật (2026-08-13), sau khi tách:

| Kịch bản | Kết quả |
| --- | --- |
| Register bình thường | **HTTP 201 trong 0.155s** (trước: phải chờ SMTP) |
| **Tắt hẳn notification-service** rồi register | **201 trong 0.082s** — đăng ký vẫn thành công |
| Queue lúc đó | `notification_queue: 1 message, 0 consumer` — event nằm CHỜ |
| Bật lại notification-service | Event tồn đọng **tự động được xử lý**, mail gửi đi |

Đây là điều RPC không làm được: với `send`, service gửi mail chết là request chết
theo. Với `emit`, RabbitMQ **giữ giùm** event tới khi có người xử lý.

## Cơ chế — khác biệt cụ thể trong code

| | `send` + `@MessagePattern` | `emit` + `@EventPattern` |
| --- | --- | --- |
| Người gửi | Chờ kết quả (Promise/Observable có giá trị trả) | Bắn xong quên, không có giá trị trả |
| Người nhận | Đúng 1, phải trả lời | 0..n, không trả lời gì |
| Payload | DTO của lời gọi | **Event** có `eventId` + `occurredAt` |
| Tên | Mệnh lệnh: `inventory.receive` | Quá khứ: `otp.requested` — mô tả việc ĐÃ xảy ra |
| Ai chết thì sao | Gọi lỗi ngay (504) | Event nằm chờ trong queue |

Chi tiết dễ vấp: `client.emit()` trả về **Observable lạnh** — không `.subscribe()`
thì message KHÔNG được gửi đi. Trong repo dùng `.subscribe({ error })` để publish
chạy mà vẫn không chặn luồng chính.

## Cost / đánh đổi

- **Eventually consistent**: mail tới sau vài trăm ms tới vài giây. Phải chấp nhận
  "sẽ đúng, nhưng không phải ngay lập tức" — và UI phải nói đúng sự thật đó.
- **Khó debug hơn**: `send` lỗi có stack trace tại chỗ; event lỗi phải lần theo
  "ai đã nghe, xử tới đâu" → chính vì thế Phase 4 cần distributed tracing.
- **Mất event khi crash giữa "ghi DB" và "publish"** — lỗ hổng CÒN NGUYÊN sau bước
  này (auth tạo OTP xong, chưa kịp emit thì chết). Đó là việc của **Outbox (7.3)**.
- **Có thể nhận trùng**: RabbitMQ giao "ít nhất 1 lần" → 2 mail. Việc của
  **Idempotency (7.4)** — `eventId` đã đặt sẵn trong envelope để dùng.
- Thêm 1 service để vận hành (deploy, log, monitor).

## Code tôi đã viết ở đâu

- `libs/event-contracts/src/patterns/notification-service/notification.patterns.ts` — tên event.
- `libs/event-contracts/src/events/otp-requested.event.ts` — envelope `eventId`/`occurredAt`.
- `apps/auth-service/src/auth/auth.service.ts` → `sendOtp()` — chỗ `emit`.
- `apps/notification-service/src/notification/notification.controller.ts` — `@EventPattern`.

## Điều tôi hiểu sai lúc đầu

1. **"emit là send phiên bản không chờ"** — không hẳn. Khác biệt sâu hơn: `send`
   là *tôi bảo anh làm việc này*, `emit` là *tôi thông báo việc đã xảy ra*. Người
   phát event **không biết ai nghe**, nên thêm consumer mới (SMS, push, analytics)
   KHÔNG cần sửa code bên phát. Đó mới là giá trị chính.
2. **"Chuyển hết sang event cho hiện đại"** — sai. `send` vẫn đúng khi **cần câu
   trả lời để đi tiếp** (giá bao nhiêu, còn hàng không). Repo giữ nguyên mọi `send`
   hiện có; chỉ thêm `emit` cho việc "báo cho người khác biết".
3. **"emit xong là chắc chắn tới"** — không. Có `.subscribe()` thì mới publish, và
   publish rồi vẫn có thể mất nếu crash đúng lúc. Muốn chắc phải có Outbox.
