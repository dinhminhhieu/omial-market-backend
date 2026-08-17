import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  buildLoggerOptions,
  CommonModule,
  JwtAuthGuard,
  rmqClientOptions,
  RolesGuard,
} from '@app/shared';
import {
  AUTH_CLIENT,
  INVENTORY_CLIENT,
  ORDER_CLIENT,
  PRODUCT_CLIENT,
} from './clients';
import {
  BrandController,
  CategoryController,
  LabelController,
  OptionTemplateController,
  ProductController,
} from './product-service';
import { AuthController } from './auth-service';
import { InventoryController } from './inventory-service';
import { OrderController } from './order-service';
import { MediaModule } from './media/media.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    CommonModule,
    MediaModule,
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_AUTH_QUEUE ?? 'auth_queue'),
      },
      {
        name: PRODUCT_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_PRODUCT_QUEUE ?? 'product_queue'),
      },
      {
        name: INVENTORY_CLIENT,
        useFactory: () =>
          rmqClientOptions(
            process.env.RMQ_INVENTORY_QUEUE ?? 'inventory_queue',
          ),
      },
      {
        name: ORDER_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_ORDER_QUEUE ?? 'order_queue'),
      },
    ]),
    LoggerModule.forRoot(buildLoggerOptions('api-gateway')),

    // Gateway chỉ VERIFY access token (auth-service mới là nơi KÝ) — cùng
    // JWT_SECRET là đủ, không cần gọi RPC hỏi auth mỗi request.
    // registerAsync (KHÔNG phải register): webpack hoist mọi import lên trước
    // `loadEnv()` trong main.ts, nên đọc process.env ngay lúc định nghĩa module
    // sẽ ra `undefined` → verify token nào cũng fail. useFactory chạy muộn hơn,
    // lúc DI khởi tạo, khi env đã nạp xong.
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET }),
    }),

    // Rate limit mặc định toàn hệ: 100 req / phút / IP.
    // Endpoint nhạy cảm (login/register) siết riêng bằng @Throttle ở controller.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
  ],
  controllers: [
    AuthController,
    BrandController,
    LabelController,
    CategoryController,
    OptionTemplateController,
    ProductController,
    InventoryController,
    OrderController,
  ],
  // THỨ TỰ QUAN TRỌNG: Nest chạy guard theo thứ tự khai báo.
  // 1. Throttler chặn spam TRƯỚC (rẻ nhất, không cần verify chữ ký).
  // 2. JwtAuthGuard xác thực → điền `request.user`.
  // 3. RolesGuard phân quyền dựa trên `request.user` vừa được điền.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class ApiGatewayModule {}
