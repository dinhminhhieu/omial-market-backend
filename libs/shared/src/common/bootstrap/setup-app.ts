import { INestApplication, ValidationPipeOptions } from '@nestjs/common';
import { createValidationPipe } from '../pipes/validation-pipe.factory';
import { loggerMiddleware } from '../middleware/logger.middleware';
import { setupSwagger, SwaggerOptions } from './setup-swagger';

export interface SetupAppOptions {
  /** Prefix cho toàn bộ route HTTP. Mặc định `api`. Truyền `null` để tắt. */
  globalPrefix?: string | null;
  /** Bật CORS. Mặc định `true`. */
  cors?: boolean;
  /** Bật HTTP logger middleware ở tầng sớm nhất. Mặc định `true`. */
  httpLogger?: boolean;
  /** Ghi đè option cho global ValidationPipe. */
  validation?: ValidationPipeOptions;
  /** Cấu hình Swagger UI. Truyền `false` để tắt hẳn. Mặc định bật ở `/docs`. */
  swagger?: SwaggerOptions | false;
}

/**
 * Cấu hình chung cho mọi HTTP app trong monorepo — gọi 1 dòng ở `main.ts`:
 * ```ts
 * const app = await NestFactory.create(AppModule);
 * await setupApp(app);
 * await app.listen(port);
 * ```
 *
 * Áp global: prefix, CORS, ValidationPipe, HTTP logger, Swagger UI (`/docs`),
 * graceful shutdown. Filter + interceptor được đăng ký qua `CommonModule`
 * (import trong AppModule) để tận dụng DI.
 */
export function setupApp(
  app: INestApplication,
  options: SetupAppOptions = {},
): INestApplication {
  const {
    globalPrefix = 'api',
    cors = true,
    httpLogger = true,
    validation,
    swagger,
  } = options;

  if (httpLogger) {
    app.use(loggerMiddleware);
  }

  if (cors) {
    app.enableCors();
  }

  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  app.useGlobalPipes(createValidationPipe(validation));

  if (swagger !== false) {
    setupSwagger(app, swagger ?? {});
  }

  app.enableShutdownHooks();

  return app;
}
