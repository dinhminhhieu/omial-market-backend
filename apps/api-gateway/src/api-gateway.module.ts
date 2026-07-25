import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { CommonModule, rmqClientOptions } from '@app/shared';
import { AuthController } from './auth/auth.controller';
import { AUTH_CLIENT } from './clients';

@Module({
  imports: [
    CommonModule,
    // Đăng ký các "client" RabbitMQ. Mỗi client trỏ tới queue của 1 service.
    // registerAsync + useFactory: đọc env lúc DI chạy (sau khi dotenv nạp xong).
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_AUTH_QUEUE ?? 'auth_queue'),
      },
    ]),
  ],
  controllers: [AuthController],
})
export class ApiGatewayModule {}
