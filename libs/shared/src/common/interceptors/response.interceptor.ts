import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponseDto } from '../dto/api-response.dto';
import { SKIP_RESPONSE_WRAP } from '../decorators/skip-response-wrap.decorator';

interface SuccessResponsePayload<T = unknown> {
  data: T;
  message?: string;
}

/**
 * Wrap mọi response thành công vào envelope `ApiSuccessResponseDto`.
 * Bypass bằng decorator `@SkipResponseWrap()` (vd cho stream/file download).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponseDto<unknown>> {
    // Chỉ áp cho HTTP — bỏ qua RPC/WS (vd message handler RabbitMQ sau này).
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<{ method: string }>();

    return next.handle().pipe(
      map((payload) => {
        const { data, message } = this.normalizePayload(payload);
        const defaultMessage = this.getDefaultMessage(request.method);

        return {
          success: true as const,
          statusCode: response.statusCode,
          ...(message || defaultMessage
            ? { message: message ?? defaultMessage }
            : {}),
          data: data ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private normalizePayload(payload: unknown): SuccessResponsePayload {
    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      'message' in payload &&
      typeof (payload as { message?: unknown }).message === 'string'
    ) {
      const { data, message } = payload as SuccessResponsePayload;
      return { data, message };
    }

    return { data: payload };
  }

  private getDefaultMessage(method: string): string | undefined {
    switch (method.toUpperCase()) {
      case 'PATCH':
      case 'PUT':
        return 'Cập nhật dữ liệu thành công';
      case 'DELETE':
        return 'Xoá dữ liệu thành công';
      default:
        return undefined;
    }
  }
}
