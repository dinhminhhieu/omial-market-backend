// Message patterns (khoá định danh cho send/emit)
export * from './patterns/auth-service/auth.patterns';
export * from './patterns/product-service/brand.patterns';
export * from './patterns/product-service/label.patterns';
export * from './patterns/product-service/category.patterns';
export * from './patterns/product-service/product.patterns';
export * from './patterns/product-service/option-template.patterns';
export * from './patterns/inventory-service/inventory.patterns';
export * from './patterns/order-service/order.patterns';

// Enums dùng chung
export * from './enums/otp-purpose.enum';
export * from './enums/product-type.enum';
export * from './enums/stock.enum';
export * from './enums/order-status.enum';

// DTOs (payload + response, dùng chung gateway ↔ service)
export * from './dto/auth-service/req/login.dto';
export * from './dto/auth-service/res/login-response.dto';
export * from './dto/auth-service/req/register.dto';
export * from './dto/auth-service/req/verify-otp.dto';
export * from './dto/auth-service/req/resend-otp.dto';
export * from './dto/auth-service/req/forgot-password.dto';
export * from './dto/auth-service/req/reset-password.dto';
export * from './dto/auth-service/req/refresh-token.dto';
export * from './dto/auth-service/req/logout.dto';
export * from './dto/auth-service/req/auth-tokens.dto';
export * from './dto/auth-service/res/message-response.dto';

// Product-service DTOs — label
export * from './dto/product-service/label/req/create-label.dto';
export * from './dto/product-service/label/req/update-label.dto';
export * from './dto/product-service/label/res/label-response.dto';

// Product-service DTOs — brand
export * from './dto/product-service/brand/req/create-brand.dto';
export * from './dto/product-service/brand/req/update-brand.dto';
export * from './dto/product-service/brand/res/brand-response.dto';

// Product-service DTOs — category
export * from './dto/product-service/category/req/create-category.dto';
export * from './dto/product-service/category/req/update-category.dto';
export * from './dto/product-service/category/res/category-response.dto';

// Product-service DTOs — product
export * from './dto/product-service/product/req/create-product.dto';
export * from './dto/product-service/product/req/update-product.dto';
export * from './dto/product-service/product/res/product-response.dto';

// Product-service DTOs — product-option (group + item)
export * from './dto/product-service/product-option/req/create-product-option-item.dto';
export * from './dto/product-service/product-option/req/create-product-option-group.dto';
export * from './dto/product-service/product-option/req/product-option-group-input.dto';
export * from './dto/product-service/product-option/res/product-option-item-response.dto';
export * from './dto/product-service/product-option/res/product-option-group-response.dto';

// Product-service DTOs — option-template (thư viện mẫu + áp vào sản phẩm)
export * from './dto/product-service/option-template/req/create-option-template-item.dto';
export * from './dto/product-service/option-template/req/create-option-template.dto';
export * from './dto/product-service/option-template/req/update-option-template.dto';
export * from './dto/product-service/option-template/res/option-template-item-response.dto';
export * from './dto/product-service/option-template/res/option-template-response.dto';

// Product-service DTOs — product-variant (attributes + variants)
export * from './dto/product-service/product-variant/req/create-product-attribute-value.dto';
export * from './dto/product-service/product-variant/req/create-product-attribute.dto';
export * from './dto/product-service/product-variant/req/variant-attribute-selection.dto';
export * from './dto/product-service/product-variant/req/create-product-variant.dto';
export * from './dto/product-service/product-variant/res/product-attribute-response.dto';
export * from './dto/product-service/product-variant/res/product-variant-response.dto';

// Inventory-service DTOs — kho (StockItem + sổ cái StockMovement)
export * from './dto/inventory-service/inventory/req/stock-ref-input.dto';
export * from './dto/inventory-service/inventory/req/get-stock.dto';
export * from './dto/inventory-service/inventory/req/receive-stock.dto';
export * from './dto/inventory-service/inventory/req/issue-stock.dto';
export * from './dto/inventory-service/inventory/req/adjust-stock.dto';
export * from './dto/inventory-service/inventory/req/get-stock-movements.dto';
export * from './dto/inventory-service/inventory/res/stock-item-response.dto';
export * from './dto/inventory-service/inventory/res/stock-movement-response.dto';

// Order-service DTOs — đơn hàng (snapshot + máy trạng thái)
export * from './dto/order-service/order/req/create-order-item-input.dto';
export * from './dto/order-service/order/req/create-order.dto';
export * from './dto/order-service/order/req/find-all-orders.dto';
export * from './dto/order-service/order/req/update-order-status.dto';
export * from './dto/order-service/order/res/order-response.dto';
