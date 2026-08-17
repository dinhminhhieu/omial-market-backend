# Spec: notification-service

**Vai trò:** pure RMQ microservice — **CONSUMER EVENT đầu tiên của hệ**. Nghe event
từ service khác rồi gửi thông báo (hiện: email OTP). KHÔNG có HTTP, KHÔNG trả lời RPC.
**Queue:** `RMQ_NOTIFICATION_QUEUE` (`notification_queue`) · **DB:** chưa có (thêm ở 7.4).

## Trạng thái

- ✅ Scaffold + `@EventPattern('otp.requested')` + MailService (chuyển từ auth-service sang).
- ✅ Smoke pass 2026-08-13: register **0.155s** (trước phải chờ SMTP); tắt hẳn service
  này thì register vẫn 201, event nằm chờ trong queue, bật lại thì xử lý bù.
- ⬜ 7.4: DB riêng (`postgres-notification`) + bảng `processed_event` cho idempotency.
- ⬜ 7.5: ack thủ công + retry 3 lần + DLQ `dlq_notification` + endpoint replay.
- ⬜ Consumer cho các event khác (`order.placed` → mail xác nhận đơn…).

## Bản đồ file

| Đường dẫn                                                                                            | Vai trò                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [main.ts](../../apps/notification-service/src/main.ts)                                               | `createMicroservice` + `setupMicroservice`, nạp root `.env` (KHÔNG có .env riêng vì chưa có DB). |
| [notification-service.module.ts](../../apps/notification-service/src/notification-service.module.ts) | Root: CommonModule + Logger + Mail + Notification.                                               |
| `notification/notification.controller.ts`                                                            | Các handler `@EventPattern`.                                                                     |
| `mail/`                                                                                              | `MailService` (nodemailer) — **đã chuyển từ auth-service sang**.                                 |

## Event đang nghe

| Event           | Payload                                                                                                                                                      | Xử lý                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `otp.requested` | [`OtpRequestedEvent`](../../libs/event-contracts/src/events/otp-requested.event.ts) — `eventId`, `occurredAt`, `email`, `otp`, `purpose`, `expiresInMinutes` | Gửi email OTP. Không phản hồi cho auth. |

**Vì sao OTP nằm trong payload**: mã do auth-service sinh và lưu Redis RIÊNG của nó —
notification không đọc được (state per service), nên phải gửi kèm.

## Quy ước EVENT (khác RPC — đọc kỹ trước khi thêm event mới)

- Tên event = **thì quá khứ** `<chủ_thể>.<đã_xảy_ra>` (`otp.requested`), mô tả việc ĐÃ
  xảy ra — KHÔNG phải mệnh lệnh (`send_otp`). Bên phát không ra lệnh cho ai.
- Mọi event mang envelope `eventId` (UUID) + `occurredAt` (ISO) — chưa dùng ở 7.2
  nhưng 7.4 idempotency sẽ dựa vào `eventId`; đặt sẵn để khỏi phá contract sau.
- `@EventPattern` handler trả `void`; có `return` cũng không ai nhận.
- `client.emit()` trả **Observable lạnh** → phải `.subscribe()` mới thực sự publish.
- Event vẫn qua `InternalAuthGuard` (header `x-internal-token` do `rmqClientOptions`
  tự gắn) — kẻ lạ không bơm event spam vào queue được.

## Lỗ hổng CÒN LẠI sau bước này (cố ý, để dành pattern sau)

| Lỗ                                       | Hậu quả                         | Vá ở            |
| ---------------------------------------- | ------------------------------- | --------------- |
| Crash giữa "tạo OTP" và "publish"        | Event mất, user không nhận mail | 7.3 Outbox      |
| RMQ giao trùng (at-least-once)           | Gửi 2 mail                      | 7.4 Idempotency |
| Handler lỗi (SMTP sập) với `noAck: true` | Event bị bỏ luôn                | 7.5 DLQ         |
