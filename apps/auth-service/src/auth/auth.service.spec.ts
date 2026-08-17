import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { NOTIFICATION_PATTERNS, OtpPurpose } from '@app/event-contracts';
import { AuthService } from './auth.service';

// bcryptjs export property non-configurable → jest.spyOn ném "Cannot redefine
// property". Phải mock CẢ MODULE ngay từ đầu file (jest.mock được hoisted lên
// trước import). Băm mật khẩu chậm (~100ms/lần) nên mock cũng giúp test nhanh.
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const bcryptCompare = bcrypt.compare as unknown as jest.Mock;
const bcryptHash = bcrypt.hash as unknown as jest.Mock;

const makePrismaMock = () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  };
  // Outbox (7.3): register bọc user.upsert + outbox.enqueue trong 1 transaction.
  // Mock cho $transaction gọi thẳng callback với chính prismaMock làm tx.
  // ⚠️ Mock này KHÔNG rollback thật — muốn chứng minh atomic thật phải dùng
  // integration test (Postgres thật), xem inventory.int-spec.ts.
  prisma.$transaction = jest.fn((cb: (tx: any) => any) => cb(prisma));
  return prisma;
};

const userRow = (over: Partial<any> = {}) => ({
  id: 'u1',
  email: 'a@b.com',
  password: 'hashed',
  fullName: 'Nguyễn Văn A',
  role: 'USER',
  isEmailVerified: true,
  isVerified: true,
  isActive: true,
  isBanned: false,
  ...over,
});

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let otp: { createOtp: jest.Mock; verifyOtp: jest.Mock };
  let token: {
    issueTokens: jest.Mock;
    rotate: jest.Mock;
    revoke: jest.Mock;
    revokeAll: jest.Mock;
  };
  // Outbox thay cho ClientProxy: auth KHÔNG publish trực tiếp nữa, chỉ ghi
  // event vào hộp thư đi; OutboxWorker mới là nơi emit lên RabbitMQ.
  let outbox: { enqueue: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    otp = {
      createOtp: jest.fn().mockResolvedValue({
        code: '123456',
        expiresInMinutes: 5,
      }),
      verifyOtp: jest.fn().mockResolvedValue(undefined),
    };
    token = {
      issueTokens: jest.fn().mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      }),
      rotate: jest.fn().mockResolvedValue({ accessToken: 'at2' }),
      revoke: jest.fn(),
      revokeAll: jest.fn(),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma as any,
      otp as any,
      token as any,
      outbox as any,
    );
    bcryptCompare.mockResolvedValue(true);
    bcryptHash.mockResolvedValue('hashed-new');
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('email không tồn tại → Unauthorized (message chung, không lộ email nào có)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'p' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('sai mật khẩu → Unauthorized cùng message với email sai', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      bcryptCompare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'sai' } as any),
      ).rejects.toThrow('Email hoặc mật khẩu không đúng');
    });

    it('chưa xác thực email → Forbidden (không cấp token)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ isEmailVerified: false }),
      );

      await expect(
        service.login({ email: 'a@b.com', password: 'p' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(token.issueTokens).not.toHaveBeenCalled();
    });

    it('tài khoản bị khoá (isBanned) → Forbidden', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow({ isBanned: true }));
      await expect(
        service.login({ email: 'a@b.com', password: 'p' } as any),
      ).rejects.toThrow(/khoá/);
    });

    it('thành công → cập nhật lastLoginAt + trả token kèm user (KHÔNG có password)', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.user.update.mockResolvedValue(userRow());

      const result = await service.login({
        email: 'a@b.com',
        password: 'p',
      } as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe('at');
      expect(result.user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        role: 'USER',
        fullName: 'Nguyễn Văn A',
      });
      expect((result.user as any).password).toBeUndefined();
    });
  });

  describe('register', () => {
    it('email đã đăng ký VÀ đã verify → Conflict', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      await expect(
        service.register({ email: 'a@b.com', password: 'p' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('email tồn tại nhưng CHƯA verify → cho đăng ký lại (upsert + gửi OTP mới)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ isEmailVerified: false }),
      );

      await service.register({
        email: 'a@b.com',
        password: 'p',
        fullName: 'A',
      } as any);

      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(otp.createOtp).toHaveBeenCalledWith('a@b.com', OtpPurpose.VERIFY);
      // Thay vì gọi mail trực tiếp, giờ GHI event otp.requested vào outbox
      // (tham số đầu là tx — chứng minh nó nằm trong transaction của register).
      expect(outbox.enqueue).toHaveBeenCalledWith(
        prisma,
        NOTIFICATION_PATTERNS.OTP_REQUESTED,
        expect.objectContaining({
          email: 'a@b.com',
          otp: '123456',
          purpose: OtpPurpose.VERIFY,
          expiresInMinutes: 5,
          eventId: expect.any(String),
          occurredAt: expect.any(String),
        }),
      );
    });

    it('mật khẩu được BĂM trước khi lưu', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.register({
        email: 'new@b.com',
        password: 'plain-text',
      } as any);

      const arg = prisma.user.upsert.mock.calls[0][0];
      expect(arg.create.password).toBe('hashed-new');
      expect(arg.create.password).not.toBe('plain-text');
    });
  });

  describe('verifyOtp', () => {
    it('user không tồn tại → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyOtp({ email: 'x@y.com', otp: '1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('email đã verify trước đó → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      await expect(
        service.verifyOtp({ email: 'a@b.com', otp: '1' } as any),
      ).rejects.toThrow(/đã được xác thực/);
    });

    it('OTP đúng → bật verified + auto login (trả token)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ isEmailVerified: false }),
      );
      prisma.user.update.mockResolvedValue(userRow());

      const result = await service.verifyOtp({
        email: 'a@b.com',
        otp: '123456',
      } as any);

      expect(otp.verifyOtp).toHaveBeenCalledWith(
        'a@b.com',
        '123456',
        OtpPurpose.VERIFY,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          isEmailVerified: true,
          isVerified: true,
        }),
      });
      expect(result.accessToken).toBe('at');
    });

    it('OTP sai → không bật verified, không cấp token', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ isEmailVerified: false }),
      );
      otp.verifyOtp.mockRejectedValue(new BadRequestException('OTP sai'));

      await expect(
        service.verifyOtp({ email: 'a@b.com', otp: '000000' } as any),
      ).rejects.toThrow('OTP sai');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(token.issueTokens).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword — chống dò email (enumeration)', () => {
    it('email KHÔNG tồn tại → vẫn trả message chung, không gửi OTP', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'khong-co@b.com',
      } as any);

      expect(result.message).toMatch(/Nếu email tồn tại/);
      expect(otp.createOtp).not.toHaveBeenCalled();
    });

    it('email tồn tại → gửi OTP RESET nhưng message y hệt trường hợp trên', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      const result = await service.forgotPassword({
        email: 'a@b.com',
      } as any);

      expect(otp.createOtp).toHaveBeenCalledWith(
        'a@b.com',
        OtpPurpose.RESET_PASSWORD,
      );
      expect(result.message).toMatch(/Nếu email tồn tại/);
    });
  });

  describe('resetPassword', () => {
    it('đổi mật khẩu xong phải THU HỒI TOÀN BỘ phiên cũ', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await service.resetPassword({
        email: 'a@b.com',
        otp: '123456',
        newPassword: 'new-pass',
      } as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password: 'hashed-new' },
      });
      expect(token.revokeAll).toHaveBeenCalledWith('u1');
    });

    it('OTP sai → không đổi mật khẩu, không revoke', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      otp.verifyOtp.mockRejectedValue(new BadRequestException('OTP sai'));

      await expect(
        service.resetPassword({
          email: 'a@b.com',
          otp: '000000',
          newPassword: 'x',
        } as any),
      ).rejects.toThrow('OTP sai');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(token.revokeAll).not.toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    it('purpose VERIFY mà email đã xác thực → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      await expect(
        service.resendOtp({
          email: 'a@b.com',
          purpose: OtpPurpose.VERIFY,
        } as any),
      ).rejects.toThrow(/đã xác thực/);
    });

    it('purpose RESET mà user không tồn tại → im lặng, vẫn trả message chung', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendOtp({
        email: 'x@y.com',
        purpose: OtpPurpose.RESET_PASSWORD,
      } as any);

      expect(otp.createOtp).not.toHaveBeenCalled();
      expect(result.message).toMatch(/Đã gửi lại/);
    });
  });

  describe('logout', () => {
    it('thu hồi refresh token (idempotent)', async () => {
      const result = await service.logout({ refreshToken: 'rt' } as any);
      expect(token.revoke).toHaveBeenCalledWith('rt');
      expect(result.message).toMatch(/Đăng xuất thành công/);
    });
  });
});
