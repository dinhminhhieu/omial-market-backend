import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * Phần GHI của Outbox pattern (roadmap 7.3).
 *
 * Thay vì `client.emit()` thẳng lên RabbitMQ (có thể mất event nếu crash),
 * nghiệp vụ gọi `enqueue()` để ghi ý định publish vào bảng `OutboxEvent`
 * — TRONG CÙNG transaction với việc nghiệp vụ. Việc publish thật do
 * `OutboxWorker` làm sau.
 *
 * ⚠️ QUAN TRỌNG: `enqueue` nhận `tx` (Prisma transaction client) chứ KHÔNG
 * tự mở transaction. Cả điểm mạnh của pattern nằm ở chỗ này: nếu service tự
 * mở transaction riêng thì lại thành dual write, y hệt bệnh cũ. Bên gọi phải
 * truyền tx của mình vào:
 *
 * ```ts
 * await this.prisma.$transaction(async (tx) => {
 *   await tx.user.upsert({ ... });          // việc nghiệp vụ
 *   await this.outbox.enqueue(tx, pattern, payload);  // ý định publish
 * });                                        // ⬅️ MỘT commit cho cả hai
 * ```
 */
@Injectable()
export class OutboxService {
  /**
   * Ghi 1 event vào hộp thư đi. Payload phải là object serialize được sang JSON
   * (đã gồm `eventId` + `occurredAt` theo envelope chuẩn ở libs/event-contracts).
   *
   * @param tx Transaction client của bên gọi — KHÔNG dùng PrismaService gốc.
   */
  async enqueue(
    tx: Prisma.TransactionClient,
    pattern: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        pattern,
        // Prisma Json field: ép kiểu vì TS không tự nhận object thường là JSON hợp lệ.
        payload: payload as Prisma.InputJsonValue,
        // status mặc định PENDING, attempts = 0 — worker lo phần còn lại.
      },
    });
  }
}
