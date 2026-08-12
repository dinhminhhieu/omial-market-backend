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
| `inventory-service/` | `InventoryController` — 5 route `/inventory/*`. |
| `media/` | Module RIÊNG của gateway (KHÔNG qua RMQ, không ClientProxy) — cấp presigned URL upload ảnh lên MinIO/S3. DTO nằm tại chỗ, không nằm trong event-contracts. |

## Clients RMQ đã đăng ký
| Token | Queue (env) | Tới service |
| --- | --- | --- |
| `AUTH_CLIENT` | `RMQ_AUTH_QUEUE` (`auth_queue`) | auth-service |
| `PRODUCT_CLIENT` | `RMQ_PRODUCT_QUEUE` (`product_queue`) | product-service |
| `INVENTORY_CLIENT` | `RMQ_INVENTORY_QUEUE` (`inventory_queue`) | inventory-service |
| `ORDER_CLIENT` | `RMQ_ORDER_QUEUE` (`order_queue`) | order-service |

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

### Orders (`/orders`, `ORDER_PATTERNS`) — smoke e2e toàn hệ pass 2026-08-12
| Method + Path | Pattern | Ghi chú |
| --- | --- | --- |
| `POST /orders` | `order.create` | Checkout — FE chỉ gửi id + qty, giá server tính |
| `GET /orders` | `order.find_all` | filter status + search + phân trang |
| `GET /orders/:id` | `order.find_one` | kèm items + statusHistory |
| `PATCH /orders/:id/status` | `order.update_status` | body `UpdateOrderStatusBodyDto` (OmitType bỏ id — id từ param) |

### Media (`/media`) — smoke e2e pass 2026-08-12
- `POST /media/presign-upload` (`PresignUploadDto` → `PresignUploadResponseDto`): validate whitelist ảnh + ≤5MB → ký PUT URL (600s) cho key `products/{uuid}.{ext}` → FE up THẲNG lên MinIO, backend không chạm bytes. `publicUrl` nhét vào `Product.images`.
- Hạ tầng: MinIO trong docker-compose (`:9000` API, `:9001` console minioadmin/minioadmin), bucket `omial-media` tự tạo + public-READ qua `minio-init`. Env `MINIO_*`, `MEDIA_BUCKET`, `MEDIA_PUBLIC_URL` ở root `.env`. Client cần `forcePathStyle: true` (MinIO dùng path-style URL).
- ⚠️ SDK v3 mặc định KHÔNG ký Content-Type (`SignedHeaders=host`) — PUT sai type vẫn 200. Ép khớp: `getSignedUrl(..., { signableHeaders: new Set(['content-type']) })`. Size cũng KHÔNG enforce được qua presigned PUT (`size` trong DTO chỉ chặn sớm ở bước xin ký) — muốn chặt phải dùng presigned POST policy (`content-length-range`).
- TODO: đứng sau AuthGuard (Phase 1) · cron dọn ảnh mồ côi (up rồi không gắn product).

## Quy ước / lưu ý
- Gọi RPC qua **`RmqForwarder`** (`@app/shared`, xem [shared-libs.md](shared-libs.md)): controller tạo instance trong constructor `new RmqForwarder(client, 'tên-service')`, handler gọi `this.x.send(PATTERN, payload)`. Timeout 5s + map lỗi RPC → `HttpException`, `TimeoutError` → 504 — KHÔNG tự viết lại `firstValueFrom/timeout/catchError` trong controller mới.
- Response tự bọc envelope `{success, statusCode, data, timestamp}` bởi `ResponseInterceptor` (`CommonModule`).
- `@Public()` đánh dấu route công khai (cho khi bật AuthGuard sau).
- Thêm service mới: token vào `clients.ts` → đăng ký trong `ClientsModule` → folder `<service>/` + controller + barrel `index.ts` → thêm vào `controllers`.

## Trạng thái & TODO
- ✅ Auth 8 route · product 5 resource · inventory 4 route (e2e đã chạy thật: receive → get_stock → adjust → movements, cả ca lỗi 404/400 xuyên RMQ về đúng message).
- ⬜ `JwtAuthGuard` verify access token + gắn `userId` vào payload forward.
- ⬜ Client + route cho order-service (khi migrate order).
