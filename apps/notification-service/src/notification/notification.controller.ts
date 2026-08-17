import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_PATTERNS, OtpRequestedEvent } from '@app/event-contracts';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Nghe EVENT (không phải RPC).
 *
 * Khác biệt then chốt so với các controller khác:
 * - `@EventPattern` (KHÔNG phải `@MessagePattern`): handler này KHÔNG trả kết quả
 *   về cho người phát. Auth `emit` xong là quên; nó không chờ, không nhận lại gì.
 * - Vì vậy handler trả `void`. Có `return` giá trị cũng không ai nhận.
 * - Nếu handler ném lỗi: với auto-ack (noAck=true) message coi như đã xử lý xong
 *   và bị bỏ. Ở 7.5 sẽ đổi sang ack thủ công + DLQ để không mất event khi lỗi.
 */
@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  @EventPattern(NOTIFICATION_PATTERNS.OTP_REQUESTED)
  async handleOtpRequested(@Payload() event: OtpRequestedEvent): Promise<void> {
    this.logger.log(
      `Nhận event otp.requested cho ${event.email} (${event.purpose}) eventId=${event.eventId}`,
    );

    // 1. Kiểm tra Idempotency (7.4): Đánh dấu TRƯỚC, gửi SAU.
    // Dùng unique constraint (eventId String @id) của DB để check-and-set atomic.
    try {
      await this.prisma.processedEvent.create({
        data: {
          eventId: event.eventId,
          pattern: NOTIFICATION_PATTERNS.OTP_REQUESTED,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.logger.log(
          `Bỏ qua event trùng [${event.eventId}] (${NOTIFICATION_PATTERNS.OTP_REQUESTED})`,
        );
        return; // Đã xử lý -> bỏ qua êm, không throw (vẫn ack bình thường)
      }
      throw error;
    }

    // 2. Gửi mail SAU khi đánh dấu thành công
    await this.mail.sendOtpEmail(
      event.email,
      event.otp,
      event.purpose,
      event.expiresInMinutes,
    );
  }
}
