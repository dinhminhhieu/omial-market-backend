// Message patterns (khoá định danh cho send/emit)
export * from './patterns/auth.patterns';

// Enums dùng chung
export * from './enums/otp-purpose.enum';

// DTOs (payload + response, dùng chung gateway ↔ service)
export * from './dto/auth/req/login.dto';
export * from './dto/auth/res/login-response.dto';
export * from './dto/auth/req/register.dto';
export * from './dto/auth/req/verify-otp.dto';
export * from './dto/auth/req/resend-otp.dto';
export * from './dto/auth/req/forgot-password.dto';
export * from './dto/auth/req/reset-password.dto';
export * from './dto/auth/req/refresh-token.dto';
export * from './dto/auth/req/logout.dto';
export * from './dto/auth/req/auth-tokens.dto';
export * from './dto/auth/res/message-response.dto';
