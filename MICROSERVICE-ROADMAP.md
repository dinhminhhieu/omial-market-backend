# MICROSERVICE-ROADMAP.md — Lộ trình học microservice qua project omial

> File này là **bản đồ học tập cá nhân** cho việc nâng project omial-market-backend
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
|---|---|
| 5h/tuần | 6–8 tháng |
| 10h/tuần | 3–5 tháng |
| Full-time | 6–8 tuần |

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

| Thành phần | Trạng thái |
|---|---|
| api-gateway | HTTP entry duy nhất, forward RMQ tới auth + product |
| auth-service | Pure microservice, đủ luồng auth (login/register+OTP/refresh/reset) |
| product-service | Đang migrate — mới xong module `brand` (CRUD + soft delete + pagination) |
| order-service | REST scaffold, **chưa** migrate |
| inventory-service | REST scaffold, **chưa** migrate |
| DB per service | ✅ Auth + Product có Postgres riêng |
| RMQ | ✅ Có, nhưng **chỉ dùng request-response (send/receive)** |
| JWT verify tập trung | ❌ Chưa có Guard ở gateway |
| Event-driven thực sự | ❌ 0 `emit()` / `EventPattern` |
| Rate limiting | ❌ Chưa |
| Circuit breaker | ❌ Chưa |
| Distributed tracing | ❌ Chưa |
| Health check | ❌ Chưa |
| Unit test | 🟡 Mới có 10 test cho brand.service |
| Integration test | ❌ Chưa |
| E2E test | ❌ Chưa |
| Dockerfile per service | ❌ Chưa |
| CI/CD | ❌ Chưa |

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

| Phase | Chủ đề | Thời gian | Pattern chính |
|---|---|---|---|
| **0** | Hoàn thiện nền tảng | 2–3 tuần | Migration completeness, unit test coverage |
| **1** | Security & Gateway hoàn chỉnh | 2 tuần | API Gateway đầy đủ, JWT verify, Rate limit, Service-to-service auth |
| **2** | Event-Driven thật sự | 3–4 tuần | Publish/subscribe, Outbox, Idempotency, DLQ, Saga |
| **3** | Resilience | 3 tuần | Circuit Breaker, Retry, Timeout, Bulkhead |
| **4** | Observability | 3 tuần | Distributed Tracing, Log Aggregation, Metrics, Health Check |
| **5** | Deployment & Scale | 3–4 tuần | Docker, K8s, Service Discovery via K8s, CI/CD |
| **6** | Advanced (optional) | Khi cần | CQRS, Event Sourcing, BFF, Service Mesh |

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

### 5.2. Unit test có ý nghĩa

- [ ] Coverage tối thiểu **60%** cho mọi service (không đuổi 100% mù quáng).
- [ ] Ưu tiên test **business logic** — bỏ test tautology.
- [ ] Setup `tsconfig.spec.json` + `jest.mock` cho Prisma (đã có mẫu ở [apps/product-service/src/brand/brand.service.spec.ts](apps/product-service/src/brand/brand.service.spec.ts)).
- [ ] Chạy `pnpm test:cov` xanh trước mỗi commit.

### 5.3. Integration test đầu tiên

- [ ] Cài `testcontainers` — chạy Postgres thật trong test.
- [ ] Viết 1 spec integration cho auth-service login flow (DB thật, Redis mock).
- [ ] Setup jest project riêng cho integration (`jest-integration.config.ts`).

### 5.4. Structured logging cơ bản

- [ ] Thay `Logger` mặc định bằng `pino` (JSON output).
- [ ] Mỗi log có: `service`, `timestamp`, `level`, `message`, `context`.
- [ ] Chuẩn bị field `correlationId` (sẽ dùng ở Phase 4).

### 5.5. Chiến lược xoá dữ liệu (data lifecycle)

Quyết định **per-entity**, không phải chính sách toàn hệ thống. Câu hỏi định
hướng: *dữ liệu lịch sử có tham chiếu tới nó không, luật có bắt giữ/bắt xoá không?*

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

### 6.1. JWT verify tập trung ở Gateway

- [ ] Tạo `JwtAuthGuard` global ở gateway (dùng `@nestjs/passport` + `passport-jwt`).
- [ ] Tạo decorator `@Public()` để đánh dấu route không cần auth (login, register, docs).
- [ ] Extract `userId, role` từ token → attach vào request → forward xuống service qua payload.
- [ ] Auth-service **chỉ ký token**, không verify token cho các service khác nữa.
- [ ] **RBAC cơ bản**: thêm field `role` vào User (USER/ADMIN), dùng `RolesGuard` + `@Roles('ADMIN')` có sẵn trong `libs/shared` — Phase 2 cần cho admin endpoint DLQ replay.
- [ ] Test: gọi `/products` không có token → 401 tại gateway (không đụng product-service).

