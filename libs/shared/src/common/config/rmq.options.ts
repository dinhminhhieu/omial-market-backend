import { RmqOptions, Transport } from '@nestjs/microservices';

/**
 * URL RabbitMQ đọc từ env (fallback về guest/guest local nếu chưa set).
 * Đọc TRONG hàm (không đặt hằng ở top-level) để chắc chắn `.env` đã được nạp
 * trước khi lấy giá trị — main.ts nạp dotenv rồi mới gọi các factory này.
 */
function rabbitmqUrl(): string {
  return process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
}

/**
 * Option cho phía CLIENT (api-gateway) — bên GỬI message.
 * Dùng trong `ClientsModule.registerAsync(...)`.
 */
export function rmqClientOptions(queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl()],
      queue,
      // durable: queue vẫn tồn tại nếu RabbitMQ restart.
      queueOptions: { durable: true },
    },
  };
}

/**
 * Option cho phía SERVER (service nội bộ) — bên NHẬN & xử lý message.
 * Dùng trong `NestFactory.createMicroservice(Module, rmqServerOptions(queue))`.
 */
export function rmqServerOptions(queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl()],
      queue,
      queueOptions: { durable: true },
      // noAck=true: broker TỰ ack ngay khi giao message (auto-ack).
      //
      // ⚠️ Vì sao KHÔNG dùng noAck=false ở đây: noAck=false = chế độ ack THỦ CÔNG
      // — Nest KHÔNG tự ack, handler PHẢI tự gọi `channel.ack()` qua RmqContext.
      // Các handler ở đây (RPC request-response) không tự ack, nên với
      // prefetchCount=1 thì xử lý xong message ĐẦU là consumer đứng im mãi
      // (message không ack → broker không giao message kế) → mọi request sau
      // timeout 504. Với RPC, mất message chỉ khiến client timeout & thử lại nên
      // auto-ack là đủ và đúng chuẩn.
      //
      // (Nếu sau này làm EVENT quan trọng cần "at-least-once", hãy để noAck=false
      //  VÀ tự ack/nack trong từng handler bằng @Ctx() RmqContext.)
      noAck: true,
      // prefetchCount=1: mỗi lần chỉ lấy 1 message → tải đều, không nghẽn.
      prefetchCount: 1,
    },
  };
}
