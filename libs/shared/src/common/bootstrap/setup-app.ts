import { INestApplication, ValidationPipeOptions } from '@nestjs/common';
import helmet from 'helmet';
import { createValidationPipe } from '../pipes/validation-pipe.factory';
import { setupSwagger, SwaggerOptions } from './setup-swagger';

export interface SetupAppOptions {
  /** Prefix cho toàn bộ route HTTP. Mặc định `api`. Truyền `null` để tắt. */
  globalPrefix?: string | null;
  /** Bật CORS. Mặc định `true`. */
  cors?: boolean;
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
 * Áp global: helmet, CORS, prefix, ValidationPipe, Swagger UI (`/docs`),
 * graceful shutdown. HTTP logging do LoggerModule (nestjs-pino) tự động đảm nhận.
 */
export function setupApp(
  app: INestApplication,
  options: SetupAppOptions = {},
): INestApplication {
  const { globalPrefix = 'api', cors = true, validation, swagger } = options;

  // Security headers (CSP, HSTS, X-Frame-Options, nosniff…). Đặt SỚM NHẤT để
  // áp cho mọi response, kể cả response lỗi.
  // `contentSecurityPolicy` mặc định của helmet chặn inline script → vỡ Swagger
  // UI ở /docs, nên tắt CSP khi còn bật Swagger (dev). Production tắt Swagger
  // thì nên bật lại CSP.
  app.use(
    helmet({ contentSecurityPolicy: swagger === false ? undefined : false }),
  );

  if (cors) {
    // CORS_ORIGINS: danh sách domain FE, phân tách bằng dấu phẩy.
    // KHÔNG để `*` khi đã có auth — trình duyệt sẽ không gửi cookie/credential
    // tới origin wildcard, và `*` nghĩa là mọi trang web đều gọi API thay khách.
    const origins = process.env.CORS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: origins?.length ? origins : true, // không khai báo → cho phép mọi origin (chỉ hợp cho dev)
      credentials: true,
    });
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
