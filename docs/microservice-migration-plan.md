# Plan: Chuyển REST → Microservice (RabbitMQ)

> **Trạng thái**: bản kế hoạch cấu hình. Code do dev tự implement theo checklist ở [mục 9](#9-checklist-triển-khai).
> **Ngày**: 2026-07-14
> **Repo**: `omial-market-backend` (NestJS monorepo)

---

## 0. Hiện trạng

- 5 app: `api-gateway`, `auth-service`, `product-service`, `order-service`, `inventory-service` — **tất cả đang là REST/HTTP độc lập** (`NestFactory.create`).
- Đã có bộ common (`libs/shared`): `ResponseInterceptor` (envelope), `AllExceptionsFilter`, `ValidationPipe`, `RolesGuard`/Bearer, Swagger `setupApp()`.
- `libs/event-contracts`: đang trống — **đúng chỗ để chứa message contracts**.
- Docker: RabbitMQ (`5672` AMQP, `15672` UI), Redis, `postgres-auth` đã bật; các postgres khác đang comment.
- **Chưa có**: `@nestjs/microservices`, `amqplib`, `amqp-connection-manager`, `@nestjs/config`; chưa có env RabbitMQ.

---

## 1. Mô hình đích

```
                 HTTP/REST (public, Swagger /docs)
   Client ───────────────► [ api-gateway ]   ← chỉ đây là REST
                                 │ ClientProxy (RMQ)
              ┌──────────────────┼──────────────────┬──────────────────┐
        client.send()      client.send()      client.emit()      client.send()
              ▼                  ▼                  ▼                  ▼
       [ auth-service ]  [ product-service ] [ order-service ] [ inventory-service ]
        @MessagePattern   @MessagePattern    @EventPattern      @MessagePattern
        (RMQ consumer)    (RMQ consumer)     (RMQ consumer)     (RMQ consumer)
              │ Prisma           │ Prisma            │                  │
          postgres-auth      postgres-*         postgres-*         postgres-*
```

- **api-gateway**: giữ HTTP + Swagger, đóng vai _facade_. Không chứa business logic — chỉ nhận REST rồi forward qua RMQ.
- **4 service nội bộ**: chuyển thành **pure RMQ microservice** (không còn HTTP), giao tiếp bằng message.

---

## 2. Quyết định cần chốt (kèm mặc định đề xuất)

| Vấn đề                   | Mặc định đề xuất                                                                                        | Lựa chọn khác                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Internal service kiểu gì | **Pure microservice** (`createMicroservice`, bỏ HTTP)                                                   | **Hybrid** (HTTP + RMQ) nếu muốn giữ Swagger riêng từng service |
| Cách giao tiếp           | **RPC `send()`** cho query/command cần kết quả; **`emit()`** cho event bất đồng bộ (vd order→inventory) | Chỉ RPC cho đơn giản                                            |
| Queue                    | **1 queue / service** (`auth_queue`, `product_queue`…)                                                  | Exchange/topic nâng cao                                         |
| Credentials RMQ          | `guest:guest@localhost:5672` (mặc định image, chỉ chạy từ host)                                         | Tạo user riêng qua env trong docker-compose                     |
| Auth                     | Verify JWT **ở gateway**; service nội bộ tin tưởng gateway                                              | Mỗi service tự verify (phức tạp hơn)                            |

---

## 3. Dependencies cần cài

```bash
pnpm add @nestjs/microservices amqplib amqp-connection-manager
pnpm add @nestjs/config          # khuyến nghị: quản lý env tập trung
pnpm add -D @types/amqplib
```

> Nest transport `Transport.RMQ` **bắt buộc** cả `amqplib` + `amqp-connection-manager`.

---

## 4. Env / config

Thêm vào `.env` (root):

```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RMQ_AUTH_QUEUE=auth_queue
RMQ_PRODUCT_QUEUE=product_queue
RMQ_ORDER_QUEUE=order_queue
RMQ_INVENTORY_QUEUE=inventory_queue
```

- Load bằng `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`) hoặc `dotenv` (đã có).
- docker-compose: RabbitMQ đã sẵn, **không cần sửa**. Nếu muốn user riêng → thêm `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` vào service `rabbitmq`.

---

## 5. Shared code (2 lib)

### `libs/shared` — factory cấu hình RMQ dùng chung

Mục tiêu: gateway & service khỏi lặp lại option.

- `rmqClientOptions(queue: string): RmqOptions` — cho `ClientsModule` ở gateway.
- `rmqServerOptions(queue: string): RmqOptions` — cho `createMicroservice` ở service.
- `setupMicroservice(app)` — bản microservice của `setupApp()`: gắn `useGlobalPipes(createValidationPipe())` + filter RPC.

Cùng dùng: `urls: [RABBITMQ_URL]`, `queueOptions: { durable: true }`, `noAck: false`, `prefetchCount: 1`.

### `libs/event-contracts` — hợp đồng message (gateway ↔ service phải khớp)

```
libs/event-contracts/src/
  patterns/
    auth.patterns.ts        # AUTH_PATTERNS = { VALIDATE_USER: 'auth.validate_user', ... }
    product.patterns.ts
    order.events.ts         # ORDER_EVENTS = { CREATED: 'order.created', ... }
  dto/
    auth/validate-user.dto.ts   # payload + response DTO (dùng class-validator)
    ...
  index.ts                  # export qua @app/event-contracts
```

---

## 6. Bootstrap thay đổi

### Internal service `main.ts` (vd auth)

Đổi từ `NestFactory.create` → `createMicroservice`:

```ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AuthServiceModule,
  rmqServerOptions(process.env.RMQ_AUTH_QUEUE!),
);
setupMicroservice(app); // useGlobalPipes + RPC filter
await app.listen();
```

