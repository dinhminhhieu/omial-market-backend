import { RmqOptions, Transport } from '@nestjs/microservices';
import { INTERNAL_TOKEN_HEADER } from '../constants/metadata.constants';

function rabbitmqUrl(): string {
  return process.env.RABBITMQ_URL ?? '';
}

/**
 * Option cho phía CLIENT (api-gateway + service gọi service) — bên GỬI message.
 * Dùng trong `ClientsModule.registerAsync(...)`.
 *
 * `headers` được gắn vào MỌI message đi ra: mang shared secret để bên nhận
 * (`InternalAuthGuard`) biết message đến từ nguồn tin cậy chứ không phải ai đó
 * publish thẳng vào queue. Để trong header thay vì payload vì payload có thể là
 * string thuần (vd `send(FIND_ONE, id)`) và không được làm bẩn DTO.
 */
export function rmqClientOptions(queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl()],
      queue,
      // durable: queue vẫn tồn tại nếu RabbitMQ restart.
      queueOptions: { durable: true },
      headers: {
        [INTERNAL_TOKEN_HEADER]: process.env.INTERNAL_SERVICE_TOKEN ?? '',
      },
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
