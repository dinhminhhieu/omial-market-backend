import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException, RmqContext } from '@nestjs/microservices';
import { INTERNAL_TOKEN_HEADER } from '../constants/metadata.constants';

/**
 * Chặn message RMQ không đến từ gateway (service-to-service authentication).
 *
 * Vấn đề: RabbitMQ mở cổng 5672 — bất kỳ ai vào được mạng nội bộ đều có thể
 * publish thẳng vào `product_queue` và gọi `product.delete` mà không qua gateway,
 * tức bypass toàn bộ JwtAuthGuard. Cần một lớp chứng thực giữa các service.
 *
 * Cách làm: **shared secret trong AMQP header** (`x-internal-token`) —
 * KHÔNG nhét vào payload, vì nhiều pattern gửi payload là string thuần
 * (`send(PRODUCT_PATTERNS.FIND_ONE, id)`) nên không có chỗ đính kèm, và nhét vào
 * payload còn làm bẩn DTO (ValidationPipe `forbidNonWhitelisted` sẽ chửi).
 *
 * Giới hạn phải biết: shared secret chỉ chứng minh "người gửi biết secret",
 * KHÔNG chống được replay và ai đọc được env của 1 service là giả mạo được mọi
 * service. Chuẩn hơn: internal JWT có hạn (mỗi service 1 key) hoặc mTLS
 * (RabbitMQ + client cert) — đắt hơn nhiều, để dành khi lên production thật.
 *
 * Guard đăng ký global trong `CommonModule` nhưng chỉ hoạt động với context RPC
 * → gateway (HTTP) không bị ảnh hưởng.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'rpc') return true;

    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    // Chưa cấu hình secret → không bật kiểm tra (giữ dev/test chạy được).
    if (!expected) return true;

    const rmqContext = context.switchToRpc().getContext<RmqContext>();
    const headers = rmqContext?.getMessage?.()?.properties?.headers as
      Record<string, unknown> | undefined;
    const received = headers?.[INTERNAL_TOKEN_HEADER];

    if (received !== expected) {
      throw new RpcException({
        statusCode: 401,
        message: 'Message không đến từ nguồn tin cậy (thiếu internal token)',
      });
    }

    return true;
  }
}
