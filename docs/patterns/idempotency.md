# Idempotency

> Note pattern thứ 4 của repo (sau database-per-service, pub-sub-vs-rpc, outbox).
> Áp dụng ở notification-service, roadmap 7.4 — kèm một bug THẬT ở inventory
> (2026-08-19) minh hoạ chỗ CHƯA áp dụng thì hỏng ra sao.

## Vấn đề nào buộc phải dùng

Idempotent = gọi 1 lần hay N lần, kết quả cuối như nhau. Hệ phân tán không cho
chọn "giao đúng 1 lần" — at-least-once là mặc định, **duplicate là tất yếu chứ
không phải tai nạn**. Trong repo này duplicate đến từ 4 nguồn:

1. Outbox worker crash sau publish, trước khi đánh dấu SENT → publish lại
   (chính outbox đã *chủ động* đổi "mất event" lấy "trùng event").
2. RabbitMQ at-least-once: ack lạc trên đường → broker giao lại.
3. 1 event lỗi làm rollback cả batch worker → event đã publish mất dấu SENT.
4. **Con người + timeout**: client bỏ chờ, báo lỗi, người dùng bấm lại — trong
   khi lệnh cũ vẫn chạy. Nguồn này áp cho cả RPC command, không riêng event.

## Không có thì hệ thống hỏng thế nào

Bug tự tay dựng được (2026-08-19, tab Kho hàng), inventory-service ĐANG TẮT:

```
FE ──HTTP──► gateway ──publish──► [inventory_queue]  ← durable, KHÔNG TTL
                │ chờ 5s → 504            │ (service chưa chạy, message nằm chờ)
                ▼                         ▼
          FE thấy "lỗi"        bật service → consume → GHI DB +25
                                reply về replyTo → không ai nghe → vứt
```

1. `POST /inventory/receive` quantity=25 → 504 "inventory-service không phản hồi".
   `timeout(5000)` của RxJS (rmq-forwarder) chỉ huỷ việc gateway NGỒI CHỜ —
   message vẫn nằm trong queue chờ vô hạn.
2. Bật `pnpm start:inventory` → service consume message "zombie" → +25.
   Reply bị vứt (correlationId không còn ai nghe) nhưng tác dụng phụ Ở LẠI.
3. Người dùng tưởng lần đầu fail, bấm lại → +25 nữa. **Bấm "nhập 25" hai lần,
   lần đầu báo lỗi — kho vẫn +50**, sổ cái 2 dòng RECEIVE cùng reason.

Không cần service chết mới dính: DB lag 6 giây lúc có tải là đủ — gateway 504,
service vẫn ghi xong. Với OTP là gửi 2 mail (phiền); với `payment.completed`
là trừ tiền 2 lần (thảm hoạ).

Bài học gốc: **504/timeout KHÔNG nghĩa là "chưa làm" — nó nghĩa là "không biết
đã làm hay chưa"** (in-doubt request). Retry một phép cộng dồn khi in-doubt là
đánh bạc với dữ liệu.

## Giải pháp

Không ngăn được duplicate ĐẾN — chỉ làm cho duplicate VÔ HẠI. Bên nhận tự nhớ
"cái này xử lý rồi" theo một cái **khoá**:

- Khoá do bên PHÁT sinh (`eventId` UUID trong envelope 7.2), consumer chỉ CHÉP
  lại: `ProcessedEvent.eventId String @id` — **KHÔNG** `@default(uuid())`.
- Check-and-set phải ATOMIC bằng chính unique constraint: `create()` rồi catch
  `P2002` → trùng → `return` êm (không throw, để message vẫn được ack).
  `findUnique` rồi `create` là 2 câu — 2 message song song lọt qua khe giữa.
- Thứ tự đã chọn: **đánh dấu TRƯỚC, gửi mail SAU** (đánh đổi ở mục dưới).

Với **command RPC** (nhập kho…) thì nguồn retry là người dùng bấm lại → khoá
phải sinh từ **FE và giữ nguyên khi bấm lại** (kiểu header `Idempotency-Key`
của Stripe). Gateway tự sinh uuid mỗi HTTP request là vô dụng: bấm lại =
request mới = key mới → vẫn cộng đôi. Bên nhận gặp key trùng thì trả lại
**kết quả cũ**, không làm lại.

## Cost / đánh đổi

- Bảng `ProcessedEvent` chỉ phình — cần cron dọn dòng cũ hơn TTL queue
  (index `processedAt` để sẵn cho việc này; cron chưa viết).
- Đánh-dấu-trước-gửi-sau: đổi "gửi 2 mail" lấy "mất 1 mail nếu SMTP lỗi sau
  khi đã đánh dấu" — lần giao lại bị coi là trùng. Lỗ này (+ `noAck: true`
  làm handler lỗi là mất event luôn) là việc của DLQ (7.5).
- Chống trùng THEO KHOÁ, không đọc được ý định: user thật sự muốn nhập 2 lô
  25 cái → FE phải sinh key MỚI cho lô thứ hai.
- Thêm 1 round-trip DB cho mỗi message.

## Code tôi đã viết ở đâu

- `apps/notification-service/prisma/schema.prisma` — model `ProcessedEvent`
  (comment trong file liệt kê các nguồn duplicate).
- `apps/notification-service/src/notification/notification.controller.ts:32-49`
  — chốt chặn create/P2002 đầu `handleOtpRequested` + 3 unit test (lần đầu ·
  trùng bỏ qua êm · lỗi DB khác P2002 thì throw).

**Chỗ CHƯA có (bug còn mở)**: `inventory.receive/issue/adjust` là command RPC
cộng dồn (`onHand: { increment }`), DTO không có idempotency key → bug +50 ở
trên vẫn tái hiện được. Vá đã lên lịch: roadmap mục 8.2b (Phase 3).
Lớp phụ trợ đáng làm kèm: TTL cho message RPC = timeout gateway (5s) để diệt
message zombie trong queue — nhưng TTL không cứu được kịch bản DB lag, nên
idempotency key vẫn là lớp chính.

## Điều tôi hiểu sai lúc đầu

1. **"Timeout rồi thì lệnh đâu có chạy"** — timeout chỉ huỷ việc CHỜ ở phía
   gọi. Message đã nằm trong durable queue; lỗi trả về FE ≠ việc không xảy ra.
2. **"Với RPC, mất message chỉ khiến client timeout & thử lại nên auto-ack là
   đủ"** (comment trong `rmq.options.ts`) — đúng vế noAck, sai vế "thử lại":
   thử lại chỉ an toàn khi operation idempotent, mà receive/issue/adjust không.
3. **"`findUnique` rồi mới `create` cho rõ ràng"** — có khe race giữa 2 câu.
   Unique constraint của DB mới là check-and-set atomic thật sự.
4. **"Idempotency là chuyện riêng của event/pub-sub"** — command RPC cũng cần:
   client-timeout-rồi-bấm-lại chính là at-least-once phiên bản con người.
