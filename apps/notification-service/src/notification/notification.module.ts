import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';

/**
 * MailService được inject từ MailModule (@Global ở root) nên không cần khai lại.
 * Chỉ đăng ký controller chứa các @EventPattern handler.
 */
@Module({
  controllers: [NotificationController],
})
export class NotificationModule {}
