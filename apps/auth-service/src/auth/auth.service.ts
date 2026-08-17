import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  AuthTokensDto,
  AuthUserDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  LogoutDto,
  MessageResponseDto,
  NOTIFICATION_PATTERNS,
  OtpPurpose,
  OtpRequestedEvent,
  RefreshTokenDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from '@app/event-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { OutboxService } from '../outbox/outbox.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

/** Bản ghi User tối thiểu dùng để dựng AuthUserDto / ký token. */
type UserLike = {
  id: string;
  email: string | null;
  role: string | null;
  fullName: string | null;
};

const BCRYPT_ROUNDS = 10;

/**
 * Điều phối các luồng auth. Không tự bọc response (envelope do gateway lo) và
 * không đụng trực tiếp Redis/JWT — ủy thác cho OtpService & TokenService để mỗi
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly token: TokenService,
    // Ghi event vào hộp thư đi thay vì publish thẳng (7.3 Outbox).
    private readonly outbox: OutboxService,
  ) {}

  /** Đăng nhập: check mật khẩu → chặn nếu chưa verify/bị khoá → cấp token. */
  async login({ email, password }: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư và nhập OTP.',
      );
    }
    if (user.isBanned || !user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị khoá');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.token.issueTokens(user);
    return { ...tokens, user: this.toAuthUser(user) };
  }

  /**
   * Đăng ký: tạo user (isEmailVerified=false) rồi gửi OTP. Nếu email đã tồn tại
   * & đã verify → báo trùng. Nếu tồn tại nhưng CHƯA verify → cập nhật lại thông
   * tin & gửi OTP mới (cho phép đăng ký lại khi bỏ dở).
   */
  async register(dto: RegisterDto): Promise<MessageResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing?.isEmailVerified) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // ⭐ TRÁI TIM CỦA OUTBOX: tạo user + ghi event vào hộp thư đi nằm trong
    // MỘT transaction. Hai việc cùng COMMIT hoặc cùng rollback — không còn khe
    // hở "user đã tạo mà event bốc hơi" như khi publish thẳng lên RabbitMQ.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: dto.email },
        update: { password: hashed, fullName: dto.fullName },
        create: { email: dto.email, password: hashed, fullName: dto.fullName },
      });

      await this.sendOtp(tx, dto.email, OtpPurpose.VERIFY);
    });
    // "ĐANG được gửi" chứ không phải "đã gửi": từ khi tách notification-service,
    // lúc trả response mail CHƯA gửi (event vừa được phát đi). Câu chữ của luồng
    // async phải nói đúng trạng thái async — không hứa chuyện chưa xảy ra.
    // Nếu mail không tới, khách có lối thoát: POST /auth/resend-otp.
    return {
      message:
        'Đăng ký thành công. Mã OTP đang được gửi tới email — nếu chưa nhận được sau ít phút, hãy bấm "Gửi lại mã".',
    };
  }

  /** Xác thực OTP đăng ký → bật verified + auto login (trả token). */
  async verifyOtp(dto: VerifyOtpDto): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new BadRequestException('Tài khoản không tồn tại');
    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực trước đó');
    }

    await this.otp.verifyOtp(dto.email, dto.otp, OtpPurpose.VERIFY);

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        isVerified: true,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.token.issueTokens(verified);
    return { ...tokens, user: this.toAuthUser(verified) };
  }

  /** Gửi lại OTP (đăng ký hoặc reset). Cooldown được OtpService kiểm soát. */
  async resendOtp(dto: ResendOtpDto): Promise<MessageResponseDto> {
    const purpose = dto.purpose ?? OtpPurpose.VERIFY;
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (purpose === OtpPurpose.VERIFY) {
      if (!user) throw new BadRequestException('Tài khoản không tồn tại');
      if (user.isEmailVerified) {
        throw new BadRequestException('Email đã xác thực, không cần OTP');
      }
      // KHÔNG cần $transaction ở đây: luồng này chỉ ghi ĐÚNG MỘT dòng (outbox),
      // mà một INSERT tự nó đã atomic. Transaction chỉ cần khi phải buộc NHIỀU
      // lần ghi vào cùng một COMMIT (như register: user + outbox).
      // `this.prisma` truyền được vào chỗ nhận TransactionClient vì PrismaClient
      // có đủ các method đó.
      await this.sendOtp(this.prisma, dto.email, purpose);
    } else if (user) {
      // RESET: chỉ gửi khi user tồn tại, nhưng luôn trả cùng 1 thông báo
      // (chống dò email).
      await this.sendOtp(this.prisma, dto.email, purpose);
    }

    return { message: 'Đã gửi lại mã OTP (nếu đủ điều kiện).' };
  }

  /**
   * Quên mật khẩu: gửi OTP reset. LUÔN trả thông báo chung dù email có tồn tại
   * hay không → tránh lộ danh sách email đã đăng ký (email enumeration).
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (user) {
      // Chỉ ghi 1 dòng outbox → không cần transaction (xem giải thích ở resendOtp).
      await this.sendOtp(this.prisma, dto.email, OtpPurpose.RESET_PASSWORD);
    }
    return {
      message:
        'Nếu email tồn tại trong hệ thống, mã OTP đặt lại mật khẩu đã được gửi.',
    };
  }

  /** Đặt lại mật khẩu bằng OTP → đổi pass + thu hồi mọi refresh token cũ. */
  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new BadRequestException('Yêu cầu không hợp lệ');

    await this.otp.verifyOtp(dto.email, dto.otp, OtpPurpose.RESET_PASSWORD);

    const hashed = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    // Đổi mật khẩu → hạ hết phiên cũ để bắt đăng nhập lại (an toàn).
    await this.token.revokeAll(user.id);

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  /** Refresh: đổi refresh token cũ lấy cặp token mới (rotation). */
  refresh(dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.token.rotate(dto.refreshToken);
  }

  /** Đăng xuất: thu hồi refresh token. Idempotent. */
  async logout(dto: LogoutDto): Promise<MessageResponseDto> {
    await this.token.revoke(dto.refreshToken);
    return { message: 'Đăng xuất thành công.' };
  }

  // --- Helpers ------------------------------------------------------------

  /**
   * Sinh OTP rồi GHI event `otp.requested` vào outbox (dùng chung cho register/
   * verify/forgot/resend). auth vẫn sở hữu vòng đời OTP (sinh mã + lưu Redis);
   * việc GỬI email đã tách sang notification-service.
   *
   * ⚠️ KHÔNG publish thẳng lên RabbitMQ nữa (7.3 Outbox) — chỉ ghi vào bảng
   * `OutboxEvent` bằng CHÍNH `tx` mà bên gọi truyền vào, để event và việc
   * nghiệp vụ cùng nằm trong một COMMIT. `OutboxWorker` mới là nơi publish.
   *
   * THỨ TỰ có chủ đích: tạo OTP (Redis) TRƯỚC, rồi mới vào transaction.
   * - Crash sau khi ghi Redis, trước COMMIT → OTP mồ côi, TTL 5 phút tự dọn: VÔ HẠI.
   * - Nếu làm ngược (COMMIT trước, Redis sau) mà crash giữa → event mang mã OTP
   *   không tồn tại trong Redis → khách nhập đúng mã vẫn báo sai: HỎNG.
   * Nguyên tắc: việc "thừa thì vô hại" làm trước, việc "thiếu thì chết" vào transaction.
   */
  private async sendOtp(
    tx: Prisma.TransactionClient,
    email: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const { code, expiresInMinutes } = await this.otp.createOtp(email, purpose);

    const event: OtpRequestedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      email,
      otp: code,
      purpose,
      expiresInMinutes,
    };

    await this.outbox.enqueue(
      tx,
      NOTIFICATION_PATTERNS.OTP_REQUESTED,
      // Ép sang object thường: event là class instance, Prisma Json cần plain object.
      { ...event },
    );
  }

  private toAuthUser(user: UserLike): AuthUserDto {
    return {
      id: user.id,
      email: user.email ?? '',
      role: user.role ?? undefined,
      fullName: user.fullName,
    };
  }
}
