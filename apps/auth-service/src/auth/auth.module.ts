import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule, // cung cấp PrismaService để query User
    // registerAsync + useFactory: đọc env lúc DI chạy (sau khi dotenv đã nạp),
    // KHÔNG đọc lúc import module (khi đó process.env chưa có JWT_SECRET).
    // Đây là cấu hình cho ACCESS token. Refresh token dùng secret/hạn riêng,
    // TokenService tự truyền khi ký (xem token.service.ts).
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // expiresIn tính bằng giây (number). Access token nên ngắn (mặc định 15p)
        // vì đã có refresh token gia hạn.
        signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 900) },
      }),
    }),
    // RedisModule + MailModule là @Global (import ở root module) nên inject được
    // RedisService/MailService ở đây mà không cần khai báo lại.
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
})
export class AuthModule {}
