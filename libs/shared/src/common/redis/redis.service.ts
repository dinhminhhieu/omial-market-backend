import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

/** Token DI cho cấu hình RedisModule (url + keyPrefix). */
export const REDIS_OPTIONS = 'REDIS_OPTIONS';

export interface RedisModuleOptions {
  url?: string;
  keyPrefix?: string;
}

/**
 * Wrapper ioredis DÙNG CHUNG cho mọi service (đặt ở libs/shared). KHÔNG chứa
 * logic nghiệp vụ — OTP/token semantics nằm ở service tương ứng.
 *
 * `keyPrefix` được cộng vào key ở TẦNG NÀY (không dùng option keyPrefix gốc của
 * ioredis) để tránh cạm bẫy: ioredis sẽ prefix cả kết quả trả về của `KEYS`,
 * khiến truyền ngược vào `DEL` bị prefix 2 lần. Ở đây caller luôn thao tác trên
 * key "logic" (chưa prefix); wrapper tự thêm/bóc prefix minh bạch.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly prefix: string;

  constructor(@Inject(REDIS_OPTIONS) options: RedisModuleOptions) {
    this.prefix = options.keyPrefix ?? '';
    this.client = new Redis(
      options.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
      {
        maxRetriesPerRequest: 3,
      },
    );

    this.client.on('error', (err) =>
      this.logger.error(`Redis lỗi kết nối: ${err.message}`),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.client.ping();
    this.logger.log(
      `✅ Connected Redis${this.prefix ? ` (prefix "${this.prefix}")` : ''}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(this.k(key), value, 'EX', ttlSeconds);
    } else {
      await this.client.set(this.k(key), value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.k(key));
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys.map((key) => this.k(key)));
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(this.k(key))) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.k(key));
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(this.k(key));
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(this.k(key), ttlSeconds);
  }

  /**
   * Liệt kê key theo pattern (LOGIC, chưa prefix) rồi trả về cũng ở dạng logic
   * → truyền thẳng ngược vào `del()` an toàn.
   * LƯU Ý: `KEYS` quét toàn keyspace — chỉ ổn ở quy mô nhỏ/học tập; production
   * nên dùng `SCAN`.
   */
  async keys(pattern: string): Promise<string[]> {
    const found = await this.client.keys(this.k(pattern));
    return this.prefix
      ? found.map((key) => key.slice(this.prefix.length))
      : found;
  }

  /** Gắn prefix cho 1 key logic. */
  private k(key: string): string {
    return this.prefix + key;
  }
}
