import {
  NOTIFICATION_PATTERNS,
  OtpPurpose,
  OtpRequestedEvent,
} from '@app/event-contracts';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mail: { sendOtpEmail: jest.Mock };
  let prisma: { processedEvent: { create: jest.Mock } };

  const eventPayload: OtpRequestedEvent = {
    eventId: 'evt-123',
    occurredAt: new Date().toISOString(),
    email: 'user@example.com',
    otp: '123456',
    purpose: OtpPurpose.VERIFY,
    expiresInMinutes: 5,
  };

  beforeEach(() => {
    mail = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      processedEvent: {
        create: jest.fn().mockResolvedValue({
          eventId: eventPayload.eventId,
          pattern: NOTIFICATION_PATTERNS.OTP_REQUESTED,
          processedAt: new Date(),
        }),
      },
    };
    controller = new NotificationController(mail as any, prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lần đầu nhận event -> lưu processedEvent và gửi mail', async () => {
    await controller.handleOtpRequested(eventPayload);

    expect(prisma.processedEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt-123',
        pattern: NOTIFICATION_PATTERNS.OTP_REQUESTED,
      },
    });
    expect(mail.sendOtpEmail).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
      OtpPurpose.VERIFY,
      5,
    );
  });

  it('nhận event trùng (P2002) -> bỏ qua êm, không gửi mail lần 2, không throw error', async () => {
    const errorP2002 = new Error('Unique constraint failed') as any;
    errorP2002.code = 'P2002';
    prisma.processedEvent.create.mockRejectedValue(errorP2002);

    await expect(
      controller.handleOtpRequested(eventPayload),
    ).resolves.toBeUndefined();

    expect(prisma.processedEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt-123',
        pattern: NOTIFICATION_PATTERNS.OTP_REQUESTED,
      },
    });
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  it('lỗi DB khác P2002 -> throw error lên', async () => {
    const dbError = new Error('Database connection failed');
    prisma.processedEvent.create.mockRejectedValue(dbError);

    await expect(controller.handleOtpRequested(eventPayload)).rejects.toThrow(
      'Database connection failed',
    );
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });
});