### 6.2. Service-to-service authentication

**Vấn đề**: nếu ai đó gửi trực tiếp message RMQ (bypass gateway) → làm gì cũng được. Phải chứng thực service ↔ service.

- [ ] Chọn 1 trong 3 cách:
  - **Shared secret**: gateway gắn header `X-Internal-Token` vào payload, service verify. Đơn giản nhất.
  - **Internal JWT**: gateway ký JWT nội bộ với claim khác token user, service verify. Cẩn thận hơn.
  - **mTLS**: cấu hình RabbitMQ + client cert. Chuẩn nhất, phức tạp.
- [ ] Khuyến nghị: Shared secret cho học tập, note lại cost của mTLS.

### 6.3. Rate limiting

- [ ] Cài `@nestjs/throttler`.
- [ ] Global limit: 100 req/phút/IP.
- [ ] Endpoint đặc biệt: login = 5 req/phút, register = 3 req/phút.
- [ ] Test: dùng `ab` hoặc `k6` bắn 200 req/s → gateway trả 429 sau khi vượt limit.

### 6.4. Input validation nghiêm

- [ ] Tất cả DTO có validator (đã làm cho brand — apply hết).
- [ ] Response validation: dùng `ClassSerializerInterceptor` để chống leak field.
- [ ] Test SQL injection: gửi `'; DROP TABLE brands; --` → phải reject.

### 6.5. Secret management

- [ ] Tách secrets ra khỏi `.env` commit vào repo.
- [ ] Dùng `.env.example` làm template, `.env` gitignore.
- [ ] Học `docker secrets` cho compose.
- [ ] Note: production dùng Vault / AWS Secrets Manager / K8s Secret.

### 6.6. CORS + Helmet

- [ ] Cài `helmet` cho security headers.
- [ ] Configure CORS whitelist (không dùng `*` khi có auth).

### Tiêu chí thành công Phase 1

- Không thể gọi API nào (trừ `@Public`) mà không có JWT hợp lệ.
- Không thể gửi trực tiếp RMQ message tới service mà không có internal auth.
- Login bruteforce → chặn sau 5 lần fail.
- File `docs/patterns/api-gateway.md`, `docs/patterns/service-to-service-auth.md` viết xong.

---

## 7. Phase 2 — Event-Driven thật sự

**Mục tiêu**: đảo tư duy từ RPC sync (`send`) sang event async (`emit`). **Đây là
pattern quan trọng nhất cả roadmap** — nếu chỉ có thời gian học 1 phase, học phase này.

### 7.1. So sánh `send` vs `emit` — hiểu bằng code

- [ ] Viết 1 spec chứng minh:
  - `client.send()` → chờ response, timeout được (đã có).
  - `client.emit()` → return ngay, không chờ ai xử lý.
- [ ] Note vào `docs/patterns/pub-sub-vs-rpc.md`.

### 7.2. Use case 1: `user.registered` event

**Refactor luồng register hiện tại**:

- Hiện: `auth-service.register()` gọi thẳng nodemailer gửi OTP → chậm, coupling.
- Mới: `auth-service.register()` chỉ lưu OTP + `emit('user.registered', { email, otp })` → return ngay 200.
  Notification-service subscribe event → gửi email.

Tasks:

- [ ] Tạo `notification-service` mới — **kèm Postgres riêng** (`postgres-notification`), cần cho table `processed_event` ở mục 7.4 (đúng nguyên tắc Database per Service).
- [ ] Move logic nodemailer từ auth-service sang notification-service.
- [ ] Auth-service publish event thay vì gửi trực tiếp.
- [ ] Test: register không đợi email gửi xong (< 100ms response).

### 7.3. Outbox Pattern — bắt buộc cho production event-driven

**Vấn đề**: 
```ts
await prisma.user.create({ data });     // 1. DB write
await client.emit('user.registered');    // 2. Publish event
```
Nếu crash giữa (1) và (2) → user tạo rồi nhưng không gửi email. Ngược lại
publish rồi rollback DB → email gửi sai sự thật.

**Giải pháp Outbox**:
- Trong cùng transaction: `user.create()` + `outbox_event.create({ payload, status: 'pending' })`.
- Background worker đọc `outbox_event` → publish RMQ → mark `status: 'sent'`.
- Nếu crash: worker restart, tiếp tục xử lý event chưa sent.

Tasks:

