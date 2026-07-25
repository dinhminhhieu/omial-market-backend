import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware log request ở tầng sớm nhất (trước guards/interceptors).
 * Ghi lại method, url, status, thời gian và độ dài response.
 *
 * Áp dụng theo route trong module (Express 5: wildcard phải đặt tên, vd
 * `'{*splat}'`, hoặc scope theo controller cho an toàn):
 * ```ts
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(LoggerMiddleware).forRoutes(SomeController);
 *     // hoặc: .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
 *   }
 * }
 * ```
 * Hoặc global qua `app.use(loggerMiddleware)` (bản function bên dưới) —
 * đây là cách `setupApp()` đang dùng vì không phụ thuộc path-to-regexp.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Request');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startedAt = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') ?? '0';
      const ms = Date.now() - startedAt;
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength}b +${ms}ms`,
      );
    });

    next();
  }
}

/**
 * Phiên bản functional middleware — dùng khi muốn `app.use(loggerMiddleware)`
 * ở `main.ts` mà không cần DI.
 */
export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const logger = new Logger('Request');
  const { method, originalUrl } = req;
  const startedAt = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    logger.log(`${method} ${originalUrl} ${res.statusCode} +${ms}ms`);
  });

  next();
}
