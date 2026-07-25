import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { OtpPurpose } from '@app/event-contracts';
import { RedisService } from '@app/shared';

/**
 * Sinh / lưu / xác thực OTP bằng Redis.
 *
 * Ba lớp bảo vệ:
 *  1. TTL: mã tự hết hạn sau `OTP_TTL` giây (Redis lo, không cần cron).
 *  2. Cooldown: chặn gửi lại quá nhanh (`OTP_RESEND_COOLDOWN`) → chống spam mail.
 *  3. Giới hạn số lần nhập sai (`OTP_MAX_ATTEMPTS`) → chống dò mã (brute force).
 *
 * Mã OTP KHÔNG lưu thô — lưu bản băm SHA-256; khi verify thì băm lại rồi so
 * sánh (giống cách lưu mật khẩu). Ai đọc được Redis cũng không lấy được mã gốc.
 */
@Injectable()
export class OtpService {
  private readonly ttl = Number(process.env.OTP_TTL ?? 300); // 5 phút
  private readonly cooldown = Number(process.env.OTP_RESEND_COOLDOWN ?? 60);
  private readonly maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

  constructor(private readonly redis: RedisService) {}

  /**
   * Tạo OTP mới cho (email, purpose): kiểm tra cooldown → sinh mã 6 số → lưu
   * bản băm kèm TTL → đặt cooldown → reset bộ đếm sai. Trả về mã THÔ để gửi mail.
   */
  async createOtp(
    email: string,
    purpose: OtpPurpose,
  ): Promise<{ code: string; expiresInMinutes: number }> {
    // (2) Cooldown: nếu vừa gửi gần đây thì bắt đợi.
    const remaining = await this.redis.ttl(this.cooldownKey(email, purpose));
    if (remaining > 0) {
      throw new HttpException(
        `Vui lòng đợi ${remaining}s trước khi yêu cầu mã mới`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Sinh mã 000000–999999 (padStart để giữ cả mã có số 0 ở đầu).
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.redis.set(
      this.codeKey(email, purpose),
      this.hash(code),
      this.ttl,
    );
    await this.redis.del(this.attemptsKey(email, purpose)); // reset đếm sai
    await this.redis.set(this.cooldownKey(email, purpose), '1', this.cooldown);

    return { code, expiresInMinutes: Math.ceil(this.ttl / 60) };
  }

  /**
   * Xác thực OTP. Đúng → xoá sạch key liên quan (mã dùng 1 lần) + trả true.
   * Sai → tăng bộ đếm; vượt `maxAttempts` thì huỷ mã, bắt xin mã mới.
   */
  async verifyOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const stored = await this.redis.get(this.codeKey(email, purpose));
    if (!stored) {
      throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn');
    }

    if (this.safeEqual(this.hash(code), stored)) {
      await this.clear(email, purpose); // (mã dùng 1 lần)
      return;
    }

    // (3) Sai → đếm số lần. Bộ đếm hết hạn cùng lúc với mã.
    const attemptsKey = this.attemptsKey(email, purpose);
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) await this.redis.expire(attemptsKey, this.ttl);

    if (attempts >= this.maxAttempts) {
      await this.clear(email, purpose); // huỷ mã, buộc xin lại
      throw new HttpException(
        'Nhập sai OTP quá số lần cho phép, vui lòng yêu cầu mã mới',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new BadRequestException(
      `Mã OTP không đúng (còn ${this.maxAttempts - attempts} lần thử)`,
    );
  }

  /** Xoá mã + bộ đếm sai. Không đụng cooldown (vẫn chặn spam gửi lại). */
  private async clear(email: string, purpose: OtpPurpose): Promise<void> {
    await this.redis.del(
      this.codeKey(email, purpose),
      this.attemptsKey(email, purpose),
    );
  }

  // --- Helpers key & hash -------------------------------------------------
  private codeKey(email: string, p: OtpPurpose): string {
    return `otp:${p}:${email}`;
  }
  private attemptsKey(email: string, p: OtpPurpose): string {
    return `otp:attempts:${p}:${email}`;
  }
  private cooldownKey(email: string, p: OtpPurpose): string {
    return `otp:cooldown:${p}:${email}`;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /** So sánh hằng-thời-gian (chống timing attack). Hai chuỗi hex luôn cùng độ dài. */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
