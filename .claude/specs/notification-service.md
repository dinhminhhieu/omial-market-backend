# Spec: notification-service

**Vai trò:** pure RMQ microservice — **CONSUMER EVENT đầu tiên của hệ**. Nghe event
từ service khác rồi gửi thông báo (hiện: email OTP). KHÔNG có HTTP, KHÔNG trả lời RPC.
**Queue:** `RMQ_NOTIFICATION_QUEUE` (`notification_queue`) · **DB:** `omial_notification_db`
(:5438) qua Prisma 7 + `@prisma/adapter-pg` — chỉ giữ bảng `ProcessedEvent` (idempotency).

## Trạng thái

- ✅ Scaffold + `@EventPattern('otp.requested')` + MailService (chuyển từ auth-service sang).
- ✅ Smoke pass 2026-08-13: register **0.155s** (trước phải chờ SMTP); tắt hẳn service
  này thì register vẫn 201, event nằm chờ trong queue, bật lại thì xử lý bù.
- ✅ **7.4 Idempotency**: DB riêng (`postgres-notification` :5438) + model `ProcessedEvent`
  (migration `20260817070403_add_processed_event`) + check-and-set atomic trong controller
  + 3 unit test (lần đầu / trùng P2002 / lỗi DB khác). Xem mục 📥 dưới.
- ⬜ 7.5: ack thủ công + retry 3 lần + DLQ `dlq_notification` + endpoint replay.
- ⬜ Note học `docs/patterns/idempotency.md` (Phase 2 yêu cầu 1 note / pattern — chưa viết).
- ⬜ Consumer cho các event khác (`order.placed` → mail xác nhận đơn…).

## Bản đồ file

| Đường dẫn                                                                                            | Vai trò                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [main.ts](../../apps/notification-service/src/main.ts)                                               | `createMicroservice` + `setupMicroservice`, nạp root `.env` **+ `apps/notification-service/.env`** (DATABASE_URL, có từ 7.4). |
| [notification-service.module.ts](../../apps/notification-service/src/notification-service.module.ts) | Root: CommonModule + Logger + **PrismaModule** + Mail + Notification.                            |
| [notification/notification.controller.ts](../../apps/notification-service/src/notification/notification.controller.ts) | Các handler `@EventPattern` — mỗi handler mở đầu bằng chốt idempotency.          |
| `mail/`                                                                                              | `MailService` (nodemailer) — **đã chuyển từ auth-service sang**.                                 |
| `prisma/`                                                                                            | `PrismaService` + `PrismaModule` (adapter-pg). Schema chỉ 1 model `ProcessedEvent`.              |

## Event đang nghe

| Event           | Payload                                                                                                                                                      | Xử lý                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `otp.requested` | [`OtpRequestedEvent`](../../libs/event-contracts/src/events/otp-requested.event.ts) — `eventId`, `occurredAt`, `email`, `otp`, `purpose`, `expiresInMinutes` | Gửi email OTP. Không phản hồi cho auth. |

**Vì sao OTP nằm trong payload**: mã do auth-service sinh và lưu Redis RIÊNG của nó —
notification không đọc được (state per service), nên phải gửi kèm.

## 📥 Idempotency (7.4) — đọc trước khi thêm consumer mới

**Luật:** MỌI handler `@EventPattern` phải mở đầu bằng chốt idempotency, không có ngoại lệ.
Outbox (7.3) đổi "mất event" thành "trùng event" nên đây là phần bắt buộc của cặp.

- Khoá chống trùng = **`eventId` do bên PHÁT sinh** (`ProcessedEvent.eventId String @id`,
  KHÔNG `@default(uuid())` — consumer chỉ chép lại, tự sinh id là mất tác dụng).
- Cơ chế: `processedEvent.create()` rồi **catch `P2002`** → đã xử lý, `return` êm
  (KHÔNG throw, để message vẫn được ack). Lỗi khác P2002 thì throw lên.
  Dùng unique constraint của DB làm check-and-set **atomic** — `findUnique` rồi `create`
  là 2 câu, hai message song song cùng lọt qua khe giữa.
- **Thứ tự: đánh dấu TRƯỚC, gửi mail SAU.** Đổi "gửi 2 mail" (phiền) lấy "có thể mất
  1 mail nếu SMTP lỗi sau khi đánh dấu" — và với `noAck: true` thì lỗi handler cũng mất
  event luôn. Cả hai lỗ này là việc của **7.5** (ack thủ công + retry + DLQ).
- 3 nguồn sinh duplicate (ghi trong comment schema): worker crash sau publish trước SENT ·
  RMQ at-least-once mất ack · 1 event lỗi làm rollback cả batch worker.
- Bảng chỉ phình chứ không nhỏ đi → có `@@index([processedAt])` cho cron dọn dòng cũ
  hơn TTL queue (⬜ chưa viết cron).

## Env cần
- `DATABASE_URL` — ở `apps/notification-service/.env` (mẫu: `.env.example`).
- Root `.env`: `RABBITMQ_URL`, `RMQ_NOTIFICATION_QUEUE`, `INTERNAL_SERVICE_TOKEN`,
  `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`.

## Hạ tầng
`docker compose up -d postgres-notification` (:5438) · `pnpm db:migrate:notification`
(deploy) · `pnpm start:notification`.

## Quy ước EVENT (khác RPC — đọc kỹ trước khi thêm event mới)

- Tên event = **thì quá khứ** `<chủ_thể>.<đã_xảy_ra>` (`otp.requested`), mô tả việc ĐÃ
  xảy ra — KHÔNG phải mệnh lệnh (`send_otp`). Bên phát không ra lệnh cho ai.
- Mọi event mang envelope `eventId` (UUID) + `occurredAt` (ISO) — `eventId` **đang được
  dùng làm khoá chống trùng** (7.4, xem mục 📥). Event mới thiếu `eventId` = consumer
  không chống trùng được.
- `@EventPattern` handler trả `void`; có `return` cũng không ai nhận.
- `client.emit()` trả **Observable lạnh** → phải `.subscribe()` mới thực sự publish.
- Event vẫn qua `InternalAuthGuard` (header `x-internal-token` do `rmqClientOptions`
  tự gắn) — kẻ lạ không bơm event spam vào queue được.

## Lỗ hổng của luồng event — cái nào đã vá, cái nào còn

| Lỗ                                       | Hậu quả                         | Vá ở                  |
| ---------------------------------------- | ------------------------------- | --------------------- |
| Crash giữa "tạo OTP" và "publish"        | Event mất, user không nhận mail | ✅ 7.3 Outbox         |
| RMQ giao trùng (at-least-once)           | Gửi 2 mail                      | ✅ 7.4 Idempotency    |
| Handler lỗi (SMTP sập) với `noAck: true` | Event bị bỏ luôn                | ⬜ 7.5 DLQ            |
| SMTP lỗi SAU khi đã đánh dấu processed   | Mail mất, retry cũng bị coi trùng | ⬜ 7.5 (ack thủ công) |
