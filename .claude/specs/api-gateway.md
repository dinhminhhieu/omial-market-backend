# Spec: api-gateway

**Vai trò:** app HTTP duy nhất (REST + Swagger `/docs`). Facade — nhận REST,
forward qua RabbitMQ tới service, trả kết quả. KHÔNG chứa business logic.
**Cổng:** `http://localhost:8000` (prefix `/api`, PORT lấy từ root `.env`).

## Bản đồ file
| File | Vai trò |
| --- | --- |
| [main.ts](../../apps/api-gateway/src/main.ts) | `NestFactory.create` + `setupApp` (HTTP, CORS, Swagger). Nạp dotenv root `.env`. |
| [api-gateway.module.ts](../../apps/api-gateway/src/api-gateway.module.ts) | `ClientsModule.registerAsync` các ClientProxy RMQ + đăng ký controllers. |
| [clients.ts](../../apps/api-gateway/src/clients.ts) | Token DI cho ClientProxy (`AUTH_CLIENT`, `PRODUCT_CLIENT`, `INVENTORY_CLIENT`). |
| `auth-service/` | `AuthController` — 8 route `/auth/*`. |
| `product-service/` | 5 controller: `/brands` `/labels` `/categories` `/option-templates` `/products` (CRUD chuẩn, mỗi cái 5 route). |
| `inventory-service/` | `InventoryController` — 4 route `/inventory/*`. |

## Clients RMQ đã đăng ký
| Token | Queue (env) | Tới service |
| --- | --- | --- |
| `AUTH_CLIENT` | `RMQ_AUTH_QUEUE` (`auth_queue`) | auth-service |
| `PRODUCT_CLIENT` | `RMQ_PRODUCT_QUEUE` (`product_queue`) | product-service |
| `INVENTORY_CLIENT` | `RMQ_INVENTORY_QUEUE` (`inventory_queue`) | inventory-service |

## Endpoints (tất cả `@Public`, prefix `/api`)

### Auth (`/auth`, `AUTH_PATTERNS`)
`POST` login · register · verify-otp · resend-otp · forgot-password · reset-password · refresh · logout.

### Product-service (5 resource, CRUD chuẩn)
`/brands` `/labels` `/categories` `/option-templates` `/products` — mỗi resource:
`POST /` · `GET /` (phân trang) · `GET /:id` · `PUT /:id` (payload `{...dto, id}`) · `DELETE /:id`.

### Inventory (`/inventory`, `INVENTORY_PATTERNS`) — smoke test e2e pass 2026-08-12
| Method + Path | Pattern | Ghi chú |
| --- | --- | --- |
| `POST /inventory/stock/query` | `inventory.get_stock` | **POST vì là batch query** (body chứa list ref) + `@HttpCode(200)` |
| `POST /inventory/receive` | `inventory.receive` | Phiếu nhập kho |
| `POST /inventory/issue` | `inventory.issue` | Phiếu xuất kho thủ công (hủy/nội bộ/trả NCC) |
| `POST /inventory/adjust` | `inventory.adjust` | Phiếu kiểm kê (`@HttpCode(200)`) |
| `GET /inventory/movements` | `inventory.get_movements` | Query params `refType`/`refId`/`page`/`limit` |

## Quy ước / lưu ý
- Gọi RPC qua **`RmqForwarder`** (`@app/shared`, xem [shared-libs.md](shared-libs.md)): controller tạo instance trong constructor `new RmqForwarder(client, 'tên-service')`, handler gọi `this.x.send(PATTERN, payload)`. Timeout 5s + map lỗi RPC → `HttpException`, `TimeoutError` → 504 — KHÔNG tự viết lại `firstValueFrom/timeout/catchError` trong controller mới.
- Response tự bọc envelope `{success, statusCode, data, timestamp}` bởi `ResponseInterceptor` (`CommonModule`).
- `@Public()` đánh dấu route công khai (cho khi bật AuthGuard sau).
- Thêm service mới: token vào `clients.ts` → đăng ký trong `ClientsModule` → folder `<service>/` + controller + barrel `index.ts` → thêm vào `controllers`.

## Trạng thái & TODO
- ✅ Auth 8 route · product 5 resource · inventory 4 route (e2e đã chạy thật: receive → get_stock → adjust → movements, cả ca lỗi 404/400 xuyên RMQ về đúng message).
- ⬜ `JwtAuthGuard` verify access token + gắn `userId` vào payload forward.
- ⬜ Client + route cho order-service (khi migrate order).
