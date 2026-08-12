# ADR-001: Multi-tenancy theo Pool model (chung schema, cột tenantId)

Date: 2026-08-07
Status: accepted — **deferred**: repo này KHÔNG triển khai (mục tiêu cao nhất là
học microservice). ADR ghi lại hướng đã chốt để áp dụng khi build SaaS thật.

## Context

Dự án là bản tham khảo (reference implementation) cho một SaaS thương mại sau này:
bán theo hợp đồng, mỗi khách một "portal" cùng template, phân biệt bằng prefix
(`/zami`, `/pasal`). Quy mô kỳ vọng: **hàng trăm tenant**. Kiến trúc hiện tại là
microservice, mỗi service một Postgres riêng (database-per-service).

Cần chọn cách cô lập dữ liệu giữa các tenant, và cách `tenantId` chảy xuyên
hệ thống (gateway → RMQ → service → DB).

Lưu ý: **database-per-service** (chia theo nghiệp vụ) và **multi-tenancy**
(chia theo khách hàng) là 2 trục vuông góc — quyết định này KHÔNG đổi số DB
theo service, chỉ thêm chiều tenant vào trong từng DB.

## Decision

1. **Pool model**: mọi bảng nghiệp vụ thêm cột `tenantId`. Vẫn 1 DB / service.
2. **Unique & index đổi theo tenant**:
   - Mọi `@unique` nghiệp vụ → composite: `@@unique([tenantId, slug])`,
     `@@unique([tenantId, sku])`, `@@unique([tenantId, name])`, `@@unique([tenantId, email])`…
   - Mọi index nghiệp vụ **dẫn đầu bằng `tenantId`**: `@@index([tenantId, status, priority])`
     (100% query có `WHERE tenantId = ...`).
3. **Resolve tenant ở gateway**: parse prefix path (`/:tenantSlug/...`) → tra bảng
   `Tenant` (cache Redis) → `tenantId` gắn vào request context.
4. **JWT mang `tenantId`**: token scope theo tenant. User của shop A không dùng
   token đó gọi sang shop B được, kể cả đổi prefix URL.
5. **`tenantId` đi trong payload RMQ**: envelope `{ tenantId, data }` do gateway
   đóng — service không tin client tự khai.
6. **Chống quên filter 2 lớp**:
   - Prisma Client Extension tự chèn `tenantId` vào mọi query (viết 1 lần ở libs/shared).
   - (Hardening về sau, khi build thật) Postgres Row-Level Security làm lưới cuối.
7. **Bảng `Tenant` + `Membership(userId, tenantId, role)`** đặt ở auth-service.
   Một user (email) có thể thuộc nhiều tenant.
8. Redis key, cache key, log đều namespace theo tenant.

## Alternatives

| Phương án | Vì sao không chọn |
| --- | --- |
| **Silo** — DB riêng mỗi tenant | Vài trăm tenant → migration × N (fail giữa chừng = nửa cũ nửa mới), connection pool nổ (N × pool > max_connections, phải dựng pgBouncer), backup/monitor × N. Chỉ đáng khi khách enterprise đòi cô lập theo hợp đồng — lúc đó có thể lai: vài khách lớn silo, còn lại pool. |
| **Bridge** — Postgres schema riêng mỗi tenant | Trung gian nửa vời: vẫn migrate × N, tooling Prisma hỗ trợ kém. |
| **Subdomain** (`zami.example.com`) thay vì path prefix | Chuẩn SaaS phổ biến hơn (cookie cô lập theo domain, dễ gắn custom domain). Chọn path prefix vì yêu cầu sản phẩm đã định + dev/local đơn giản (không cần wildcard DNS). Đổi sang subdomain sau này chỉ đụng tầng resolve ở gateway — các tầng dưới không biết gì. |
| `tenantId` do FE gửi trong body | Không tin được — client giả mạo là đọc dữ liệu tenant khác. Nguồn sự thật duy nhất: gateway resolve + JWT. |

## Consequences

- (+) Thêm tenant mới = 1 dòng INSERT + seed, không cần hạ tầng mới.
- (+) Migration/backup/monitor không nhân theo số khách.
- (−) **Rủi ro lớn nhất: quên filter `tenantId` = rò dữ liệu chéo tenant** — sự cố
  mất hợp đồng. Bắt buộc auto-inject (extension) chứ không dựa trí nhớ; RLS khi lên thật.
- (−) Mọi contract RMQ phải mang tenantId → sửa envelope 1 lần, mọi service theo.
- (−) Noisy neighbor: 1 tenant bắn tải làm chậm tenant khác → rate limit theo
  tenant (Phase 1), về lâu dài có thể tách tenant lớn ra silo riêng.
- Schema hiện tại (product) phải migrate: thêm cột + đổi unique/index composite.
- Thứ tự triển khai trong repo này: ADR này → `Tenant`/`Membership` + JWT (auth)
  → gateway resolve → product-service thêm `tenantId` → inventory build
  tenant-aware ngay từ đầu.