- [ ] Tạo table `outbox_event` cho auth-service.
- [ ] Refactor register để atomic write user + event vào outbox.
- [ ] Tạo worker (cron 1s) publish event chưa sent.
- [ ] Test: kill process ngay sau `create user` → restart → event vẫn được publish.
- [ ] Note: Debezium là alternative (CDC log Postgres).
- [ ] Bài tập phụ (tái dùng kỹ năng cron vừa học): job `purgeTrash` xoá cứng các
  dòng soft-deleted quá 30 ngày (xem 5.5) — nhớ xử lý FK (con trước cha) và bẫy
  multi-replica (cron chạy N lần khi scale).
- [ ] **Cảnh báo khi scale**: chạy 2+ replicas → 2 worker cùng đọc outbox → publish
  trùng. Giải pháp: `SELECT ... FOR UPDATE SKIP LOCKED` (đơn giản, khuyến nghị)
  hoặc pattern **Leader Election** (chỉ 1 instance làm worker). Idempotency ở
  consumer (7.4) là lưới an toàn cuối.

### 7.4. Idempotency — consumer phải chịu được duplicate

**Vấn đề**: RMQ có at-least-once delivery. Consumer nhận cùng event 2 lần → gửi
email 2 lần → user pissed off.

**Giải pháp**:
- Mỗi event có `eventId` (UUID).
- Consumer lưu `processed_event(eventId)` sau khi xử lý.
- Trước khi xử lý, check `eventId` đã có chưa → skip nếu có.

Tasks:

- [ ] Thêm `eventId` vào mọi event payload.
- [ ] Notification-service có table `processed_event`.
- [ ] Test: publish cùng event 5 lần → chỉ gửi 1 email.

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

Chọn **Orchestration** (dễ debug hơn Choreography):

- [ ] Tạo `payment-service` **mock** (charge/refund giả lập, có config tỉ lệ fail để test compensate) — saga cần bước Payment nhưng project chưa có service này; mock là đủ cho học tập, không cần tích hợp cổng thanh toán thật.
- [ ] Tạo `order-saga.service.ts` trong order-service (hoặc service riêng).
- [ ] State machine: `PENDING → INVENTORY_RESERVED → PAYMENT_CHARGED → CONFIRMED`, hoặc `FAILED_*`.
- [ ] Mỗi transition emit event tương ứng.
- [ ] Compensate khi fail: `cancelOrder`, `releaseInventory`, `refundPayment`.
- [ ] Test: mock payment fail → verify inventory được release + order status = CANCELLED.

### Tiêu chí thành công Phase 2

- Register user → response < 100ms, email vẫn được gửi (chậm hơn vài giây).
- Kill auth-service ngay sau khi user create → restart → email vẫn được gửi (Outbox chạy).
- Publish event 10 lần → user chỉ nhận 1 email (Idempotency).
- SMTP down → event vào DLQ sau 3 lần, có endpoint replay.
- Payment fail giữa saga → hoàn toàn rollback (order cancel, inventory release).
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

| Pattern | Phase | Trong project dùng ở đâu |
|---|---|---|
| API Gateway | 1 | apps/api-gateway |
| Sync (send/receive) | 0 | Đã có |
| Async (emit/EventPattern) | 2 | user.registered, order.created |
| Saga (Orchestration) | 2 | Order flow |
| Choreography | 2 (đọc) | Chưa dùng — hiểu để so sánh |

### Data

| Pattern | Phase | Trong project |
|---|---|---|
| Database per Service | 0 | ✅ Đã có |
| Soft delete + retention | 0 (5.5) | brand/label/category/product (`isDeleted`, `deletedAt`) |
| Anonymization (PII) | 0 (đọc), làm khi có yêu cầu xoá tài khoản | User trong auth-service |
| Outbox | 2 | auth-service outbox_event |
| Idempotency | 2 | notification-service processed_event |
| CQRS | 6 | Product read model (optional) |
| Event Sourcing | 6 | Order event stream (optional) |
| API Composition | 5 | Aggregation endpoint |

### Resilience

| Pattern | Phase |
|---|---|
| Timeout | 3 |
| Retry + Backoff | 3 |
| Circuit Breaker | 3 |
| Bulkhead | 3 |
| Cache-Aside | 3 |
| Graceful Shutdown | 3 |
| Dead Letter Queue | 2 |

### Observability

| Pattern | Phase |
|---|---|
| Correlation ID | 4 |
| Distributed Tracing | 4 |
| Structured Logging | 0 (setup), 4 (aggregation) |
| Metrics (RED) | 4 |
| Health Check | 4 |
| Error Tracking | 4 |

### Deployment

