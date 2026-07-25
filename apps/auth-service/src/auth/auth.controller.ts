import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
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
import { AuthService } from './auth.service';

/**
 * Controller của pure microservice: KHÔNG có route HTTP, chỉ có `@MessagePattern`
 * — lắng nghe message theo pattern trên RabbitMQ. `@Payload()` là dữ liệu gateway
 * gửi kèm (đã deserialize JSON); ValidationPipe validate nó theo đúng DTO.
 *
 * Controller chỉ định tuyến — mọi logic nằm ở AuthService.
 */
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto): Promise<MessageResponseDto> {
    return this.authService.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_OTP)
  verifyOtp(@Payload() dto: VerifyOtpDto): Promise<LoginResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_OTP)
  resendOtp(@Payload() dto: ResendOtpDto): Promise<MessageResponseDto> {
    return this.authService.resendOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(
    @Payload() dto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH_TOKEN)
  refresh(@Payload() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() dto: LogoutDto): Promise<MessageResponseDto> {
    return this.authService.logout(dto);
  }
}
