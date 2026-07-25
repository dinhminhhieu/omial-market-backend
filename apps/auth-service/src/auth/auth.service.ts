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
  OtpPurpose,
  RefreshTokenDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from '@app/event-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { MailService } from '../mail/mail.service';

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
    private readonly mail: MailService,
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
    return {
      message: 'Đăng ký thành công. Mã OTP đã được gửi tới email để xác thực.',
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

  /** Sinh OTP rồi gửi mail (dùng chung cho register/verify/forgot/resend). */
  private async sendOtp(email: string, purpose: OtpPurpose): Promise<void> {
    const { code, expiresInMinutes } = await this.otp.createOtp(email, purpose);
    await this.mail.sendOtpEmail(email, code, purpose, expiresInMinutes);
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
