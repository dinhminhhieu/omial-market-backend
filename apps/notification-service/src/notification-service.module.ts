import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, CommonModule } from '@app/shared';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { NotificationModule } from './notification/notification.module';

/**
 * Module gốc của notification-service.
 * - CommonModule: filter + interceptor + InternalAuthGuard (chặn event giả mạo
 *   không mang x-internal-token — kẻ xấu không tự bơm event gửi spam được).
 * - MailModule (@Global): MailService gửi email (chuyển từ auth-service sang).
 * - PrismaModule: DB riêng `omial_notification_db` (:5438) — giữ bảng
 *   `ProcessedEvent` cho idempotency (7.4).
 * - NotificationModule: các handler @EventPattern nghe event.
 */
@Module({
  imports: [
    CommonModule,
    LoggerModule.forRoot(buildLoggerOptions('notification-service')),
    PrismaModule,
    MailModule,
    NotificationModule,
  ],
})
export class NotificationServiceModule {}