> ⚠️ `setupApp()` hiện tại là **HTTP-only** → không dùng cho pure microservice. Tách phần chung (pipe/filter) sang `setupMicroservice(app)`.

### Controller service

Đổi `@Get()` / `@Post()` → `@MessagePattern(AUTH_PATTERNS.VALIDATE_USER)` hoặc `@EventPattern(...)`.

### api-gateway (giữ HTTP + `setupApp()`)

```ts
// ApiGatewayModule
ClientsModule.registerAsync([
  { name: 'AUTH_CLIENT',    useFactory: () => rmqClientOptions(process.env.RMQ_AUTH_QUEUE!) },
  { name: 'PRODUCT_CLIENT', useFactory: () => rmqClientOptions(process.env.RMQ_PRODUCT_QUEUE!) },
  // order / inventory ...
]),
```

Controller gateway: inject `@Inject('AUTH_CLIENT') client: ClientProxy` → `firstValueFrom(client.send(pattern, dto))`.

---

## 7. ⚠️ Điều chỉnh cross-cutting đã dựng (quan trọng nhất)

Bộ common hiện **HTTP-centric**, khi lên microservice cần chỉnh:

| Thành phần                               | Hiện tại                                             | Cần làm                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ResponseInterceptor`                    | đã có guard `getType() !== 'http' → passthrough`     | ✅ OK — RPC không bị bọc envelope                                                                                          |
| `LoggingInterceptor` / logger middleware | HTTP-only                                            | Thêm interceptor log cho RPC (dựa `switchToRpc()`) nếu muốn                                                                |
| `AllExceptionsFilter`                    | luôn gọi `switchToHttp()` → **vỡ trong context RPC** | Thêm nhánh theo `host.getType()`: `'rpc'` → `throwError(() => new RpcException(...))`; hoặc tạo `RpcExceptionFilter` riêng |
| `ValidationPipe`                         | dùng chung được                                      | Set `app.useGlobalPipes` trên microservice                                                                                 |
| `RolesGuard` / Bearer auth               | đọc `request` HTTP                                   | Auth làm **ở gateway**; service nội bộ nhận `userId` trong payload, không tự verify JWT                                    |
| Swagger                                  | `setupApp()`                                         | Chỉ còn ở gateway (pure microservice không có HTTP)                                                                        |

---

## 8. Ví dụ 2 luồng

### Sync (RPC — cần kết quả)

```
GET /api/products/:id
  → gateway: firstValueFrom(client.send(PRODUCT_PATTERNS.GET_ONE, { id }))
  → product-service @MessagePattern(GET_ONE) trả product
  → gateway: ResponseInterceptor bọc envelope → REST 200
```

### Async (event — fire-and-forget)

```
POST /api/orders
  → order-service tạo order
  → client.emit(ORDER_EVENTS.CREATED, payload)
  → inventory-service @EventPattern(CREATED) trừ kho (không chờ phản hồi)
```

---

## 9. Checklist triển khai

Làm tuần tự — mỗi bước code + test được ngay:

- [ ] **B1.** Cài deps (mục 3) + `@nestjs/config`.
- [ ] **B2.** Thêm env RMQ (mục 4), load config.
- [ ] **B3.** `libs/shared`: `rmqClientOptions` / `rmqServerOptions` + `setupMicroservice()`.
- [ ] **B4.** `libs/event-contracts`: khai patterns + DTO cho **auth** trước.
- [ ] **B5.** Chỉnh `AllExceptionsFilter` thành host-type-aware (thêm nhánh RPC).
- [ ] **B6.** Convert **auth-service** → microservice (main.ts `createMicroservice` + controller `@MessagePattern`).
- [ ] **B7.** Gateway: `ClientsModule` + 1 controller forward sang auth → test end-to-end (xem queue ở RabbitMQ UI `http://localhost:15672`).
- [ ] **B8.** Lặp lại cho product / order / inventory.
- [ ] **B9.** Thêm luồng event (order → inventory) nếu cần.
- [ ] **B10.** (Sau) Dockerize từng service + healthcheck.

---

## 10. Lưu ý / rủi ro

- **Auth về gateway**: `@CurrentUser` / `RolesGuard` (Bearer) chạy ở gateway; service nội bộ nhận `userId` qua payload, không tự verify JWT.
- **Swagger chỉ còn ở gateway** với mô hình pure microservice. Muốn giữ docs từng service → chọn **hybrid**.
- **guest/guest chỉ kết nối từ localhost** — khi containerize phải tạo user RMQ riêng.
- **Timeout/retry**: `client.send()` mặc định chờ vô hạn → dùng `TimeoutInterceptor` (đã có sẵn) ở gateway.
- **Prisma per-service DB**: mới bật `postgres-auth`; các service khác cần bật DB tương ứng trong docker-compose (đang comment sẵn).
- **RMQ ack**: để `noAck: false` + `prefetchCount` hợp lý để không mất/không nghẽn message.

---

## 11. Sơ đồ phụ thuộc file (sau khi migrate)

```
libs/
  shared/src/common/
    bootstrap/setup-microservice.ts   (mới)
    config/rmq.options.ts             (mới: rmqClient/ServerOptions)
    filters/all-exceptions.filter.ts  (sửa: host-type aware)
  event-contracts/src/
    patterns/*.ts                     (mới)
    dto/**/*.ts                       (mới)

apps/
  api-gateway/         → REST + ClientsModule (RMQ client)
  auth-service/        → createMicroservice (@MessagePattern)
  product-service/     → createMicroservice
  order-service/       → createMicroservice (+ emit events)
  inventory-service/   → createMicroservice (@EventPattern)
```
