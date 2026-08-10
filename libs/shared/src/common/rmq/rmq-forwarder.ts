import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  catchError,
  firstValueFrom,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';
import { RpcErrorPayload } from '../filters/all-exceptions.filter';

/**
 * Helper cho gateway gọi RPC qua RabbitMQ: gom timeout + map lỗi RPC/timeout
 * thành HttpException để AllExceptionsFilter (HTTP) format envelope chuẩn.
 *
 * Mỗi controller tạo 1 instance với ClientProxy + tên service đích (hiện trong
 * message 504 khi service không phản hồi). Mọi cross-cutting concern cho call
 * RPC từ gateway (sau này: retry, circuit breaker — Phase 3) chỉ cần thêm ở đây.
 */
export class RmqForwarder {
  constructor(
    private readonly client: ClientProxy,
    private readonly serviceName: string,
    private readonly timeoutMs = 5000,
  ) {}

  send<T>(pattern: string, payload: unknown): Promise<T> {
    return firstValueFrom(
      this.client.send<T>(pattern, payload).pipe(
        timeout(this.timeoutMs),
        catchError((err) => throwError(() => this.toHttpException(err))),
      ),
    );
  }

  /** Map lỗi nhận qua RabbitMQ (hoặc timeout) thành HttpException. */
  private toHttpException(err: unknown): HttpException {
    console.error('=== RMQ FORWARDER RAW ERROR ===', err);
    if (err instanceof TimeoutError) {
      return new HttpException(
        `${this.serviceName} không phản hồi`,
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, any>;
      const statusCode =
        typeof e.statusCode === 'number'
          ? e.statusCode
          : typeof e.status === 'number'
            ? e.status
            : HttpStatus.INTERNAL_SERVER_ERROR;

      const message =
        typeof e.message === 'string'
          ? e.message
          : Array.isArray(e.message)
            ? e.message[0]
            : typeof e.error === 'string'
              ? e.error
              : 'Lỗi hệ thống';

      return new HttpException(
        { message, statusCode, errors: e.errors ?? null },
        statusCode,
      );
    }

    return new HttpException(
      typeof err === 'string' ? err : 'Lỗi hệ thống',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