| Pattern | Phase |
|---|---|
| Dockerize | 5 |
| K8s Deployment | 5 |
| Service Discovery (K8s DNS) | 5 |
| CI/CD | 5 |
| Blue-Green Deploy | 5 |
| Canary Release | 6 |
| Feature Flag | 6 |
| Sidecar | 6 (via Service Mesh) |

### Security

| Pattern | Phase |
|---|---|
| JWT Auth ở Gateway | 1 |
| Service-to-Service Auth | 1 |
| Rate Limiting | 1 |
| Secret Management | 1 (dev), 5 (prod với K8s Secret) |
| CORS + Helmet | 1 |
| mTLS | 6 (Service Mesh) |

### Đối chiếu với Azure Cloud Design Patterns catalog

Azure catalog (<https://learn.microsoft.com/en-us/azure/architecture/patterns/>)
là **từ điển** ~43 pattern cho mọi loại cloud workload — dùng để **tra**, không
phải học tuần tự. Đối chiếu để không hoang mang "sao nhiều tên lạ":

**Cùng pattern, Azure gọi tên khác:**

| Azure gọi là | Trong roadmap này |
|---|---|
| Publisher-Subscriber | Phase 2 — emit/EventPattern |
| Compensating Transaction | Phase 2 — compensating action trong Saga |
| Gateway Routing / Aggregation / Offloading | API Gateway tách 3: routing (đã có), offloading (JWT + rate limit ở gateway, Phase 1), aggregation (API Composition, Phase 5) |
| Gatekeeper | Vai trò validate/sanitize của gateway (Phase 1) |
| Health Endpoint Monitoring | Health check (Phase 4) |
| External Configuration Store | Externalized config (Phase 5) |
| Queue-Based Load Leveling | Lợi ích có sẵn của emit qua RMQ — queue làm buffer khi tải đột biến |
| Competing Consumers | 2+ replicas cùng nghe 1 queue (RMQ mặc định) — gặp ở Phase 5 khi scale |
| Strangler Fig | Chính là cách đang migrate REST → RMQ từng module |
| Index Table | Prisma `@@index` — đã dùng |
| Materialized View | Alternative nhẹ cho CQRS |
| Throttling | Cặp với Rate Limiting (Phase 1) |

**Azure có mà roadmap chưa nhắc — đáng biết, tra khi cần:**

| Pattern | Khi nào cần trong project |
|---|---|
| Claim Check | Payload RMQ lớn (file, ảnh) → lưu storage, gửi reference qua queue |
| Valet Key | Upload ảnh product → presigned URL S3/R2, không đi qua backend |
| Federated Identity | Thêm login Zalo (cho client miniapp — `auth.zalo_login`: verify Zalo token → phát JWT của mình) / Google OAuth vào auth-service |
| Anti-Corruption Layer | Tích hợp payment gateway thật / hệ thống legacy — lớp adapter cách ly |
| Leader Election | Outbox worker chạy nhiều replicas (đã note ở 7.3) |
| Asynchronous Request-Reply | HTTP 202 + polling status endpoint — khi client cần theo dõi tác vụ chạy lâu |

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

| Chủ đề | Tool |
|---|---|
| Broker | RabbitMQ (đang dùng), Kafka (đọc thêm) |
| Tracing | OpenTelemetry + Jaeger |
| Logging | Loki + Grafana, ELK stack |
| Metrics | Prometheus + Grafana |
| Circuit Breaker | opossum (Node.js) |
| Contract Test | Pact |
| Feature Flag | Unleash, LaunchDarkly |
| Service Mesh | Istio, Linkerd |
| Container Orchestration | Kubernetes |

---

## Checklist tổng — theo dõi tiến độ

Copy checklist này ra 1 file riêng (`docs/progress.md`) và tick dần:

### Phase 0
- [ ] Migrate product-service hết modules
- [ ] Migrate order-service
- [ ] Migrate inventory-service
- [ ] Chiến lược xoá per-entity (5.5) + note soft-delete.md
- [ ] Coverage ≥ 60% mọi service
- [ ] Integration test đầu tiên với testcontainers
- [ ] Structured logging với pino

### Phase 1
- [ ] JwtAuthGuard global ở gateway
- [ ] @Public() decorator
- [ ] Service-to-service auth (shared secret)
- [ ] Rate limiting với throttler
- [ ] Helmet + CORS whitelist

### Phase 2
- [ ] notification-service với emit event
- [ ] Outbox table + worker
- [ ] Idempotency với eventId
- [ ] DLQ config + replay endpoint
- [ ] Saga Order flow với compensating action

### Phase 3
- [ ] Timeout mọi RMQ call
- [ ] Retry với exponential backoff
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
