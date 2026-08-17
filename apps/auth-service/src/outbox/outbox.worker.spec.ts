import { of, throwError } from 'rxjs';
import { OutboxStatus } from '../generated/prisma/client';
import { OutboxWorker } from './outbox.worker';

describe('OutboxWorker', () => {
  let worker: OutboxWorker;
  let prisma: any;
  let client: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $queryRaw: jest.fn(),
      outboxEvent: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    client = {
      emit: jest.fn(),
    };

    worker = new OutboxWorker(prisma, client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('không có event PENDING -> không làm gì', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await worker.publishPending();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('publish thành công -> đánh dấu SENT + publishedAt', async () => {
    const event = {
      id: 'evt-1',
      pattern: 'otp.requested',
      payload: { email: 'test@example.com', otp: '123456' },
      attempts: 0,
      status: OutboxStatus.PENDING,
    };
    prisma.$queryRaw.mockResolvedValue([event]);
    client.emit.mockReturnValue(of({}));

    await worker.publishPending();

    expect(client.emit).toHaveBeenCalledWith('otp.requested', event.payload);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: OutboxStatus.SENT,
        publishedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('payload dạng string JSON -> tự parse và emit object', async () => {
    const event = {
      id: 'evt-2',
      pattern: 'otp.requested',
      payload: JSON.stringify({ email: 'test2@example.com' }),
      attempts: 0,
      status: OutboxStatus.PENDING,
    };
    prisma.$queryRaw.mockResolvedValue([event]);
    client.emit.mockReturnValue(of({}));

    await worker.publishPending();

    expect(client.emit).toHaveBeenCalledWith('otp.requested', {
      email: 'test2@example.com',
    });
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-2' },
      data: {
        status: OutboxStatus.SENT,
        publishedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('publish thất bại lần đầu (<5) -> tăng attempts, lưu lastError, giữ PENDING', async () => {
    const event = {
      id: 'evt-3',
      pattern: 'otp.requested',
      payload: { email: 'fail@example.com' },
      attempts: 0,
      status: OutboxStatus.PENDING,
    };
    prisma.$queryRaw.mockResolvedValue([event]);
    client.emit.mockReturnValue(
      throwError(() => new Error('RabbitMQ connection lost')),
    );

    await worker.publishPending();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-3' },
      data: {
        attempts: 1,
        lastError: 'RabbitMQ connection lost',
        status: OutboxStatus.PENDING,
        // Backoff: hẹn thử lại sau 2^attempts giây thay vì thử ngay tick sau.
        // Không có nó thì broker restart 10s là đốt sạch 5 lần thử trong 5 giây.
        nextRetryAt: expect.any(Date),
      },
    });
  });

  it('publish thất bại đến lần thứ 5 -> đánh dấu FAILED', async () => {
    const event = {
      id: 'evt-4',
      pattern: 'otp.requested',
      payload: { email: 'fail5@example.com' },
      attempts: 4,
      status: OutboxStatus.PENDING,
    };
    prisma.$queryRaw.mockResolvedValue([event]);
    client.emit.mockReturnValue(
      throwError(() => new Error('Persistent failure')),
    );

    await worker.publishPending();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-4' },
      data: {
        attempts: 5,
        lastError: 'Persistent failure',
        status: OutboxStatus.FAILED,
        nextRetryAt: expect.any(Date),
      },
    });
  });
});
