import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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
import { NOTIFICATION_CLIENT } from '../clients';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly token: TokenService,
    // ClientProxy để PHÁT event (thay cho gọi MailService trực tiếp).
    @Inject(NOTIFICATION_CLIENT)
    private readonly notificationClient: ClientProxy,
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
    await this.prisma.user.upsert({
      where: { email: dto.email },
      update: { password: hashed, fullName: dto.fullName },
      create: { email: dto.email, password: hashed, fullName: dto.fullName },
    });

    await this.sendOtp(dto.email, OtpPurpose.VERIFY);
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
      await this.sendOtp(dto.email, purpose);
    } else if (user) {
      // RESET: chỉ gửi khi user tồn tại, nhưng luôn trả cùng 1 thông báo
      // (chống dò email).
      await this.sendOtp(dto.email, purpose);
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
      await this.sendOtp(dto.email, OtpPurpose.RESET_PASSWORD);
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
   * Sinh OTP rồi PHÁT event `otp.requested` (dùng chung cho register/verify/
   * forgot/resend). auth vẫn sở hữu vòng đời OTP (sinh mã + lưu Redis); việc
   * GỬI email đã tách sang notification-service.
   */
  private async sendOtp(email: string, purpose: OtpPurpose): Promise<void> {
    const { code, expiresInMinutes } = await this.otp.createOtp(email, purpose);

    const event: OtpRequestedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      email,
      otp: code,
      purpose,
      expiresInMinutes,
    };

    // emit = "phát loa rồi quên": KHÔNG await SMTP, KHÔNG chờ ai xử lý.
    // `.subscribe()` để publish thực sự chạy (emit trả Observable lạnh — không
    // subscribe thì không gửi gì cả). Lỗi publish (broker sập) chỉ được LOG:
    //   ⚠️ nếu broker sập giữa "đã tạo OTP" và "publish" → event MẤT, user không
    //   nhận mail. Đây đúng lỗ hổng mà Outbox (7.3) sẽ vá. Bước 7.2 chấp nhận.
    this.notificationClient
      .emit(NOTIFICATION_PATTERNS.OTP_REQUESTED, event)
      .subscribe({
        error: (err) =>
          this.logger.error(
            `Phát event otp.requested thất bại cho ${email}: ${
              (err as Error).message
            }`,
          ),
      });
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
