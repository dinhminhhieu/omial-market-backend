import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AUTH_PATTERNS,
  AuthTokensDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  LogoutDto,
  MessageResponseDto,
  RefreshTokenDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from '@app/event-contracts';
import { Public, RmqForwarder } from '@app/shared';
import { Throttle } from '@nestjs/throttler';
import { AUTH_CLIENT } from '../clients';

/**
 * Gateway là app HTTP DUY NHẤT (public + Swagger). Không chứa business logic —
 * chỉ nhận REST rồi forward qua RabbitMQ tới auth-service, chờ kết quả (RPC),
 * rồi trả về. ResponseInterceptor tự bọc envelope chuẩn.
 *
 * Toàn bộ endpoint đều `@Public()` vì auth là cửa vào — chưa có token. Khi bật
 * JwtAuthGuard sau này, chỉ những route như /profile mới cần token.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly auth: RmqForwarder;

  constructor(@Inject(AUTH_CLIENT) authClient: ClientProxy) {
    this.auth = new RmqForwarder(authClient, 'auth-service');
  }

  @Public()
  // Siết riêng: chống bruteforce mật khẩu (mặc định toàn hệ là 100/phút).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập, trả về access + refresh token' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.send(AUTH_PATTERNS.LOGIN, dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký, gửi OTP xác thực về email' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  register(@Body() dto: RegisterDto): Promise<MessageResponseDto> {
    return this.auth.send(AUTH_PATTERNS.REGISTER, dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP đăng ký → auto login (trả token)' })
  @ApiOkResponse({ type: LoginResponseDto })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<LoginResponseDto> {
    return this.auth.send(AUTH_PATTERNS.VERIFY_OTP, dto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại OTP (verify đăng ký hoặc reset mật khẩu)' })
  @ApiOkResponse({ type: MessageResponseDto })
  resendOtp(@Body() dto: ResendOtpDto): Promise<MessageResponseDto> {
    return this.auth.send(AUTH_PATTERNS.RESEND_OTP, dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quên mật khẩu → gửi OTP reset về email' })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.auth.send(AUTH_PATTERNS.FORGOT_PASSWORD, dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.auth.send(AUTH_PATTERNS.RESET_PASSWORD, dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới (rotation)' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.auth.send(AUTH_PATTERNS.REFRESH_TOKEN, dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất — thu hồi refresh token' })
  @ApiOkResponse({ type: MessageResponseDto })
  logout(@Body() dto: LogoutDto): Promise<MessageResponseDto> {
    return this.auth.send(AUTH_PATTERNS.LOGOUT, dto);
  }
}
