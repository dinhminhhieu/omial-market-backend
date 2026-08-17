import { Module } from '@nestjs/common';
import { buildLoggerOptions, CommonModule, RedisModule } from '@app/shared';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';

/**
 * Module gốc của auth-service.
 * - CommonModule: filter + interceptor dùng chung (đã lo cả context RPC).
 * - RedisModule.forRoot: Redis dùng chung (libs/shared). `keyPrefix: 'auth:'`
 *   để key auth không đụng key of service khác nếu chung 1 Redis server.
 * - AuthModule: nghiệp vụ auth (login, register + OTP, refresh, quên mật khẩu…).
 *
 * Gửi email ĐÃ CHUYỂN sang notification-service (Phase 2): auth chỉ PHÁT event
 * `otp.requested`, không còn giữ MailModule/nodemailer.
 */
@Module({
  imports: [
    CommonModule,
    RedisModule.forRoot({ keyPrefix: 'auth:' }),
    AuthModule,
    LoggerModule.forRoot(buildLoggerOptions('auth-service')),
  ],
})
export class AuthServiceModule {}
