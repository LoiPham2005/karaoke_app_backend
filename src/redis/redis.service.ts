import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private errorLogged = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
      // KHÔNG connect lúc boot — chỉ connect khi có lệnh đầu tiên. Search không
      // dùng Redis nên sẽ im lặng tới khi thật sự cần cache.
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      // Thử lại tối đa 5 lần rồi thôi (tránh spam log khi Redis chưa dựng ở dev).
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 3000)),
    });

    this.client.on('connect', () => {
      this.errorLogged = false;
      this.logger.log('✅ Redis connected');
    });
    // Log lỗi 1 lần để khỏi spam (dev chưa có Redis vẫn chạy app, chỉ mất cache).
    this.client.on('error', (err) => {
      if (this.errorLogged) return;
      this.errorLogged = true;
      this.logger.warn(
        `⚠️ Redis chưa kết nối được (${err.message}). App vẫn chạy — chỉ mất tính năng cache.`,
      );
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async del(key: string | string[]): Promise<void> {
    await this.client.del(...(Array.isArray(key) ? key : [key]));
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async increment(key: string, by = 1): Promise<number> {
    return this.client.incrby(key, by);
  }
}
