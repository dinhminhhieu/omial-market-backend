import {
  Body,
  Controller,
  HttpCode,
  HttpException,
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
  catchError,
  firstValueFrom,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';
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
import { Public, RpcErrorPayload } from '@app/shared';
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
  constructor(@Inject(AUTH_CLIENT) private readonly authClient: ClientProxy) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập, trả về access + refresh token' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.forward(AUTH_PATTERNS.LOGIN, dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký, gửi OTP xác thực về email' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  register(@Body() dto: RegisterDto): Promise<MessageResponseDto> {
    return this.forward(AUTH_PATTERNS.REGISTER, dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP đăng ký → auto login (trả token)' })
  @ApiOkResponse({ type: LoginResponseDto })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<LoginResponseDto> {
    return this.forward(AUTH_PATTERNS.VERIFY_OTP, dto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại OTP (verify đăng ký hoặc reset mật khẩu)' })
  @ApiOkResponse({ type: MessageResponseDto })
  resendOtp(@Body() dto: ResendOtpDto): Promise<MessageResponseDto> {
    return this.forward(AUTH_PATTERNS.RESEND_OTP, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quên mật khẩu → gửi OTP reset về email' })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.forward(AUTH_PATTERNS.FORGOT_PASSWORD, dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.forward(AUTH_PATTERNS.RESET_PASSWORD, dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới (rotation)' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.forward(AUTH_PATTERNS.REFRESH_TOKEN, dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất — thu hồi refresh token' })
  @ApiOkResponse({ type: MessageResponseDto })
  logout(@Body() dto: LogoutDto): Promise<MessageResponseDto> {
    return this.forward(AUTH_PATTERNS.LOGOUT, dto);
  }

  /**
   * Gửi 1 message RPC tới auth-service và chờ kết quả. Gom sẵn: timeout 5s +
   * chuyển lỗi RabbitMQ/timeout thành HttpException để filter HTTP format chuẩn.
   */
  private forward<T>(pattern: string, payload: unknown): Promise<T> {
    return firstValueFrom(
      this.authClient.send<T>(pattern, payload).pipe(
        timeout(5000),
        catchError((err) => throwError(() => this.toHttpException(err))),
      ),
    );
  }

  /** Map lỗi nhận qua RabbitMQ (hoặc timeout) thành HttpException. */
  private toHttpException(err: unknown): HttpException {
    if (err instanceof TimeoutError) {
      return new HttpException(
        'auth-service không phản hồi',
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
    const e = err as Partial<RpcErrorPayload>;
    return new HttpException(
      e?.message ?? 'Lỗi xác thực',
      e?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
