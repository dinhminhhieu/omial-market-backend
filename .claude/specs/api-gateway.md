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

## Endpoints (prefix `/api`) — quyền xem mục 🔐 Bảo mật bên dưới

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
- ✅ Đã đứng sau AuthGuard (Phase 1) — chỉ user đăng nhập mới xin được chữ ký. ⬜ cron dọn ảnh mồ côi.

## 🔐 Bảo mật (Phase 1)
| Lớp | Thành phần | Ghi chú |
| --- | --- | --- |
| Guard global (đúng thứ tự) | `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` | Chặn spam trước (rẻ nhất) → xác thực → phân quyền |
| Xác thực | `JwtAuthGuard` (libs/shared) verify chữ ký bằng `JWT_SECRET`, gắn `request.user` | Không dùng passport (thừa 3 dep). Chuẩn hoá `role` chuỗi → `roles` mảng |
| Phân quyền | `@Public()` / `@Roles('ADMIN')` | **Route mới mặc định CẦN token** |
| Rate limit | global 100 req/phút/IP; login 5, register 3, forgot-password 3 | `@Throttle` ở controller |
| Headers | `helmet` trong `setupApp()` (CSP tắt khi còn Swagger) | |
| CORS | whitelist qua `CORS_ORIGINS`, `credentials: true` | bỏ trống = mọi origin (chỉ dev) |
| Danh tính | Gateway **ĐÈ** `customerId` = `user.sub` khi tạo đơn | KHÔNG tin field FE gửi |

Chính sách quyền hiện tại: GET `products/categories/brands/labels` = `@Public` ·
mọi thao tác GHI + `option-templates` + `inventory` + danh sách/chi tiết/đổi trạng thái đơn = `@Roles('ADMIN')` ·
`POST /orders` + `POST /media/presign-upload` = user đã đăng nhập.

⚠️ **Bẫy đã dính**: `JwtModule.register({ secret: process.env.JWT_SECRET })` đọc env
lúc import module, mà webpack hoist import lên TRƯỚC `loadEnv()` trong main.ts →
secret `undefined` → mọi token 401. Phải dùng `registerAsync` + `useFactory`.

## Quy ước / lưu ý
- Gọi RPC qua **`RmqForwarder`** (`@app/shared`, xem [shared-libs.md](shared-libs.md)): controller tạo instance trong constructor `new RmqForwarder(client, 'tên-service')`, handler gọi `this.x.send(PATTERN, payload)`. Timeout 5s + map lỗi RPC → `HttpException`, `TimeoutError` → 504 — KHÔNG tự viết lại `firstValueFrom/timeout/catchError` trong controller mới.
- Response tự bọc envelope `{success, statusCode, data, timestamp}` bởi `ResponseInterceptor` (`CommonModule`).
- `@Public()` đánh dấu route công khai — BẮT BUỘC cho route không cần đăng nhập, vì guard đã bật global.
- Thêm service mới: token vào `clients.ts` → đăng ký trong `ClientsModule` → folder `<service>/` + controller + barrel `index.ts` → thêm vào `controllers`.

## Trạng thái & TODO
- ✅ Auth 8 route · product 5 resource · inventory 5 route · order 4 route · media 1 route — smoke e2e toàn hệ pass.
- ✅ Phase 1: JwtAuthGuard + RolesGuard + Throttler + helmet/CORS + internal token (13 unit test cho guard).
- ⬜ Response serialization chống leak field (`ClassSerializerInterceptor` — mục 6.4).
- ⬜ Khách xem đơn CỦA MÌNH (hiện `GET /orders` chỉ ADMIN; cần lọc theo `user.sub`).
