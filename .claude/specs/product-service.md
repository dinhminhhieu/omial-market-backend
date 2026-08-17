# Spec: product-service

**Vai trò:** pure RMQ microservice (KHÔNG có HTTP) — quản lý danh mục, thương hiệu,
nhãn, mẫu tuỳ chọn và sản phẩm (kèm option / attribute / variant).
**Queue:** `RMQ_PRODUCT_QUEUE` (`product_queue`) · **DB:** Postgres riêng `omial_product_db` (:5434).

## Bản đồ file
| Đường dẫn | Vai trò |
| --- | --- |
| [main.ts](../../apps/product-service/src/main.ts) | `createMicroservice` + `setupMicroservice`, nạp dotenv. |
| [product-service.module.ts](../../apps/product-service/src/product-service.module.ts) | Root — import `CommonModule`, `PrismaModule` + 5 module nghiệp vụ. |
| `prisma/` | `PrismaService extends PrismaClient` (adapter-pg). |
| `brand/` · `label/` | CRUD đơn giản, **hard delete**. |
| `category/` | CRUD + cây cha–con, **soft delete**. |
| `option-template/` | Thư viện mẫu option dùng chung, **hard delete**. |
| `product/` | Trùm cuối: SIMPLE/OPTION/VARIANT, **soft delete**. |
| [common/option-group.validator.ts](../../apps/product-service/src/common/option-group.validator.ts) | `assertOptionGroupValid()` — invariant min/max/default dùng chung cho product + option-template. |

## Message patterns
Đều dạng `<resource>.<action>` — CRUD chuẩn (`create` · `find_all` · `find_one` · `update` · `delete`)
cho: `brand` · `label` · `category` · `product` · `option_template`.
Hằng số ở [libs/event-contracts/src/patterns/product-service/](../../libs/event-contracts/src/patterns/product-service/).
Gateway expose tương ứng: `/brands` `/labels` `/categories` `/products` `/option-templates`.

## Model & quyết định nghiệp vụ (đọc trước khi sửa!)

### Chiến lược xoá — per-entity (chi tiết: [docs/patterns/soft-delete.md](../../docs/patterns/soft-delete.md))
| Entity | Xoá kiểu | Ghi chú |
| --- | --- | --- |
| Label, Brand, OptionTemplate | **Hard** | Không ai tham chiếu lịch sử; FK tự lo (`Cascade`/`SetNull`). |
| Category | **Soft** | `delete()` phải chặn khi còn danh mục con / sản phẩm (Restrict ở schema chỉ là lưới an toàn — soft delete là UPDATE nên `onDelete` KHÔNG chạy). Đổi `slug` khi xoá để giải phóng `@unique`. |
| Product, ProductVariant | **Soft** | Đơn hàng cần truy xuất lại. Xoá phải đổi **CẢ `slug` LẪN `sku`** (đều `@unique`) + soft delete variant kèm đổi `sku` của chúng. |

### ⛔ Tồn kho KHÔNG thuộc service này
`ProductVariant` **không còn cột `stock`** (migration `drop_variant_stock_move_to_inventory`,
2026-08-11) — số tồn thuộc **inventory-service** (single source of truth, mô hình sổ cái;
xem [.claude/specs/inventory-service.md](inventory-service.md)). Nhập tồn = gọi
`inventory.receive` sau khi tạo sản phẩm, KHÔNG nhét lại stock vào create/update product.
Option item không có tồn kho — chỉ có `status` bật/tắt ("tạm hết topping").

### ProductType — discriminator (`SIMPLE` / `OPTION` / `VARIANT`)
- Enum khai **2 nơi**: `schema.prisma` + mirror TS ở `libs/event-contracts/src/enums/product-type.enum.ts`.
  ⛔ **Contracts KHÔNG được import Prisma generated** (gateway không có Prisma, sai chiều `libs → apps`, và Jest không resolve được path `apps/...`). Sửa enum → sửa cả hai.
- Invariant (`validateProductTypeInvariants`): SIMPLE không có option/variant · OPTION phải ≥1 nhóm option và không có variant · VARIANT phải ≥1 attribute + ≥1 variant, không có option.
- `update` chặn đổi type khi dữ liệu cũ còn option/variant (chống mất dữ liệu ngầm).

### Option: template vs bản sao của sản phẩm
- `OptionTemplate` = **thư viện mẫu**, không gắn `productId`. FE fetch mẫu → user sửa trên form → gửi data cuối qua `CreateProductDto.productOptionGroups` (nested). Backend **không** có bước "apply template".
- Sửa items: **template = replace-all** (`deleteMany + create`, không nhận id item) vì không ai trỏ tới.
  **ProductOptionItem = diff/sync giữ id ổn định** — giỏ hàng tham chiếu id để hydrate; id churn ⇒ khách bị bắt "chọn lại" dù không đổi gì.
- `assertOptionGroupValid` gác: `minSelect ≤ maxSelect ≤ số item`, `#isDefault ≤ maxSelect`, default không trỏ item `status=false`. Gọi ở **mọi** đường ghi (create + update, cả 2 service).
- Sync theo id phải **check ownership**: id group/item gửi lên phải thuộc đúng sản phẩm/nhóm, không thì sửa nhầm dữ liệu người khác.

## Quy ước kỹ thuật
- **Decimal → number**: Prisma trả `Decimal`, DTO response khai `number` → service map (`Number(x)`) trong `toResponse()`. Contracts không được biết tới `Decimal`.
- **Prisma generator**: `moduleFormat = "cjs"` + `runtime = "nodejs"` trong schema — **BẮT BUỘC cho MỌI service** (auth từng thiếu → mọi spec import PrismaService đều gãy "Cannot use 'import.meta' outside a module"). Mặc định generator `prisma-client` sinh ESM.
- **`$transaction`**: `product.update` truyền `{ timeout: 15_000 }` — vòng sync chạy nhiều query tuần tự, mặc định 5s dễ chạm (P2028).
- Slug tự sinh từ `name` nếu FE bỏ trống (`buildSlugtify`); SKU tự sinh nếu trống (`generateSku`). SKU sản phẩm/variant **read-only khi update**.
- Đổi schema → `prisma migrate dev` → **restart TS Server** (generated client nằm ngoài luồng gõ tay, IDE hay cache cũ).

## Trạng thái & TODO
- ✅ brand · label · category · option-template · product (CRUD đủ, controller + gateway route đủ).
- ✅ Build + `pnpm test` xanh (22 test). Phần lớn vẫn là scaffold "should be defined".
- ✅ Unit test nghiệp vụ (Phase 0 mục 5.2 — DONE): product 66% (invariant type, sync option giữ id, delete slug+sku, pricing sale window) · category 85% (cycle, chặn xoá) · option-template 86% (replace-all, invariant sau update) · label 91% · validator 100%.
- ⬜ `toResponse()` của product đang `any` → nên dùng `Prisma.ProductGetPayload<...>`; hiện response còn lộ `isDeleted`, `deletedAt`, bảng nối `productLabels`.
- ⬜ Module riêng cho product-attribute / product-variant nếu cần sửa lẻ (giờ nằm nested trong product).
