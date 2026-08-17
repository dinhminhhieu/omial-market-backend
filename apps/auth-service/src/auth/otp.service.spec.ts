import { BadRequestException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OtpPurpose } from '@app/event-contracts';
import { OtpService } from './otp.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const makeRedisMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
});

describe('OtpService', () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let service: OtpService;

  beforeEach(() => {
    redis = makeRedisMock();
    service = new OtpService(redis as any);
  });

  describe('createOtp', () => {
    it('còn cooldown → 429 kèm số giây phải đợi', async () => {
      redis.ttl.mockResolvedValue(42);

      await expect(
        service.createOtp('a@b.com', OtpPurpose.VERIFY),
      ).rejects.toThrow(/đợi 42s/);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('sinh mã 6 chữ số, lưu BẢN BĂM (không lưu mã thô) kèm TTL', async () => {
      redis.ttl.mockResolvedValue(0);

      const { code, expiresInMinutes } = await service.createOtp(
        'a@b.com',
        OtpPurpose.VERIFY,
      );

      expect(code).toMatch(/^\d{6}$/);
      expect(expiresInMinutes).toBe(5);

      const setCalls = redis.set.mock.calls;
      const codeCall = setCalls.find(
        (c) => c[0] === `otp:${OtpPurpose.VERIFY}:a@b.com`,
      );
      expect(codeCall?.[1]).toBe(sha256(code)); // băm, không phải mã thô
      expect(codeCall?.[1]).not.toBe(code);
      expect(codeCall?.[2]).toBe(300);
    });

    it('đặt cooldown + reset bộ đếm nhập sai', async () => {
      redis.ttl.mockResolvedValue(0);

      await service.createOtp('a@b.com', OtpPurpose.VERIFY);

      expect(redis.del).toHaveBeenCalledWith(
        `otp:attempts:${OtpPurpose.VERIFY}:a@b.com`,
      );
      expect(redis.set).toHaveBeenCalledWith(
        `otp:cooldown:${OtpPurpose.VERIFY}:a@b.com`,
        '1',
        60,
      );
    });

    it('key tách theo purpose (VERIFY vs RESET_PASSWORD không đụng nhau)', async () => {
      redis.ttl.mockResolvedValue(0);
      await service.createOtp('a@b.com', OtpPurpose.RESET_PASSWORD);

      expect(redis.set).toHaveBeenCalledWith(
        `otp:${OtpPurpose.RESET_PASSWORD}:a@b.com`,
        expect.any(String),
        300,
      );
    });
  });

  describe('verifyOtp', () => {
    it('không có mã trong Redis (hết hạn) → BadRequest', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.verifyOtp('a@b.com', '123456', OtpPurpose.VERIFY),
      ).rejects.toThrow(/hết hạn/);
    });

    it('mã đúng → xoá mã + bộ đếm (dùng 1 lần)', async () => {
      redis.get.mockResolvedValue(sha256('123456'));

      await expect(
        service.verifyOtp('a@b.com', '123456', OtpPurpose.VERIFY),
      ).resolves.toBeUndefined();

      expect(redis.del).toHaveBeenCalledWith(
        `otp:${OtpPurpose.VERIFY}:a@b.com`,
        `otp:attempts:${OtpPurpose.VERIFY}:a@b.com`,
      );
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('mã sai lần đầu → tăng đếm, đặt TTL cho bộ đếm, báo còn mấy lần', async () => {
      redis.get.mockResolvedValue(sha256('123456'));
      redis.incr.mockResolvedValue(1);

      await expect(
        service.verifyOtp('a@b.com', '999999', OtpPurpose.VERIFY),
      ).rejects.toThrow(/còn 4 lần thử/);

      expect(redis.expire).toHaveBeenCalledWith(
        `otp:attempts:${OtpPurpose.VERIFY}:a@b.com`,
        300,
      );
    });

    it('sai lần thứ 2 trở đi → KHÔNG đặt lại TTL (đếm hết hạn cùng mã)', async () => {
      redis.get.mockResolvedValue(sha256('123456'));
      redis.incr.mockResolvedValue(2);

      await expect(
        service.verifyOtp('a@b.com', '999999', OtpPurpose.VERIFY),
      ).rejects.toThrow(BadRequestException);
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('sai đủ 5 lần → huỷ mã + 429 bắt xin mã mới', async () => {
      redis.get.mockResolvedValue(sha256('123456'));
      redis.incr.mockResolvedValue(5);

      await expect(
        service.verifyOtp('a@b.com', '999999', OtpPurpose.VERIFY),
      ).rejects.toThrow(HttpException);
      expect(redis.del).toHaveBeenCalledWith(
        `otp:${OtpPurpose.VERIFY}:a@b.com`,
        `otp:attempts:${OtpPurpose.VERIFY}:a@b.com`,
      );
    });
  });
});
