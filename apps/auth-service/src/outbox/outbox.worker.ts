import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Interval } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { NOTIFICATION_CLIENT } from '../clients';
import { OutboxEvent, OutboxStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Worker phát tin nhắn trong Outbox Pattern (roadmap 7.3).
 *
 * Nhiệm vụ:
 * 1. Chạy định kỳ (mỗi 1s) tìm các event có status = PENDING trong bảng OutboxEvent.
 * 2. Dùng raw query `SELECT ... FOR UPDATE SKIP LOCKED` trong $transaction để tránh
 *    xung đột giữa các worker instance khi scale microservice (multi-replica).
 * 3. Với mỗi event, emit qua ClientProxy và dùng `firstValueFrom` để chờ phản hồi.
 * 4. Nếu publish thành công -> đánh dấu SENT, ghi nhận publishedAt.
 * 5. Nếu publish thất bại -> tăng attempts, lưu lastError; nếu quá 5 lần -> đánh dấu FAILED.
 */
@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CLIENT) private readonly client: ClientProxy,
  ) {}

  @Interval(1000)
  async publishPending(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Query tối đa 20 dòng PENDING, cũ nhất trước (ORDER BY createdAt ASC).
        // FOR UPDATE SKIP LOCKED: khóa các dòng được chọn, replica khác chạy song song sẽ tự bỏ qua các dòng này.
        const events = await tx.$queryRaw<OutboxEvent[]>`
          SELECT * FROM "OutboxEvent"
          WHERE "status"::text = 'PENDING' AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= now())
          ORDER BY "createdAt" ASC
          LIMIT 20
          FOR UPDATE SKIP LOCKED
        `;

        if (!events || events.length === 0) {
          return;
        }

        for (const event of events) {
          try {
            const payload =
              typeof event.payload === 'string'
                ? JSON.parse(event.payload)
                : event.payload;

            // `client.emit()` trả về Observable lạnh -> dùng firstValueFrom để chờ publish hoàn thành
            await firstValueFrom(this.client.emit(event.pattern, payload));

            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: OutboxStatus.SENT,
                publishedAt: new Date(),
                lastError: null,
              },
            });
          } catch (error: any) {
            const attempts = event.attempts + 1;
            const lastError = error?.message
              ? String(error.message)
              : String(error);
            const status =
              attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING;

            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                attempts,
                lastError,
                status,
                nextRetryAt: new Date(Date.now() + 2 ** attempts * 1000),
              },
            });

            this.logger.warn(
              `Thất bại khi publish outbox event [${event.id}] (lần ${attempts}/5): ${lastError}`,
            );
          }
        }
      });
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi thực thi OutboxWorker.publishPending: ${error?.message ?? error}`,
      );
    }
  }
}
