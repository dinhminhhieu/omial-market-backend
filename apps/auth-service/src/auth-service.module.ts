import { Module } from '@nestjs/common';
import { CommonModule, RedisModule } from '@app/shared';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';

/**
 * Module gốc của auth-service.
 * - CommonModule: filter + interceptor dùng chung (đã lo cả context RPC).
 * - RedisModule.forRoot: Redis dùng chung (libs/shared). `keyPrefix: 'auth:'`
 *   để key auth không đụng key của service khác nếu chung 1 Redis server.
 * - MailModule: @Global gửi OTP.
 * - AuthModule: nghiệp vụ auth (login, register + OTP, refresh, quên mật khẩu…).
 */
@Module({
  imports: [
    CommonModule,
    RedisModule.forRoot({ keyPrefix: 'auth:' }),
    MailModule,
    AuthModule,
  ],
})
export class AuthServiceModule {}
