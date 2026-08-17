import { Global, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { rmqClientOptions } from '@app/shared';
import { NOTIFICATION_CLIENT } from '../clients';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';

/**
 * Outbox (7.3): gom cả phần GHI (OutboxService) lẫn phần PHÁT (OutboxWorker).
 *
 * ClientProxy RMQ chuyển từ AuthModule về đây, vì sau khi có outbox thì
 * **chỉ worker mới được publish** — nghiệp vụ không còn emit trực tiếp nữa.
 * Giữ client ở AuthModule sẽ mở đường cho việc lỡ tay emit thẳng, đúng cái
 * pattern này sinh ra để chặn.
 *
 * @Global để AuthService inject OutboxService mà không phải import lại.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: NOTIFICATION_CLIENT,
        useFactory: () =>
          rmqClientOptions(
            process.env.RMQ_NOTIFICATION_QUEUE ?? 'notification_queue',
          ),
      },
    ]),
  ],
  providers: [OutboxService, OutboxWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
