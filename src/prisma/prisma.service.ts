import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Prisma connected to database');
    } catch (e) {
      // Prod: bắt buộc có DB → fail fast. Dev: cho app vẫn boot (Prisma sẽ
      // connect lazy khi có query). Nhờ vậy có thể test các endpoint KHÔNG dùng
      // DB (vd /songs/search gọi YouTube) mà chưa cần dựng Postgres.
      if (process.env.NODE_ENV === 'production') throw e;
      this.logger.warn(
        `⚠️ Chưa kết nối được Postgres (${(e as Error).message}). ` +
          'App vẫn chạy — endpoint dùng DB sẽ lỗi tới khi có DB. ' +
          'Search YouTube KHÔNG cần DB nên test được ngay.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🛑 Prisma disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() is not allowed in production');
    }
    const modelNames = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );
    return Promise.all(
      modelNames.map((modelName) => {
        const model = (this as any)[modelName];
        if (model && typeof model.deleteMany === 'function') {
          return model.deleteMany();
        }
        return null;
      }),
    );
  }
}
