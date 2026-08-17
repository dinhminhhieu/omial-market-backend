// Constants & interfaces
export * from './constants/metadata.constants';
export * from './interfaces/api-response.interface';

// Decorators
export * from './decorators/public.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/api-response.decorator';
export * from './decorators/skip-response-wrap.decorator';

// DTOs
export * from './dto/pagination-query.dto';
export * from './dto/pagination-meta.dto';
export * from './dto/api-response.dto';

// Filters
export * from './filters/all-exceptions.filter';

// Utils
export * from './utils/user-role.util';

// Guards
export * from './guards/roles.guard';
export * from './guards/jwt-auth.guard';
export * from './guards/internal-auth.guard';

// Interceptors
export * from './interceptors/logging.interceptor';
export * from './interceptors/response.interceptor';
export * from './interceptors/timeout.interceptor';

// Middleware
export * from './middleware/logger.middleware';

// Pipes
export * from './pipes/parse-positive-int.pipe';
export * from './pipes/validation-pipe.factory';

// Config (RabbitMQ transport options & Pino Logger)
export * from './config/rmq.options';
export * from './logger/logger.config';

// RMQ (helper gọi RPC từ gateway: timeout + map lỗi → HttpException)
export * from './rmq/rmq-forwarder';

// Redis (wrapper ioredis dùng chung — opt-in qua RedisModule.forRoot)
export * from './redis/redis.service';
export * from './redis/redis.module';

// Module & bootstrap
export * from './common.module';
export * from './bootstrap/setup-app';
export * from './bootstrap/setup-swagger';
export * from './bootstrap/setup-microservice';
