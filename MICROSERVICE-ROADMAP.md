# MICROSERVICE-ROADMAP.md — Lộ trình học microservice qua project omial

> File này là **bản đồ học tập cá nhân** cho việc nâng project navis-backend
> từ "prototype REST → RMQ" thành 1 hệ thống microservice **đầy đủ pattern, có
> test, có observability, deploy được**. Được thiết kế để đọc lại nhiều lần trong
> 6 tháng tới. Đọc theo thứ tự phase — **đừng nhảy cóc**.

## Mục lục

- [1. Cách dùng file này](#1-cách-dùng-file-này)
- [2. Trạng thái hiện tại (baseline)](#2-trạng-thái-hiện-tại-baseline)
- [3. Nguyên tắc học — 3 câu hỏi mỗi pattern](#3-nguyên-tắc-học--3-câu-hỏi-mỗi-pattern)
- [4. Bảng tổng quan 6 phase](#4-bảng-tổng-quan-6-phase)
- [5. Phase 0 — Hoàn thiện nền tảng](#5-phase-0--hoàn-thiện-nền-tảng)
- [6. Phase 1 — Security & API Gateway hoàn chỉnh](#6-phase-1--security--api-gateway-hoàn-chỉnh)
- [7. Phase 2 — Event-Driven thật sự](#7-phase-2--event-driven-thật-sự)
- [8. Phase 3 — Resilience & Fault Tolerance](#8-phase-3--resilience--fault-tolerance)
- [9. Phase 4 — Observability](#9-phase-4--observability)
- [10. Phase 5 — Deployment & Scale](#10-phase-5--deployment--scale)
- [11. Phase 6 — Advanced (Optional)](#11-phase-6--advanced-optional)
- [12. Testing Strategy xuyên suốt](#12-testing-strategy-xuyên-suốt)
- [13. Documentation Practice](#13-documentation-practice)
- [14. Bảng tra pattern nhanh](#14-bảng-tra-pattern-nhanh)
- [15. Anti-patterns cần tránh](#15-anti-patterns-cần-tránh)
- [16. Tài liệu tham khảo](#16-tài-liệu-tham-khảo)

---

## 1. Cách dùng file này

### Thứ tự bắt buộc

Đi **tuần tự Phase 0 → 6**. Mỗi phase là 1 đơn vị trọn vẹn — làm hoàn chỉnh,
kiểm tra tiêu chí thành công, rồi mới sang phase tiếp. **Nhảy phase = học vẹt.**

### Cường độ đề xuất

| Thời gian rảnh | Xong toàn bộ |
| -------------- | ------------ |
| 5h/tuần        | 6–8 tháng    |
| 10h/tuần       | 3–5 tháng    |
| Full-time      | 6–8 tuần     |

Đừng ép nhanh. Học microservice là học **tư duy phân tán**, không phải học API mới.

### Nhật ký học

Sau mỗi pattern học xong, viết note trong `docs/patterns/<pattern-name>.md`:

```markdown
# <Pattern name>

## Vấn đề nào buộc phải dùng

## Không có thì hệ thống hỏng thế nào (scenario cụ thể)

## Cost / đánh đổi

## Code tôi đã viết ở đâu (file:line)

## Điều tôi hiểu sai lúc đầu
```

Không viết note = không hiểu = chưa xong pattern.

---

## 2. Trạng thái hiện tại (baseline)

Tính đến ngày `2026-07-29`:

| Thành phần             | Trạng thái                                                               |
| ---------------------- | ------------------------------------------------------------------------ |
| api-gateway            | HTTP entry duy nhất, forward RMQ tới auth + product                      |
| auth-service           | Pure microservice, đủ luồng auth (login/register+OTP/refresh/reset)      |
| product-service        | Đang migrate — mới xong module `brand` (CRUD + soft delete + pagination) |
| order-service          | REST scaffold, **chưa** migrate                                          |
| inventory-service      | REST scaffold, **chưa** migrate                                          |
| DB per service         | ✅ Auth + Product có Postgres riêng                                      |
| RMQ                    | ✅ Có, nhưng **chỉ dùng request-response (send/receive)**                |
| JWT verify tập trung   | ❌ Chưa có Guard ở gateway                                               |
| Event-driven thực sự   | ❌ 0 `emit()` / `EventPattern`                                           |
| Rate limiting          | ❌ Chưa                                                                  |
| Circuit breaker        | ❌ Chưa                                                                  |
| Distributed tracing    | ❌ Chưa                                                                  |
| Health check           | ❌ Chưa                                                                  |
| Unit test              | 🟡 Mới có 10 test cho brand.service                                      |
| Integration test       | ❌ Chưa                                                                  |
| E2E test               | ❌ Chưa                                                                  |
| Dockerfile per service | ❌ Chưa                                                                  |
| CI/CD                  | ❌ Chưa                                                                  |

**Điểm mạnh nhất** hiện tại: kiến trúc monorepo sạch, có shared lib tốt, error
filter đã handle RPC đúng.

**Điểm yếu nhất**: dùng RMQ như "HTTP đội lốt async" — mất hoàn toàn giá trị
của message broker. Phase 2 sẽ sửa cái này.

---

## 3. Nguyên tắc học — 3 câu hỏi mỗi pattern

Trước khi code 1 pattern, **phải trả lời được 3 câu** (viết vào note):

1. **Vấn đề gì buộc phải dùng pattern này?**
   - Nếu không có "vấn đề" cụ thể → đừng dùng.
2. **Nếu không dùng thì hệ thống hỏng ở đâu?**
   - Mô tả scenario cụ thể (server crash lúc nào, request nào timeout).
3. **Cost / đánh đổi là gì?**
   - Mọi pattern đều đắt. Nếu bạn không thấy cost → chưa hiểu.

**Ví dụ trả lời tốt** (Circuit Breaker):

- Vấn đề: khi product-service chết, mỗi request gateway phải chờ 5s timeout →
  gateway hết thread → toàn hệ thống chết theo.
- Không có: 1 service chết → cascade failure toàn hệ thống.
- Cost: thêm phụ thuộc `opossum`, thêm state (circuit open/closed/half-open),
  fallback response có thể sai nghiệp vụ nếu không thiết kế cẩn thận.

**Ví dụ trả lời tệ** (học vẹt):

- Vấn đề: kiến trúc microservice cần circuit breaker.
- Không có: hệ thống không "chuẩn microservice".
- Cost: không biết.

---

## 4. Bảng tổng quan 6 phase

| Phase | Chủ đề                        | Thời gian | Pattern chính                                                       |
| ----- | ----------------------------- | --------- | ------------------------------------------------------------------- |
| **0** | Hoàn thiện nền tảng           | 2–3 tuần  | Migration completeness, unit test coverage                          |
| **1** | Security & Gateway hoàn chỉnh | 2 tuần    | API Gateway đầy đủ, JWT verify, Rate limit, Service-to-service auth |
| **2** | Event-Driven thật sự          | 3–4 tuần  | Publish/subscribe, Outbox, Idempotency, DLQ, Saga                   |
| **3** | Resilience                    | 3 tuần    | Circuit Breaker, Retry, Timeout, Bulkhead                           |
| **4** | Observability                 | 3 tuần    | Distributed Tracing, Log Aggregation, Metrics, Health Check         |
| **5** | Deployment & Scale            | 3–4 tuần  | Docker, K8s, Service Discovery via K8s, CI/CD                       |
| **6** | Advanced (optional)           | Khi cần   | CQRS, Event Sourcing, BFF, Service Mesh                             |

**Tổng**: 16–19 tuần part-time nghiêm túc.

---

## 5. Phase 0 — Hoàn thiện nền tảng

**Mục tiêu**: đóng gap những gì đang dở, tránh xây pattern mới trên nền chưa
chắc. Học ít pattern nhưng học **thói quen hoàn thiện**.

### 5.1. Migrate hết REST → microservice

- [ ] Migrate `product-service` các module còn lại: `label`, `category`, `product`, `product-variant`, `product-attribute`, `product-option`.
- [ ] Migrate `order-service`: CRUD order, order items, order status flow.
- [ ] Migrate `inventory-service`: stock per variant, reserve/release stock.
- [ ] Mỗi service chạy độc lập, có schema Prisma riêng, docker-compose lên được.

**Học được**: pattern **Database per Service** thực chiến, cảm nhận được đau
khi không thể `JOIN` cross-service. Và việc migrate từng module một (hệ cũ +
mới chạy song song) chính là pattern **Strangler Fig** — bạn đang áp dụng mà
không biết tên.

### 5.2. Unit test có ý nghĩa — ✅ XONG (2026-08-13: 169 test, 70.6% stmts)

- [x] Coverage tối thiểu **60%** → đạt **70.6%**; `coverageThreshold` 65/50/65 đã bật
      trong `package.json` → `pnpm test:cov` tự FAIL nếu tụt.
- [x] `collectCoverageFrom` chỉ đo `*.service.ts` + `*.validator.ts` + libs — loại
      generated/dto/module/main (wiring không có logic, test chỉ để làm đẹp số).
- [x] Ưu tiên business logic: máy trạng thái order, optimistic lock + conditional
      update inventory, cycle category, invariant product type, sync option giữ id,
      OTP (băm/cooldown/brute-force), token rotation, chống email enumeration.
- [x] Mẫu mock dùng lại được: `$transaction: jest.fn(cb => cb(prismaMock))` ·
      ClientProxy `{ send: jest.fn(() => of(x)) }` · `jest.mock('bcryptjs')`
      (spyOn không ghi đè được — property non-configurable).
- Còn nợ: `product.service` 66% (nhánh sync variant/attribute), `all-exceptions.filter`,
  `roles.guard` (test khi làm Phase 1).

### 5.3. Integration test đầu tiên — ✅ XONG (2026-08-13)

- [x] `@testcontainers/postgresql` — bật Postgres 16 THẬT trong Docker mỗi lần chạy.
- [x] Config riêng `test/jest-integration.json` (match `*.int-spec.ts`, `maxWorkers:1`,
      timeout 120s); script `pnpm test:int`. **Bẫy: unit `testRegex` `.*\.spec\.ts$`
      cũng khớp `*.int-spec.ts`** → thêm `testPathIgnorePatterns` để `pnpm test`
      không vô tình bật Docker.
- [x] Helper dùng chung `libs/shared/src/testing/postgres-container.ts`:
      bật container → chạy `prisma migrate deploy` THẬT (chứng minh migration apply
      sạch từ 0) → trả `databaseUrl`. **KHÔNG export trong barrel** (kéo devDep vào build).
- [x] Chọn **inventory** thay vì auth-login (roadmap gợi ý): inventory có nhiều ràng
      buộc DB đáng chứng minh nhất, login lại phải mock Redis nên giá trị thấp hơn.
- [x] 7 ca CHỈ integration test bắt được (mock không thấy):
      CHECK `reserved <= onHand` + `onHand >= 0` thật sự chặn raw UPDATE ·
      unique `(refType, refId)` giữ đúng 1 dòng khi upsert · conditional UPDATE chặn
      oversell ở tầng DB · bất biến sổ cái `onHand == SUM(delta)` đúng sau chuỗi thao tác.
- Giá trị: unit test mock Prisma → chưa câu query nào từng chạy thật; `$transaction`
  mock `cb=>cb(prisma)` KHÔNG rollback. Integration test vá đúng lỗ hổng đó.

### 5.4. Structured logging cơ bản — ✅ XONG (2026-08-13)

- [x] `nestjs-pino` thay `Logger` mặc định ở CẢ 5 app; config dùng chung 1 chỗ
      (`libs/shared/.../logger.config.ts` → `buildLoggerOptions(serviceName)`).
- [x] Mỗi dòng log có `service`, `time`, `level`, `msg`, `context` + `responseTime`.
      Dev dùng `pino-pretty`, production ra JSON thuần (điều kiện `NODE_ENV`).
- [x] `redact` che `req.headers.authorization` (quan trọng từ Phase 1 — token nằm ở đó).
- [x] `customProps` gắn sẵn `traceId` (hiện = `req.id`, counter theo tiến trình) —
      Phase 4 thay bằng UUID truyền xuyên service là xong.
- [x] Gỡ `loggerMiddleware` cũ khỏi `setupApp()` (pino-http đã tự log request → tránh log 2 lần).

### 5.5. Chiến lược xoá dữ liệu (data lifecycle)

Quyết định **per-entity**, không phải chính sách toàn hệ thống. Câu hỏi định
hướng: _dữ liệu lịch sử có tham chiếu tới nó không, luật có bắt giữ/bắt xoá không?_

- [ ] Mỗi bảng chọn 1 trong 4 chiến lược:
  - **Soft delete** (product, category, brand, label — bị order/product tham chiếu).
  - **Status thay vì xoá** (order: `CANCELLED`/`REFUNDED` — huỷ ≠ xoá, đơn là chứng từ).
  - **Append-only** (stock movement — như sổ kế toán: sai thì ghi bù, không tẩy).
  - **Hard delete / TTL** (OTP, refresh token — Redis TTL đang làm sẵn).
- [ ] User: soft delete + **anonymize PII** khi user yêu cầu xoá (giữ `id` cho FK
      order, ghi đè email/tên/sđt — Nghị định 13/2023 VN, GDPR).
- [ ] Bẫy **soft delete + `@unique`** (slug/sku): dòng đã xoá vẫn chiếm slug →
      đổi slug lúc xoá (`-deleted-{ts}`) hoặc partial unique index
      (`WHERE "isDeleted" = false` — raw SQL trong migration, Prisma chưa khai báo được).
- [ ] Viết note `docs/patterns/soft-delete.md` (cost: mọi query phải nhớ `isDeleted: false`).
- Nâng cấp sau (Phase 2+, khi đã học cron ở Outbox): sọt rác + restore + cron
  purge quá 30 ngày.

### Tiêu chí thành công Phase 0

- Chạy `docker compose up` → cả 5 app (gateway, auth, product, order, inventory) đều lên khoẻ mạnh.
- `pnpm test` xanh, coverage ≥ 60%.
- Postman collection test được đủ luồng CRUD của product/order/inventory.
- File `docs/patterns/database-per-service.md` viết xong (note pattern đầu tiên).

---

## 6. Phase 1 — Security & API Gateway hoàn chỉnh

**Mục tiêu**: hoàn thiện pattern **API Gateway** đúng nghĩa. Đây là bộ mặt của
hệ thống — làm sai là **cả hệ thống bị đục lỗ**.

### 6.1. JWT verify tập trung ở Gateway — ✅ XONG (2026-08-13)

- [x] `JwtAuthGuard` global ở gateway ([libs/shared/.../jwt-auth.guard.ts](libs/shared/src/common/guards/jwt-auth.guard.ts)).
      **KHÔNG dùng passport**: gateway chỉ cần verify chữ ký + gắn `request.user`
      (~30 dòng); passport thêm 3 dependency và che mất thứ đang cần học.
- [x] `@Public()` (đã có sẵn) đánh dấu 8 route auth + các route GET công khai.
- [x] Guard chuẩn hoá `role` (chuỗi, do auth ký) → `roles` (mảng, RolesGuard đọc).
- [x] Forward danh tính: gateway **ĐÈ** `customerId` trong payload bằng `user.sub`
      lấy từ token — FE gửi id giả cũng vô ích (đã smoke chứng minh).
- [x] RBAC: seed 2 tài khoản `demo@omial.dev` (USER) / `admin@omial.dev` (ADMIN),
      chính sách: GET sản phẩm/danh mục = `@Public`, mọi thao tác GHI + kho + đơn = `@Roles('ADMIN')`.
- [x] Smoke: POST /products không token → 401 **tại gateway**; token USER → 403; ADMIN → 201.
- [x] Unit test 13 ca cho 2 guard.
- ⚠️ Bẫy đã dính: `JwtModule.register({secret: process.env...})` đọc env lúc
  import → webpack hoist import lên TRƯỚC `loadEnv()` → secret `undefined` →
  mọi token đều 401. Phải dùng `registerAsync` + `useFactory` (chạy lúc DI init).

### 6.2. Service-to-service authentication

**Vấn đề**: nếu ai đó gửi trực tiếp message RMQ (bypass gateway) → làm gì cũng được. Phải chứng thực service ↔ service.

- [x] Chọn **shared secret**, đặt trong **AMQP header** `x-internal-token`
      (KHÔNG nhét payload: nhiều pattern gửi payload là string thuần như
      `send(FIND_ONE, id)` nên không có chỗ đính kèm, và nhét vào payload thì
      ValidationPipe `forbidNonWhitelisted` sẽ chửi).
      Gắn 1 lần trong `rmqClientOptions` → mọi client (gateway + service gọi service) tự có.
- [x] `InternalAuthGuard` đăng ký global trong `CommonModule`, chỉ áp cho context
      RPC nên gateway HTTP không ảnh hưởng.
- [x] Đã VERIFY bằng script tấn công thật (publish thẳng vào `product_queue` bằng
      amqplib): không token → 401, token sai → 401, token đúng → lọt.
- Cost của mTLS (chưa làm): phải phát/gia hạn cert cho từng service + cấu hình
  RabbitMQ TLS; đổi lại chống được cả replay lẫn lộ secret. Để dành production thật.

### 6.3. Rate limiting

- [x] `@nestjs/throttler` + `ThrottlerGuard` global (chạy TRƯỚC JwtAuthGuard —
      chặn spam bằng thứ rẻ nhất, không tốn công verify chữ ký).
- [x] Global 100 req/phút/IP; `@Throttle` riêng: login 5, register 3, forgot-password 3.
- [x] Smoke: bắn 7 lần login sai → `401 401 401 401 429 429 429`.

### 6.4. Input validation nghiêm — ✅ XONG (2026-08-13)

- [x] Mọi DTO có validator; ValidationPipe global bật `whitelist` +
      `forbidNonWhitelisted` + `transform` cho CẢ gateway lẫn service.
      Smoke: gửi field lạ `isAdmin` → `400 property isAdmin should not exist`
      (chính là lá chắn chống **mass assignment**, không chỉ chống typo).
- [x] `ClassSerializerInterceptor` đăng ký global trong `CommonModule`;
      `product.toResponse()` destructure bỏ `isDeleted`/`deletedAt`/`productLabels`
      — smoke xác nhận response không còn field nội bộ.
- [x] SQL injection: `search='; DROP TABLE "Brand"; --` → trả 0 kết quả, bảng còn
      nguyên. **Lý do an toàn: Prisma parameterize mọi query**, chuỗi vào `contains`
      chỉ là dữ liệu. Nơi DUY NHẤT phải tự cẩn thận là `$queryRaw` —
      `inventory.issue` dùng template literal của Prisma (tự parameterize), KHÔNG nối chuỗi.

### 6.5. Secret management

- [x] `.env.example` (root + mỗi service) làm template, `.env` + `apps/*/.env`
      đã gitignore (`!.env.example` để template vẫn được commit).
- [ ] Học `docker secrets` cho compose.
- [ ] Note: production dùng Vault / AWS Secrets Manager / K8s Secret.

### 6.6. CORS + Helmet

- [x] `helmet` trong `setupApp()` — đặt sớm nhất để áp cả response lỗi.
      CSP tắt khi còn bật Swagger (CSP mặc định chặn inline script → vỡ /docs).
- [x] CORS whitelist qua `CORS_ORIGINS` (phân tách dấu phẩy) + `credentials: true`.
      Bỏ trống = cho phép mọi origin, CHỈ hợp cho dev.

### Tiêu chí thành công Phase 1

- Không thể gọi API nào (trừ `@Public`) mà không có JWT hợp lệ.
- Không thể gửi trực tiếp RMQ message tới service mà không có internal auth.
- Login bruteforce → chặn sau 5 lần fail.
- File `docs/patterns/api-gateway.md`, `docs/patterns/service-to-service-auth.md` viết xong.

---

## 7. Phase 2 — Event-Driven thật sự

**Mục tiêu**: đảo tư duy từ RPC sync (`send`) sang event async (`emit`). **Đây là
pattern quan trọng nhất cả roadmap** — nếu chỉ có thời gian học 1 phase, học phase này.

### 7.1. So sánh `send` vs `emit` — ✅ XONG (2026-08-17)

- [x] Chứng minh bằng smoke thật thay vì spec: register **0.155s** (không còn chờ SMTP);
      **tắt hẳn notification-service** → register vẫn 201/0.082s, event nằm chờ trong
      queue (`1 message, 0 consumer`), bật lại service thì event tồn đọng tự xử lý.
- [x] Note `docs/patterns/pub-sub-vs-rpc.md` (kèm bảng số đo + 3 điều hiểu sai).
- Chốt quy ước: tên event **thì quá khứ** `otp.requested`; envelope `eventId` +
  `occurredAt` cho MỌI event; `emit()` trả Observable LẠNH → phải `.subscribe()`.

### 7.2. Use case 1: `otp.requested` event — ✅ XONG (2026-08-17)

**Trước**: `register()` `await` nodemailer → khách chờ SMTP ~2s, và **SMTP sập là
đăng ký fail** dù user đã nằm trong DB (bug thật, không chỉ chậm).

**Sau**: `register()` chỉ ghi event → trả về **0.155s**. notification-service nghe
`@EventPattern('otp.requested')` rồi gửi mail.

- [x] Tạo `notification-service` (pure RMQ consumer). **Chưa có DB** — thêm ở 7.4.
- [x] `MailService` **chuyển hẳn** từ auth sang (git mv) — auth không còn dòng
      nodemailer nào. Copy mà vẫn giữ ở auth thì chưa gọi là tách.
- [x] Event đặt tên thì QUÁ KHỨ `otp.requested` (mô tả việc ĐÃ xảy ra), không
      phải mệnh lệnh `send_otp` — bên phát không ra lệnh cho ai.
- [x] Envelope chuẩn: `eventId` + `occurredAt` khai từ đầu dù 7.2 chưa dùng.
- [x] Test: register < 200ms; **tắt hẳn notification-service** → register vẫn 201,
      event nằm chờ trong queue, bật lại thì xử lý bù.
- [x] Sửa câu chữ: "OTP **đang** được gửi" thay vì "đã gửi" — UI của luồng async
      phải nói đúng trạng thái async, không hứa chuyện chưa xảy ra.
- ⚠️ Bẫy: `emit()` trả **Observable lạnh** — không `.subscribe()` thì KHÔNG gửi gì
  cả, mà cũng không báo lỗi.

### 7.3. Outbox Pattern — ✅ XONG (2026-08-17)

**Vấn đề**:

```ts
await prisma.user.create({ data }); // 1. DB write
await client.emit('user.registered'); // 2. Publish event
```

Nếu crash giữa (1) và (2) → user tạo rồi nhưng không gửi email. Ngược lại
publish rồi rollback DB → email gửi sai sự thật.

**Giải pháp Outbox**:

- Trong cùng transaction: `user.create()` + `outbox_event.create({ payload, status: 'pending' })`.
- Background worker đọc `outbox_event` → publish RMQ → mark `status: 'sent'`.
- Nếu crash: worker restart, tiếp tục xử lý event chưa sent.

Tasks:

- [x] Table `OutboxEvent` (pattern, payload Json, status, attempts, lastError,
      **nextRetryAt**, publishedAt) + enum `OutboxStatus` — auth-service.
- [x] `register` atomic: `$transaction { user.upsert + outbox.enqueue }`.
      `enqueue(tx, ...)` **bắt buộc nhận tx** — tự mở transaction là quay lại dual write.
- [x] `OutboxWorker` `@Interval(1000)`: `FOR UPDATE SKIP LOCKED` (chống 2 replica
      publish trùng) → `firstValueFrom(emit)` → SENT; fail thì attempts++ + backoff.
- [x] Test đã chạy: `docker stop rabbitmq` → register vẫn 201, event PENDING;
      kill auth-service; bật lại broker + auth → event tự SENT.
- [x] Note `docs/patterns/outbox.md`.
- ⚠️ **Backoff là BẮT BUỘC**: `@Interval(1000)` không backoff → broker restart 10s
  đốt sạch 5 lần thử trong 5 giây, mọi event FAILED vĩnh viễn. Dùng `nextRetryAt = now + 2^n giây`.
- ⚠️ Thứ tự với Redis: tạo OTP (Redis) TRƯỚC rồi mới vào transaction. Ngược lại
  crash giữa chừng → event mang mã OTP không có trong Redis.
- Cải tiến để dành: transaction hiện ôm cả network I/O (Prisma timeout mặc định 5s).
  Bài bản hơn là _claim pattern_ (tx ngắn đánh dấu PROCESSING → publish ngoài tx → SENT).
- [ ] Note: Debezium là alternative (CDC log Postgres).
- [ ] Bài tập phụ (tái dùng kỹ năng cron vừa học): job `purgeTrash` xoá cứng các
      dòng soft-deleted quá 30 ngày (xem 5.5) — nhớ xử lý FK (con trước cha) và bẫy
      multi-replica (cron chạy N lần khi scale).
- [ ] **Cảnh báo khi scale**: chạy 2+ replicas → 2 worker cùng đọc outbox → publish
      trùng. Giải pháp: `SELECT ... FOR UPDATE SKIP LOCKED` (đơn giản, khuyến nghị)
      hoặc pattern **Leader Election** (chỉ 1 instance làm worker). Idempotency ở
      consumer (7.4) là lưới an toàn cuối.

### 7.4. Idempotency — consumer phải chịu được duplicate — ✅ XONG (2026-08-17)

**Vấn đề**: RMQ có at-least-once delivery. Consumer nhận cùng event 2 lần → gửi
email 2 lần → user pissed off. Và Outbox (7.3) vừa **chủ động** đổi "mất event"
thành "trùng event" → thiếu mục này thì 7.3 mới làm được nửa việc.

**Giải pháp**:

- Mỗi event có `eventId` (UUID) — đã khai sẵn trong envelope từ 7.2, đúng lúc dùng.
- Consumer lưu `ProcessedEvent(eventId)`: `eventId String @id`, **KHÔNG**
  `@default(uuid())` — id do bên PHÁT sinh ra, consumer chỉ chép lại.
- Check-and-set **atomic bằng chính unique constraint**: `create()` rồi catch `P2002`
  → đã xử lý, `return` êm (không throw, để message vẫn được ack). `findUnique` rồi
  `create` là 2 câu — 2 message song song lọt qua khe giữa.

Tasks:

- [x] `eventId` có trong mọi event payload (envelope từ 7.2 — `OtpRequestedEvent`).
- [x] notification-service có **DB riêng** `omial_notification_db` (:5438,
      `postgres-notification`) + model `ProcessedEvent` (migration
      `20260817070403_add_processed_event`) + `@@index([processedAt])`. Service CUỐI
      có DB riêng — đúng database-per-service: consumer phải TỰ nhớ, không đọc DB người khác.
- [x] Chốt idempotency ở đầu `handleOtpRequested` + **3 unit test**: lần đầu (ghi +
      gửi mail) · trùng P2002 (bỏ qua êm, KHÔNG gửi mail lần 2, KHÔNG throw) · lỗi DB
      khác P2002 (throw lên).
- [x] Note `docs/patterns/idempotency.md` — XONG (2026-08-19), kèm case thật: RPC command in-doubt ở inventory (504 nhưng vẫn cộng kho).
- [ ] Cron dọn `ProcessedEvent` cũ hơn TTL queue (bảng chỉ phình; index `processedAt` đã sẵn).
- ⚠️ **Thứ tự đã chọn: đánh dấu TRƯỚC, gửi mail SAU.** Đổi "gửi 2 mail" (phiền) lấy
      "mất 1 mail nếu SMTP lỗi sau khi đã đánh dấu" — lần giao lại sẽ bị coi là trùng.
      Với `noAck: true` thì handler lỗi cũng mất event luôn. Cả hai lỗ này là việc của 7.5.

### 7.5. Dead Letter Queue (DLQ)

**Vấn đề**: event xử lý lỗi (vd: SMTP timeout) → RMQ redeliver → lỗi lại →
infinite loop, block queue.

**Giải pháp**:

- Retry tối đa 3 lần.
- Sau 3 lần fail → chuyển vào `dlq_notification`.
- Có endpoint admin `POST /admin/dlq/replay/:eventId` để replay khi fix xong.

Tasks:

- [ ] Config RMQ với dead-letter-exchange.
- [ ] Test: mock SMTP fail → sau 3 lần retry event vào DLQ.
- [ ] Admin route để list + replay DLQ (route này phải có auth admin!).

### 7.6. Saga Pattern — Order flow

**Vấn đề**: tạo order = ghi 3 DB khác nhau (order, inventory, payment). Không
có distributed transaction. Nếu bước 2 fail sau khi bước 1 xong → dữ liệu bẩn.

**Giải pháp Saga**: mỗi bước có **compensating action**.

- Order created → Inventory reserved → Payment charged → Order confirmed.
- Nếu Payment fail → Compensate Inventory (release) → Compensate Order (cancel).

⚠️ **Điều kiện tiên quyết — step + compensation PHẢI idempotent**: mọi bước đi qua
RMQ (at-least-once) → `reserveInventory`/`releaseInventory` có thể được giao 2 lần;
release 2 lần là kho ảo. May là saga có sẵn khoá tự nhiên: **orderId/sagaId** —
reserve cho order X lần 2 = no-op. (Idempotency-Key tổng quát do FE sinh cho
command người dùng là chuyện của 8.2b; xem `docs/patterns/idempotency.md`.)

Chọn **Orchestration** (dễ debug hơn Choreography):

- [ ] Tạo `payment-service` **mock** (charge/refund giả lập, có config tỉ lệ fail để test compensate) — saga cần bước Payment nhưng project chưa có service này; mock là đủ cho học tập, không cần tích hợp cổng thanh toán thật.
- [ ] Tạo `order-saga.service.ts` trong order-service (hoặc service riêng).
- [ ] State machine: `PENDING → INVENTORY_RESERVED → PAYMENT_CHARGED → CONFIRMED`, hoặc `FAILED_*`.
- [ ] Mỗi transition emit event tương ứng.
- [ ] Compensate khi fail: `cancelOrder`, `releaseInventory`, `refundPayment`.
- [ ] Test: mock payment fail → verify inventory được release + order status = CANCELLED.

### 7.7. Audit log qua domain events (ứng dụng đẹp nhất của event-driven)

**Phân biệt trước** (dễ nhầm): **system log** (pino 5.4, observability Phase 4) = log
kỹ thuật cho dev, xoay vòng xoá; **audit log** = nhật ký NGHIỆP VỤ "ai làm gì với cái
gì lúc nào" — người đọc là chủ shop/kế toán, append-only, giữ nhiều năm, nằm trong DB.
Repo đã có 2 audit log chuyên ngành mà không gọi tên: `StockMovement` + `PromotionUsage`
(sổ cái = audit log của domain đó). Mục này làm audit TỔNG QUÁT cho hành động quản trị
(sửa giá, xoá danh mục, đổi trạng thái đơn...).

**Điều kiện tiên quyết**: envelope RMQ phải mang `userId` (có sau Phase 1 — JWT verify
ở gateway). Audit không có cột `actor` = vô dụng.

Cách làm — tái dùng nguyên bộ đồ nghề 7.1→7.5, không học thêm pattern mới:

- [ ] Mỗi service emit domain event khi WRITE: `product.updated { actor, entityId, before, after, eventId }` (outbox 7.3 đảm bảo không mất).
- [ ] Audit consumer (nhét chung notification-service hoặc audit-service riêng) hứng
      mọi `*.created/updated/deleted` → ghi bảng `AuditLog(actor, action, entity, entityId, before, after, createdAt)` — append-only như StockMovement.
- [ ] Idempotent theo `eventId` (7.4) — audit ghi trùng là sai sự thật.
- [ ] Endpoint tra cứu: `GET /audit?entity=product&entityId=...` (phân trang).
- [ ] **KHÔNG audit GET** — chỉ audit theo RỦI RO: mọi write + auth events (login
      fail/success, đổi quyền) + read nhạy cảm nếu có (export dữ liệu). Lượt xem sản phẩm
      là việc của analytics (hệ khác), không phải audit.
- [ ] Chống phình: `before/after` chỉ ghi DIFF (`{price: [cũ, mới]}`), partition bảng
      theo tháng + retention (archive sang cold storage sau 1–2 năm).
- [ ] Note `docs/patterns/audit-log.md`: vì sao audit qua event chứ không phải interceptor per-service (không chặn request chính, không quên khi thêm service mới, tập trung 1 chỗ để đối soát) + tiêu chí audit-theo-rủi-ro ở trên.

### Tiêu chí thành công Phase 2

- Register user → response < 100ms, email vẫn được gửi (chậm hơn vài giây).
- Kill auth-service ngay sau khi user create → restart → email vẫn được gửi (Outbox chạy).
- Publish event 10 lần → user chỉ nhận 1 email (Idempotency).
- SMTP down → event vào DLQ sau 3 lần, có endpoint replay.
- Payment fail giữa saga → hoàn toàn rollback (order cancel, inventory release).
- Sửa giá 1 sản phẩm → `GET /audit?entity=product&entityId=...` thấy dòng ai-sửa-gì-lúc-nào (before/after).
- Đã viết note cho **7 pattern**: pub/sub, event-driven, outbox, idempotency, DLQ, saga-orchestration, choreography-vs-orchestration.

---

## 8. Phase 3 — Resilience & Fault Tolerance

**Mục tiêu**: hệ thống chịu được **lỗi từng phần**. 1 service chết, tổng thể vẫn
sống.

### 8.1. Timeout mọi call

- [ ] Review mọi `client.send()` — bắt buộc có `timeout()` operator.
- [ ] Timeout default 5s, per-endpoint có thể ngắn hơn (login = 2s).
- [ ] Test: mock service treo 10s → gateway response 504 sau 5s.

### 8.2. Retry với exponential backoff

- [ ] Cài `rxjs` `retry({ count, delay })` cho retryable errors.
- [ ] Chỉ retry idempotent operation (GET, PUT with same payload).
- [ ] Backoff: 100ms → 200ms → 400ms → 800ms.
- [ ] Đừng retry cho 4xx (client error).

### 8.2b. Làm cho command GHI trở thành idempotent — vá bug "504 nhưng vẫn cộng kho"

**Vấn đề** (bug thật 2026-08-19, phân tích đầy đủ ở `docs/patterns/idempotency.md`):
gateway 504 KHÔNG nghĩa là lệnh chưa chạy — message vẫn nằm trong durable queue
(in-doubt request), service bật lên là ghi DB. 8.2 chỉ CẤM gateway retry command
không idempotent; nguồn retry thật là NGƯỜI DÙNG bấm lại thì không cấm được →
phải làm chính command trở thành idempotent.

- [ ] **Lớp 1 — TTL cho message RPC**: expiration = timeout gateway (5s) để message
      zombie tự chết trong queue thay vì chờ service bật lại xử lý. (Vá kịch bản
      service chết rồi restart; KHÔNG vá được kịch bản DB lag >5s → cần lớp 2.)
- [ ] **Lớp 2 — `Idempotency-Key` cho command ghi** (inventory receive/issue/adjust
      + tạo order): FE sinh UUID, GIỮ NGUYÊN khi bấm lại (kiểu Stripe); gateway
      forward key qua RMQ; service lưu key với unique constraint — trùng key →
      trả KẾT QUẢ CŨ, không chạy lại. (Gateway tự sinh key mỗi request là vô
      dụng: bấm lại = request mới = key mới.)
- [ ] Test: gửi receive 2 lần cùng key → onHand chỉ +1 lần, 2 response giống hệt;
      key khác → cộng bình thường (2 lô thật sự là 2 lô).

### 8.3. Circuit Breaker

- [ ] Cài `opossum`.
- [ ] Wrap `client.send()` bằng circuit breaker.
- [ ] Config: threshold 50% fail trong 10s → open circuit → half-open sau 30s.
- [ ] Fallback response khi circuit open (vd: return cache, return default).
- [ ] Test: kill product-service → sau vài request fail → circuit open → gateway trả fallback ngay, không đợi timeout.

### 8.4. Bulkhead Pattern

- [ ] Cấu hình RMQ channel/connection **riêng cho từng service** (không share).
- [ ] Node.js: config `maxConcurrent` cho từng client → 1 service chậm không hết thread cho service khác.
- [ ] Test: giả lập product-service treo → gateway vẫn phục vụ auth request bình thường.

### 8.5. Cache-Aside (Redis)

**Vấn đề**: mỗi GET product/brand đều query Postgres — chậm và tốn tài nguyên khi
đọc nhiều; đồng thời circuit breaker (8.3) cần **fallback data** khi service down.

**Giải pháp Cache-Aside**: đọc cache trước → miss thì query DB → ghi vào cache.
Invalidate khi update/delete.

- [ ] Redis cache cho `GET /products/:id` và list brand (TTL 60s).
- [ ] Invalidate key khi update/delete tương ứng.
- [ ] Circuit breaker fallback: khi product-service down → trả data từ cache (stale còn hơn lỗi).
- [ ] Test: đo latency trước/sau cache; update product → cache được invalidate.
- [ ] Note bẫy: cache stampede (nhiều request cùng miss), stale data — ghi vào note đánh đổi.

### 8.6. Graceful Shutdown

- [ ] Handle SIGTERM: close RMQ, drain in-flight requests, close DB, exit.
- [ ] K8s pre-stop hook chờ shutdown xong mới kill.
- [ ] Test: gửi SIGTERM khi service đang xử lý request → request vẫn hoàn thành.

### Tiêu chí thành công Phase 3

- Kill 1 service random → gateway trả lỗi rõ ràng < 5s, không hang.
- 1 service treo (không crash) → circuit breaker open, các service khác vẫn OK.
- Product-service down → GET product vẫn trả data (từ cache, có thể stale).
- Deploy blue-green: SIGTERM instance cũ → không mất request nào.
- Gửi `POST /inventory/receive` 2 lần cùng `Idempotency-Key` → kho chỉ +1 lần, response giống nhau (8.2b).
- Note các pattern: circuit-breaker, retry-backoff, bulkhead, cache-aside, graceful-shutdown.

---

## 9. Phase 4 — Observability

**Mục tiêu**: **debug được** hệ thống khi có bug production. Không có
observability = mù giữa 5 service.

### 9.1. Correlation ID + Distributed Tracing

- [ ] Middleware ở gateway: sinh `traceId` (UUID) mỗi request.
- [ ] Attach `traceId` vào mọi log + RMQ payload.
- [ ] Cài OpenTelemetry SDK cho NestJS.
- [ ] Chạy Jaeger local (docker compose).
- [ ] Setup: mỗi service export span → gateway trace request đi qua từng service.
- [ ] Test: gọi 1 request → Jaeger UI thấy flame graph gateway → auth → product.

### 9.2. Structured Logging + Log Aggregation

- [ ] Đã có `pino` từ Phase 0. Giờ chuẩn hoá field:
  - `service, level, timestamp, traceId, userId, message, context`.
- [ ] Chạy Loki + Grafana (compose).
- [ ] Promtail collect log từ Docker → push Loki.
- [ ] Grafana query: `{service="auth"} |= "traceId=xxx"` → tất cả log của 1 request.

### 9.3. Metrics (RED / USE)

- [ ] Cài `prom-client`.
- [ ] Export 4 loại metric:
  - **Rate**: request/second per endpoint.
  - **Errors**: error rate.
  - **Duration**: latency p50, p95, p99 (histogram).
  - **Business**: orders/minute, active users.
- [ ] Chạy Prometheus + Grafana dashboard.
- [ ] Alerts: p95 > 500ms trong 5 phút → alert.

### 9.4. Health Check API

- [ ] Mỗi service expose `/health/liveness` — service sống không.
- [ ] Mỗi service expose `/health/readiness` — DB + RMQ + Redis đều OK không.
- [ ] Dùng `@nestjs/terminus`.
- [ ] Test: kill Redis → readiness fail → K8s không route traffic tới pod đó.

### 9.5. Error tracking

- [ ] Cài Sentry (self-hosted hoặc SaaS).
- [ ] Global error handler push error kèm `traceId`.
- [ ] Đủ context: user, endpoint, request body (bỏ sensitive).

### Tiêu chí thành công Phase 4

- Debug 1 request lỗi production chỉ mất < 5 phút (grep log theo traceId → thấy stack + trace Jaeger).
- Grafana dashboard trực quan RED metrics cho mọi service.
- Alert Slack/email khi latency/error rate vượt ngưỡng.
- Note các pattern: distributed-tracing, log-aggregation, health-check, structured-logging.

---

## 10. Phase 5 — Deployment & Scale

**Mục tiêu**: đưa lên production thật (cloud), chạy K8s, tự động deploy qua CI.

### 10.1. Dockerize từng service

- [ ] Multi-stage Dockerfile cho từng app (build → runner).
- [ ] Image nhỏ (< 200MB) — dùng `node:alpine` hoặc distroless.
- [ ] Non-root user trong container.
- [ ] `.dockerignore` đúng để không leak `.env`.

### 10.2. docker-compose full stack

- [ ] Gateway + 4 service + Postgres × 4 + RMQ + Redis + Jaeger + Prometheus + Grafana + Loki.
- [ ] `docker compose up` → hệ thống chạy end-to-end.
- [ ] Health check trong compose → dependency đúng thứ tự.

### 10.3. Kubernetes cơ bản

- [ ] Cài `kind` hoặc `minikube` local.
- [ ] Viết manifests: Deployment, Service, ConfigMap, Secret, Ingress.
- [ ] Service Discovery **qua K8s DNS** (auth-service → `auth-service.default.svc.cluster.local`).
- [ ] HPA (Horizontal Pod Autoscaler) — auto scale khi CPU > 70%.
- [ ] Chạy load test (`k6`) → thấy pod tăng.

### 10.4. Externalized Configuration

- [ ] ConfigMap cho non-secret config (URL, feature flag).
- [ ] Secret cho JWT key, DB password.
- [ ] Không hardcode env trong Dockerfile.

### 10.5. CI/CD với GitHub Actions

- [ ] Workflow: lint → test → build image → push registry (GHCR).
- [ ] Deploy tự động khi push `main`.
- [ ] PR check: coverage không giảm.
- [ ] Test contract giữa các service (Pact) — Phase 6 làm chi tiết.

### 10.6. Deploy thật lên cloud

- [ ] Chọn: DigitalOcean K8s ($30/tháng) hoặc Railway/Fly.io (rẻ hơn nữa).
- [ ] Setup domain, HTTPS (cert-manager + Let's Encrypt).
- [ ] Backup DB tự động.
- [ ] Monitoring alert đến email/Slack.

### Tiêu chí thành công Phase 5

- Push code → 5 phút sau đã live trên URL production.
- Traffic tăng → hệ thống auto scale.
- 1 pod chết → K8s tự restart, uptime 99%+.
- Note: dockerize, k8s-deployment, hpa, ci-cd, blue-green-deploy.

---

## 11. Phase 6 — Advanced (Optional)

**Chỉ làm khi có thời gian dư** hoặc muốn đi sâu chuyên môn. Không làm cũng OK
cho hầu hết công việc.

### 11.1. CQRS

- [ ] Tách read model + write model cho product-service.
- [ ] Read model dùng Redis hoặc read replica Postgres.
- [ ] Sync qua event `product.updated` → cập nhật read model.
- [ ] Note: khi nào cần, khi nào là overkill.

### 11.2. Event Sourcing (partial)

- [ ] Thử áp cho Order — table `order_events` là source of truth.
- [ ] State hiện tại = replay events.
- [ ] Snapshot mỗi 100 event để tối ưu.
- [ ] Note: thấy pain, hiểu vì sao ít công ty dùng thuần.

### 11.3. Consumer-Driven Contract Testing (Pact)

- [ ] Gateway = consumer, service = provider.
- [ ] Pact test đảm bảo hợp đồng RMQ payload không bị break.
- [ ] Chạy trong CI.

### 11.4. BFF Pattern

Kế hoạch client thực tế của omial: web + **Zalo miniapp** dùng chung gateway
hiện tại (API trùng ~90%, chỉ thêm flow login Zalo); BFF riêng chỉ cân nhắc khi
có **app POS native** (nhu cầu lệch hẳn: aggregation màn bán hàng, offline-first).

- [ ] Tạo `api-gateway-pos` (hoặc `-mobile`) — thêm 1 app trong `apps/`, tái dùng `libs/*`.
- [ ] Aggregation: 1 endpoint `/pos/home` → gộp product + tồn kho + giá.
- [ ] Viết ADR: khi nào tách BFF, khi nào giữ 1 gateway (client trùng API ≥ 90% → chưa tách).

### 11.5. Service Mesh (Istio hoặc Linkerd)

- [ ] Cài Istio trên K8s.
- [ ] Traffic management: canary deploy 5% → tăng dần.
- [ ] mTLS tự động giữa các service.
- [ ] Overhead lớn — chỉ đáng cho hệ thống 20+ service.

### 11.6. Feature Flag System

- [ ] Cài Unleash hoặc tự viết mini.
- [ ] Toggle feature runtime không cần redeploy.
- [ ] A/B testing framework.

### 11.7. Multi-tenancy (Pool model) — CHỈ khi build SaaS thật

Hướng đã chốt sẵn trong [ADR-001](../docs/adr/001-multi-tenancy-pool-model.md)
(pool model: chung schema + cột `tenantId`, composite unique, index dẫn đầu
tenantId, JWT mang tenantId, envelope RMQ, auto-inject filter). Repo học
**không triển khai** — đọc ADR khi cần là đủ.

---

## 12. Testing Strategy xuyên suốt

Áp dụng **kim tự tháp test** (nhiều unit, ít e2e):

```
        /\
       /E2\        ← 5% (chạy chậm, chỉ smoke test critical flow)
      /----\
     / INT  \      ← 25% (integration — DB thật, service thật)
    /--------\
   /   UNIT   \    ← 70% (mock hết, chạy nhanh)
  /____________\
```

### Unit test (Phase 0 trở đi)

- Mock hết dependency, chạy < 100ms/test.
- Test business logic + branches quan trọng.
- Coverage baseline: **service 70%, controller 40%, util 90%**.

### Integration test (Phase 0)

- Dùng `testcontainers` cho DB + RMQ + Redis thật.
- Test 1 module hoàn chỉnh (controller → service → DB).
- Chạy trong CI, mỗi test cleanup DB.

### E2E test (Phase 5)

- Chạy full stack qua docker-compose.
- Test 3–5 critical flow: register → login → tạo order → thanh toán.
- Chạy nightly, không block PR.

### Contract test (Phase 6)

- Pact giữa gateway ↔ mỗi service.
- Chạy trong CI, đảm bảo không phá vỡ hợp đồng RMQ.

### Load test (Phase 5)

- `k6` chạy hàng tuần: baseline latency + throughput.
- Detect regression sớm.

---

## 13. Documentation Practice

### Cấu trúc thư mục docs

```
docs/
├── microservice-migration-plan.md    (đã có — kế hoạch tổng thể)
├── patterns/                          (tạo mới — mỗi pattern 1 file)
│   ├── api-gateway.md
│   ├── database-per-service.md
│   ├── outbox.md
│   ├── saga-orchestration.md
│   └── ...
├── adr/                               (Architecture Decision Records)
│   ├── 001-choose-rabbitmq-over-kafka.md
│   ├── 002-jwt-verify-at-gateway.md
│   └── ...
└── runbooks/                          (Phase 4+ — vận hành)
    ├── how-to-replay-dlq.md
    └── how-to-recover-outbox.md
```

### ADR Format (mỗi quyết định lớn viết 1 file)

```markdown
# ADR-XXX: <Tiêu đề quyết định>

Date: YYYY-MM-DD
Status: proposed | accepted | deprecated | superseded

## Context

<Vấn đề, ràng buộc>

## Decision

<Chọn gì>

## Alternatives

<Đã cân nhắc gì khác, vì sao không chọn>

## Consequences

<Cost, đánh đổi>
```

### Spec code (`.claude/specs/`)

Sau mỗi phase, cập nhật spec tương ứng để session Claude sau nắm nhanh — dùng
skill `/update-spec`.

---

## 14. Bảng tra pattern nhanh

### Communication

| Pattern                   | Phase   | Trong project dùng ở đâu       |
| ------------------------- | ------- | ------------------------------ |
| API Gateway               | 1       | apps/api-gateway               |
| Sync (send/receive)       | 0       | Đã có                          |
| Async (emit/EventPattern) | 2       | user.registered, order.created |
| Saga (Orchestration)      | 2       | Order flow                     |
| Choreography              | 2 (đọc) | Chưa dùng — hiểu để so sánh    |

### Data

| Pattern                 | Phase                                     | Trong project                                           |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Database per Service    | 0                                         | ✅ Đã có                                                |
| Soft delete + retention | 0 (5.5)                                   | brand/label/category/product (`isDeleted`, `deletedAt`) |
| Anonymization (PII)     | 0 (đọc), làm khi có yêu cầu xoá tài khoản | User trong auth-service                                 |
| Outbox                  | 2                                         | auth-service outbox_event                               |
| Idempotency             | 2                                         | notification-service processed_event                    |
| CQRS                    | 6                                         | Product read model (optional)                           |
| Event Sourcing          | 6                                         | Order event stream (optional)                           |
| API Composition         | 5                                         | Aggregation endpoint                                    |

### Resilience

| Pattern           | Phase |
| ----------------- | ----- |
| Timeout           | 3     |
| Retry + Backoff   | 3     |
| Circuit Breaker   | 3     |
| Bulkhead          | 3     |
| Cache-Aside       | 3     |
| Graceful Shutdown | 3     |
| Dead Letter Queue | 2     |

### Observability

| Pattern             | Phase                      |
| ------------------- | -------------------------- |
| Correlation ID      | 4                          |
| Distributed Tracing | 4                          |
| Structured Logging  | 0 (setup), 4 (aggregation) |
| Metrics (RED)       | 4                          |
| Health Check        | 4                          |
| Error Tracking      | 4                          |

### Deployment

| Pattern                     | Phase                |
| --------------------------- | -------------------- |
| Dockerize                   | 5                    |
| K8s Deployment              | 5                    |
| Service Discovery (K8s DNS) | 5                    |
| CI/CD                       | 5                    |
| Blue-Green Deploy           | 5                    |
| Canary Release              | 6                    |
| Feature Flag                | 6                    |
| Sidecar                     | 6 (via Service Mesh) |

### Security

| Pattern                 | Phase                            |
| ----------------------- | -------------------------------- |
| JWT Auth ở Gateway      | 1                                |
| Service-to-Service Auth | 1                                |
| Rate Limiting           | 1                                |
| Secret Management       | 1 (dev), 5 (prod với K8s Secret) |
| CORS + Helmet           | 1                                |
| mTLS                    | 6 (Service Mesh)                 |

### Đối chiếu với Azure Cloud Design Patterns catalog

Azure catalog (<https://learn.microsoft.com/en-us/azure/architecture/patterns/>)
là **từ điển** ~43 pattern cho mọi loại cloud workload — dùng để **tra**, không
phải học tuần tự. Đối chiếu để không hoang mang "sao nhiều tên lạ":

**Cùng pattern, Azure gọi tên khác:**

| Azure gọi là                               | Trong roadmap này                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Publisher-Subscriber                       | Phase 2 — emit/EventPattern                                                                                                   |
| Compensating Transaction                   | Phase 2 — compensating action trong Saga                                                                                      |
| Gateway Routing / Aggregation / Offloading | API Gateway tách 3: routing (đã có), offloading (JWT + rate limit ở gateway, Phase 1), aggregation (API Composition, Phase 5) |
| Gatekeeper                                 | Vai trò validate/sanitize của gateway (Phase 1)                                                                               |
| Health Endpoint Monitoring                 | Health check (Phase 4)                                                                                                        |
| External Configuration Store               | Externalized config (Phase 5)                                                                                                 |
| Queue-Based Load Leveling                  | Lợi ích có sẵn của emit qua RMQ — queue làm buffer khi tải đột biến                                                           |
| Competing Consumers                        | 2+ replicas cùng nghe 1 queue (RMQ mặc định) — gặp ở Phase 5 khi scale                                                        |
| Strangler Fig                              | Chính là cách đang migrate REST → RMQ từng module                                                                             |
| Index Table                                | Prisma `@@index` — đã dùng                                                                                                    |
| Materialized View                          | Alternative nhẹ cho CQRS                                                                                                      |
| Throttling                                 | Cặp với Rate Limiting (Phase 1)                                                                                               |

**Azure có mà roadmap chưa nhắc — đáng biết, tra khi cần:**

| Pattern                    | Khi nào cần trong project                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Claim Check                | Payload RMQ lớn (file, ảnh) → lưu storage, gửi reference qua queue                                                              |
| Valet Key                  | Upload ảnh product → presigned URL S3/R2, không đi qua backend                                                                  |
| Federated Identity         | Thêm login Zalo (cho client miniapp — `auth.zalo_login`: verify Zalo token → phát JWT của mình) / Google OAuth vào auth-service |
| Anti-Corruption Layer      | Tích hợp payment gateway thật / hệ thống legacy — lớp adapter cách ly                                                           |
| Leader Election            | Outbox worker chạy nhiều replicas (đã note ở 7.3)                                                                               |
| Asynchronous Request-Reply | HTTP 202 + polling status endpoint — khi client cần theo dõi tác vụ chạy lâu                                                    |

**Azure có nhưng CHƯA cần cho quy mô này** (đọc hiểu là đủ): Geode, Deployment
Stamps, Sharding, Priority Queue, Sequential Convoy, Scheduler Agent Supervisor,
Messaging Bridge, Pipes and Filters, Compute Resource Consolidation, Quarantine,
Static Content Hosting, Ambassador.

---

## 15. Anti-patterns cần tránh

### ❌ "Shared Database" ngầm

Hai service query cùng DB → chỉ còn tên là microservice. Không bao giờ share
schema. Nếu cần data → gọi qua API/event.

### ❌ "Distributed Monolith"

Nhiều service nhưng **coupling thời gian**: A phải chờ B chờ C xong. Không khác gì
monolith, chỉ thêm network overhead. Dấu hiệu: mọi call là sync.

### ❌ "Chatty Communication"

1 request client → 20 gọi qua lại giữa service. Cần **API Composition** hoặc
**batch query** hoặc rethink boundary.

### ❌ Retry mù quáng

Retry POST tạo order → tạo 3 order trùng. Chỉ retry **idempotent** operation.

### ❌ Circuit Breaker không có fallback

Circuit open nhưng không có gì để trả → user thấy lỗi giống hệt. Phải có
fallback ý nghĩa (cache, default, degrade gracefully).

### ❌ Trace mà không log correlationId

Có Jaeger nhưng log không có traceId → không link được → vô ích.

### ❌ Alert mọi thứ

10 alert/ngày → team ignore hết → miss alert quan trọng. Alert phải actionable.

### ❌ "Đủ pattern là microservice tốt"

Không. Microservice tốt là **giải quyết đúng vấn đề business**. Nếu bạn học xong
6 phase mà không hiểu vì sao mỗi pattern tồn tại → mới học được cú pháp, chưa
học được tư duy.

---

## 16. Tài liệu tham khảo

### Sách (đọc theo thứ tự)

1. **Building Microservices** (Sam Newman) — foundation, đọc trước tất cả.
2. **Microservices Patterns** (Chris Richardson) — chi tiết mọi pattern, dùng như từ điển.
3. **Designing Data-Intensive Applications** (Martin Kleppmann) — nền tảng phân tán, đọc chương 5, 7, 8, 9.
4. **Release It!** (Michael Nygard) — resilience patterns thực chiến.

### Docs online (ngắn hơn, dùng khi cần)

- Microsoft Cloud Design Patterns: <https://learn.microsoft.com/en-us/azure/architecture/patterns/>
- AWS Well-Architected Framework: <https://aws.amazon.com/architecture/well-architected/>
- microservices.io (Chris Richardson): <https://microservices.io/patterns/>

### Video

- "Microservices" (Martin Fowler): <https://www.youtube.com/watch?v=wgdBVIX9ifA>
- QCon Talks — search "distributed systems".

### Tools tham khảo

| Chủ đề                  | Tool                                   |
| ----------------------- | -------------------------------------- |
| Broker                  | RabbitMQ (đang dùng), Kafka (đọc thêm) |
| Tracing                 | OpenTelemetry + Jaeger                 |
| Logging                 | Loki + Grafana, ELK stack              |
| Metrics                 | Prometheus + Grafana                   |
| Circuit Breaker         | opossum (Node.js)                      |
| Contract Test           | Pact                                   |
| Feature Flag            | Unleash, LaunchDarkly                  |
| Service Mesh            | Istio, Linkerd                         |
| Container Orchestration | Kubernetes                             |

---

## Checklist tổng — theo dõi tiến độ

Copy checklist này ra 1 file riêng (`docs/progress.md`) và tick dần:

### Phase 0

- [x] Migrate product-service hết modules
- [x] Migrate order-service
- [x] Migrate inventory-service
- [x] Chiến lược xoá per-entity (5.5) + note soft-delete.md
- [x] Coverage ≥ 60% mọi service (`coverageThreshold` 65/50/65 chặn tụt)
- [x] Integration test đầu tiên với testcontainers (inventory)
- [x] Structured logging với pino

### Phase 1

- [x] JwtAuthGuard global ở gateway
- [x] @Public() decorator
- [x] Service-to-service auth (shared secret `x-internal-token`)
- [x] Rate limiting với throttler
- [x] Helmet + CORS whitelist
- [ ] Docker secrets cho compose (6.5 — phần duy nhất Phase 1 còn nợ)

### Phase 2

- [x] notification-service với emit event (7.1 + 7.2)
- [x] Outbox table + worker (7.3)
- [x] Idempotency với eventId (7.4) + note `docs/patterns/idempotency.md`
- [ ] DLQ config + replay endpoint (7.5) ← **đang tới đây**
- [ ] Saga Order flow với compensating action (7.6)
- [ ] Audit log qua domain events (7.7)

### Phase 3

- [ ] Timeout mọi RMQ call
- [ ] Retry với exponential backoff
- [ ] Command ghi idempotent: TTL message RPC + Idempotency-Key (8.2b — vá bug 504-vẫn-cộng-kho)
- [ ] Circuit Breaker với opossum
- [ ] Bulkhead — connection pool riêng
- [ ] Cache-Aside với Redis (kèm invalidation)
- [ ] Graceful shutdown

### Phase 4

- [ ] Correlation ID xuyên request
- [ ] OpenTelemetry + Jaeger
- [ ] Loki + Grafana log
- [ ] Prometheus RED metrics
- [ ] Health check liveness + readiness
- [ ] Sentry error tracking

### Phase 5

- [ ] Dockerfile multi-stage mỗi service
- [ ] docker-compose full stack
- [ ] K8s manifests + HPA
- [ ] CI/CD với GitHub Actions
- [ ] Deploy production trên cloud

### Phase 6 (optional)

- [ ] CQRS thử với product
- [ ] Event Sourcing thử với order
- [ ] Pact contract test
- [ ] BFF cho mobile
- [ ] Istio service mesh
- [ ] Feature flag

---

**Cuối cùng**: file này **không phải để đọc 1 lần rồi quên**. Đọc lại đầu mỗi
phase. Cập nhật khi phát hiện sai sót. Đây là "sổ tay học tập" của bạn trong
6 tháng tới.

Nếu học nghiêm túc từng phase, sau roadmap này bạn **hiểu microservice sâu hơn
80% dev trung bình Việt Nam** — không phải vì biết nhiều tên pattern, mà vì
**hiểu vì sao mỗi pattern tồn tại và khi nào không cần dùng**.

Chúc học tốt.
