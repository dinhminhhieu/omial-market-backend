# Spec: order-service

**Vai trò:** pure RMQ microservice — đơn hàng theo nguyên tắc **SNAPSHOT** + **máy trạng thái**.
Service ĐẦU TIÊN gọi service khác qua RMQ (order → product, order → inventory).
**Queue:** `RMQ_ORDER_QUEUE` (`order_queue`) · **DB:** `omial_order_db` (:5435).

## Trạng thái
- ✅ Schema + migration `init_order` + contracts (4 patterns + DTO) + DB :5435 + scripts.
- ✅ Service/controller/main.ts (user tự code): 4 handler + máy trạng thái (map `TRANSITIONS`)
  + retry P2002 khi sinh code + client RMQ tới product/inventory (service-to-service ĐẦU TIÊN).
- ✅ Gateway `ORDER_CLIENT` + 4 route `/orders/*` — **smoke e2e TOÀN HỆ pass 2026-08-12**
  (4 service chạy cùng lúc: tạo category → product OPTION → nhập kho → đặt hàng có topping
  → chặn minSelect/thiếu tồn/transition sai → PENDING→…→COMPLETED → huỷ kèm note).
- ⬜ Unit test nghiệp vụ (máy trạng thái + luồng create là ca ngon nhất).
- ⬜ Phase 2: saga (reserve khi tạo → SALE khi hoàn tất → release khi huỷ), payment-service mock.

## 3 bug đã gặp lúc ghép nối (đọc để khỏi tái phạm)
1. **Contract nói dối**: response DTO khai `items` nhưng product-service (toResponse spread `any`)
   trả `productOptionItems` → TS không bắt được, runtime undefined → mọi option bị coi là
   "không hợp lệ". Đã đổi DTO về `productOptionItems` khớp wire thật. Bài học: toResponse
   `any` + spread = contract mất hiệu lực.
2. **`catchError(() => [])`**: mảng trần bị rxjs coi là observable RỖNG (emit 0 lần) →
   `firstValueFrom` ném `EmptyError`. Phải `catchError(() => of([]))`.
3. **`@Transform(emptyToUndefined)` sai cách gọi**: Nest truyền `TransformFnParams` (object),
   không phải giá trị trần → hàm trả nguyên object → "must be a string". Quy ước bắt buộc:
   `@Transform(({ value }) => emptyToUndefined(value))`.

## Model (prisma/schema.prisma)
| Model | Vai trò | Điểm chú ý |
| --- | --- | --- |
| `Order` | Đơn + snapshot người nhận + tiền | `code` human-readable `@unique` (`ORD-260812-A1B2`). Tiền `Decimal(12,2)`: `total = subtotal + shippingFee - discountAmount`. `discountAmount`/`promotionId` để sẵn cho promotion. **KHÔNG có delete** — vòng đời = status |
| `OrderItem` | 1 dòng hàng — **snapshot** name/price/image, tham chiếu productId/variantId/sku | `isGift` + `promotionId`: quà khuyến mãi = line `unitPrice 0` (kho vẫn trừ). `unitPrice` đã GỒM tổng extraPrice option |
| `OrderItemOption` | Option khách chọn — snapshot groupName/itemName/extraPrice | giữ `optionItemId` gốc chỉ để tham chiếu |
| `OrderStatusHistory` | **Sổ cái trạng thái append-only** (ledger #4) | `fromStatus null` = dòng khởi tạo. Lý do huỷ nằm ở `note` — không có cột cancelReason |

### Máy trạng thái (service gác — viết map TRANSITIONS, đừng if-else chay)
```
PENDING → CONFIRMED | CANCELLED
CONFIRMED → SHIPPING | CANCELLED
SHIPPING → COMPLETED | CANCELLED (giao thất bại)
COMPLETED / CANCELLED → terminal (mọi chuyển tiếp = BadRequest)
```

## Message patterns ([order.patterns.ts](../../libs/event-contracts/src/patterns/order-service/order.patterns.ts))
| Pattern | DTO req → res | Ghi chú |
| --- | --- | --- |
| `order.create` | `CreateOrderDto` → `OrderResponseDto` | Checkout — xem "Luồng create" dưới |
| `order.find_all` | `FindAllOrdersDto` → `{data, meta}` | filter status + search (code/tên/SĐT, insensitive) + phân trang, mới nhất trước |
| `order.find_one` | `id: string` → `OrderResponseDto` | include items.options + statusHistory |
| `order.update_status` | `UpdateOrderStatusDto` → `OrderResponseDto` | Gác transition + ghi history TRONG transaction |

## Luồng `order.create` (nghiệp vụ chính — làm theo thứ tự)
1. **FE chỉ gửi id + quantity** (`CreateOrderItemInputDto` KHÔNG có giá) — **không bao giờ tin giá client**.
2. Gọi `product.find_one` cho từng productId (pattern có sẵn — chấp nhận N+1 Phase 0 vì đơn ≤50 dòng; TODO pattern batch `product.get_checkout_info`). Validate: product tồn tại + `status=true` + đúng type (VARIANT phải kèm variantId hợp lệ; OPTION thì optionItemIds phải thuộc đúng group của sản phẩm + item `status=true` + thoả minSelect/maxSelect từng group).
3. Tính giá server-side: `unitPrice = giá hiện hành (variant ?? product, tôn trọng sale window) + Σ extraPrice option`. `lineTotal = unitPrice × qty` → `subtotal`, `total`.
4. Gọi `inventory.get_stock` (batch, có sẵn) — item nào có StockItem thì check `available ≥ qty`, KHÔNG có = không theo dõi tồn, cho qua.
   ⚠️ **Phase 0 KHÔNG reserve** — có race window (2 khách đặt cái cuối cùng đều pass check). Chấp nhận + ghi nhận: đây chính là bài mở màn saga Phase 2.
5. `$transaction`: tạo Order + OrderItems + Options (nested create) + dòng history đầu (`null → PENDING`). Sinh `code` = `ORD-<yymmdd>-<4 ký tự random>`; đụng unique (P2002) thì retry.

## Kỹ thuật lần đầu xuất hiện: service GỌI service qua RMQ
- order-service.module: `ClientsModule.registerAsync` với `rmqClientOptions(product_queue / inventory_queue)` — y chang gateway ([api-gateway.module.ts](../../apps/api-gateway/src/api-gateway.module.ts) làm mẫu), rồi dùng `RmqForwarder`? KHÔNG — RmqForwarder map lỗi sang HttpException cho REST; trong service nên tự `firstValueFrom(client.send(...).pipe(timeout(5000)))` và dịch lỗi thành exception nghiệp vụ của mình ("Sản phẩm không còn bán").
- Bẫy: client RMQ connect lazy — lần gọi đầu hơi chậm là bình thường.

## Quy ước
- Decimal → number trong `toResponse` (`Number(x)`) như product.
- `customerId` Phase 0 nhận từ payload (chưa tin được) — Phase 1 gateway verify JWT rồi tự gắn, bỏ field khỏi DTO.
- Generator cjs + nodejs (chuẩn chung). Enum `OrderStatus` mirror 2 nơi.
