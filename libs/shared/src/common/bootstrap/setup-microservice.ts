import { INestMicroservice, ValidationPipeOptions } from '@nestjs/common';
import { createValidationPipe } from '../pipes/validation-pipe.factory';

/**
 * Bản "microservice" của `setupApp()` (vốn HTTP-only).
 *
 * Pure microservice KHÔNG có HTTP nên không cần: prefix, CORS, Swagger,
 * logger middleware. Chỉ cần gắn ValidationPipe để validate `@Payload()`.
 *
 * Filter (AllExceptionsFilter) và interceptor (ResponseInterceptor) đã được
 * đăng ký global qua `CommonModule` (import trong module gốc) nên tự áp cho
 * cả context RPC — không cần lặp ở đây.
 *
 * ```ts
 * const app = await NestFactory.createMicroservice(AppModule, rmqServerOptions(queue));
 * setupMicroservice(app);
 * await app.listen();
 * ```
 */
export function setupMicroservice(
  app: INestMicroservice,
  validation?: ValidationPipeOptions,
): INestMicroservice {
  app.useGlobalPipes(createValidationPipe(validation));
  app.enableShutdownHooks();
  return app;
}
