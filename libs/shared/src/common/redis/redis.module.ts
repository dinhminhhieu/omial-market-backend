import { DynamicModule, Module } from '@nestjs/common';
import {
  RedisModuleOptions,
  RedisService,
  REDIS_OPTIONS,
} from './redis.service';

@Module({})
export class RedisModule {
  static forRoot(options: RedisModuleOptions = {}): DynamicModule {
    return {
      module: RedisModule,
      global: true,
      providers: [{ provide: REDIS_OPTIONS, useValue: options }, RedisService],
      exports: [RedisService],
    };
  }
}
