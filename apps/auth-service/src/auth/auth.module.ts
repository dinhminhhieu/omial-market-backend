import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { rmqClientOptions } from '@app/shared';
import { PrismaModule } from '../prisma/prisma.module';
import { NOTIFICATION_CLIENT } from '../clients';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule, // cung cấp PrismaService để query User
    // Client để PHÁT event tới notification-service. Cùng cơ chế đăng ký như
    // gateway — rmqClientOptions tự gắn header x-internal-token vào mọi message
    // đi ra (kể cả event) nên InternalAuthGuard bên notification cho qua.
    ClientsModule.registerAsync([
      {
        name: NOTIFICATION_CLIENT,
        useFactory: () =>
          rmqClientOptions(
            process.env.RMQ_NOTIFICATION_QUEUE ?? 'notification_queue',
          ),
      },
    ]),
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
    // RedisModule là @Global (import ở root module) nên inject RedisService ở
    // đây mà không cần khai báo lại. (MailModule đã chuyển sang notification-service.)
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
})
export class AuthModule {}
