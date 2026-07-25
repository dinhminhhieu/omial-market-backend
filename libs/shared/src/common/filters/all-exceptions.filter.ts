import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

/**
 * Lỗi truyền ngược qua RabbitMQ về gateway. Gateway sẽ đọc `statusCode` để
 * dựng lại HttpException đúng mã (vd 401 khi sai mật khẩu).
 */
export interface RpcErrorPayload {
  statusCode: number;
  message: string;
  errors: string[] | null;
}

/**
 * Filter bắt MỌI exception (cả HttpException lẫn lỗi runtime) và trả về
 * response lỗi theo format chuẩn.
 *
 * Đăng ký global qua `APP_FILTER` trong `CommonModule` nên áp cho CẢ hai loại
 * context: HTTP (gateway) và RPC (service nội bộ). Tự phân nhánh theo
 * `host.getType()` để không gọi nhầm `switchToHttp()` trong context RabbitMQ.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void | Observable<never> {
    // Context RPC (microservice nghe RabbitMQ): trả Observable lỗi để Nest
    // gửi ngược payload lỗi qua broker về gateway.
    if (host.getType<'http' | 'rpc'>() === 'rpc') {
      return this.catchRpc(exception);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.normalize(exception);

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // 5xx => lỗi hệ thống, log full stack. 4xx => chỉ log cảnh báo ngắn.
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${statusCode} - ${message}`,
      );
    }

    response.status(statusCode).json(body);
  }

  /**
   * Nhánh RPC: chuẩn hoá lỗi rồi trả Observable lỗi. Nest sẽ serialize
   * `RpcErrorPayload` và gửi ngược qua RabbitMQ về phía client (gateway).
   */
  private catchRpc(exception: unknown): Observable<never> {
    const { statusCode, message, errors } = this.normalize(exception);
    this.logger.warn(`[RPC] ${statusCode} - ${message}`);
    const payload: RpcErrorPayload = { statusCode, message, errors };
    return throwError(() => payload);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string;
    errors: string[] | null;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { statusCode, message: res, errors: null };
      }

      // res dạng object (vd ValidationPipe): { message, error, statusCode }
      const { message, error } = res as Record<string, unknown>;
      return {
        statusCode,
        message: this.resolveMessage(message ?? error, exception.message),
        // mảng message của ValidationPipe -> errors; còn lại -> null
        errors: this.toErrorList(message),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        exception instanceof Error
          ? exception.message
          : 'Internal server error',
      errors: null,
    };
  }

  private toErrorList(value: unknown): string[] | null {
    if (Array.isArray(value)) return value.map((item) => String(item));
    return null;
  }

  private resolveMessage(value: unknown, fallback: string): string {
    if (Array.isArray(value)) return value[0] ?? fallback;
    if (typeof value === 'string') return value;
    return fallback;
  }
}
