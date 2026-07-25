import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerOptions {
  /** Bật Swagger UI. Mặc định `true`. */
  enabled?: boolean;
  /** Đường dẫn UI (độc lập với globalPrefix). Mặc định `docs` → `/docs`. */
  path?: string;
  /** Tiêu đề tài liệu. Mặc định `Omial Market API`. */
  title?: string;
  /** Mô tả. */
  description?: string;
  /** Version tài liệu. Mặc định `1.0`. */
  version?: string;
  /** Thêm nút "Authorize" Bearer JWT. Mặc định `true`. */
  bearerAuth?: boolean;
}

/**
 * Dựng Swagger UI cho một HTTP app. Quét controller + các DTO khai bằng
 * `@ApiSuccessResponse` / `@ApiPaginatedResponse` để sinh schema.
 *
 * Gọi sau khi module đã khởi tạo (thường trong `setupApp`).
 */
export function setupSwagger(
  app: INestApplication,
  options: SwaggerOptions = {},
): void {
  const {
    enabled = true,
    path = 'docs',
    title = 'Omial Market API',
    description = 'API documentation',
    version = '1.0',
    bearerAuth = true,
  } = options;

  if (!enabled) return;

  const builder = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version);

  if (bearerAuth) {
    builder.addBearerAuth();
  }

  const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
