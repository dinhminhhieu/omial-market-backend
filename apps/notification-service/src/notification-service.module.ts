import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, CommonModule } from '@app/shared';
import { MailModule } from './mail/mail.module';
import { NotificationModule } from './notification/notification.module';

/**
 * Module gốc của notification-service.
 * - CommonModule: filter + interceptor + InternalAuthGuard (chặn event giả mạo
 *   không mang x-internal-token — kẻ xấu không tự bơm event gửi spam được).
 * - MailModule (@Global): MailService gửi email (chuyển từ auth-service sang).
 * - NotificationModule: các handler @EventPattern nghe event.
 *
 * KHÔNG có PrismaModule — service này chưa có DB riêng (sẽ thêm ở 7.4 cho bảng
 * processed_event phục vụ idempotency).
 */
@Module({
  imports: [
    CommonModule,
    LoggerModule.forRoot(buildLoggerOptions('notification-service')),
    MailModule,
    NotificationModule,
  ],
})
export class NotificationServiceModule {}
