# Outbox Pattern

> Note pattern thứ 3 của repo (sau database-per-service, pub-sub-vs-rpc).
> Áp dụng ở auth-service, roadmap 7.3.

## Vấn đề nào buộc phải dùng

**Dual write**: một hành động nghiệp vụ cần ghi vào 2 hệ thống khác nhau
(Postgres + RabbitMQ) mà không có transaction chung. Luôn tồn tại khe hở giữa
hai lần ghi, và không có cách sắp xếp thứ tự nào né được:

```ts
await prisma.user.upsert(...)   // ① COMMIT xong
    💥 crash / broker sập / mạng đứt
await client.emit('otp.requested', ...)   // ② không bao giờ chạy
```

Đảo thứ tự cũng hỏng theo cách khác: emit trước rồi crash → đã gửi mail OTP cho
một tài khoản không tồn tại.

## Không có thì hệ thống hỏng thế nào

Kịch bản đã dựng lại được trong repo (smoke 2026-08-17):

1. `docker stop rabbitmq`
2. `POST /auth/register` → user **đã** nằm trong Postgres
3. Với code 7.2 (emit thẳng): `emit` fail → chỉ `logger.error` rồi thôi.
   **Event bốc hơi.** Không ai biết mà retry; user chờ mail vĩnh viễn, và nếu
   process chết luôn thì cả dòng log cũng mất.

Nghiêm trọng hơn ở nghiệp vụ tiền: ghi nhận "đã thanh toán" vào DB rồi crash
trước khi báo kho → tiền đã trừ mà đơn không bao giờ được giao.

## Giải pháp

RabbitMQ không vào transaction được, nhưng **một cái bảng trong Postgres thì có**.
Không publish trực tiếp nữa — ghi *ý định publish* vào bảng `OutboxEvent` trong
CÙNG transaction với việc nghiệp vụ. Một worker chạy nền đọc PENDING rồi publish.

```
$transaction { user.upsert + outboxEvent.create(PENDING) }   ⬅️ MỘT commit
                          ↓
        OutboxWorker @Interval(1s): SELECT ... FOR UPDATE SKIP LOCKED
                          ↓ emit
                    đánh dấu SENT
```

| Crash lúc | Kết quả |
| --- | --- |
| Trước COMMIT | Cả hai rollback — như chưa xảy ra ✅ |
| Sau COMMIT, trước khi worker quét | Dòng PENDING nằm yên; restart → publish ✅ |
| Sau publish, trước khi đánh dấu SENT | Publish LẠI → consumer nhận trùng ⚠️ |

## Cost / đánh đổi

- **Đổi "mất event" lấy "trùng event"** — đây là điểm cốt lõi. At-most-once →
  at-least-once. Trùng thì vá được (idempotency, 7.4); mất thì chịu.
  ⇒ **Outbox mà không có idempotency là làm nửa vời.**
- Trễ thêm ≤1 chu kỳ worker (1s).
- Thêm bảng + worker phải vận hành; phải dọn dòng SENT cũ kẻo bảng phình.
- Tải DB: poll mỗi giây.
- **Bẫy multi-replica**: 2 instance → 2 worker cùng đọc 1 dòng → publish 2 lần.
  Giải bằng `FOR UPDATE SKIP LOCKED` (đơn giản, đã dùng) hoặc leader election.

**Alternative**: CDC / Debezium — đọc thẳng WAL của Postgres, thấy INSERT thì tự
publish, khỏi worker và khỏi poll. Đổi lại phải dựng Kafka Connect + Debezium.
Không đáng ở quy mô này.

## Code tôi đã viết ở đâu

- `apps/auth-service/prisma/schema.prisma` — model `OutboxEvent` + enum `OutboxStatus`.
- `apps/auth-service/src/outbox/outbox.service.ts` — `enqueue(tx, ...)` (phần ghi).
- `apps/auth-service/src/outbox/outbox.worker.ts` — `@Interval(1000)` (phần phát).
- `apps/auth-service/src/auth/auth.service.ts:~100` — `register` bọc `$transaction`.

## Điều tôi hiểu sai lúc đầu

1. **"Có outbox là không mất event nữa, xong"** — sai một nửa. Outbox chỉ dời
   vấn đề: từ *mất* sang *trùng*. Phải làm tiếp idempotency mới trọn.
2. **"enqueue tự mở transaction cho tiện"** — làm vậy là quay lại đúng dual write:
   transaction của outbox tách rời transaction nghiệp vụ. Chữ ký hàm PHẢI ép
   nhận `tx` từ bên gọi.
3. **"Retry càng nhanh càng tốt"** — `@Interval(1000)` không backoff thì broker
   restart 10 giây sẽ đốt sạch 5 lần thử trong 5 giây, mọi event bị đánh FAILED
   vĩnh viễn. Outbox sinh ra để không mất event, mà retry sai lại làm mất theo
   cách khác. Backoff `2^n` giây là bắt buộc.
4. **"Cứ bọc $transaction cho chắc"** — chỉ cần khi buộc NHIỀU lần ghi vào cùng
   một COMMIT. Ghi đúng 1 dòng thì INSERT tự nó đã atomic (xem `resendOtp`).
