import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /// 10 từ khoá gần nhất của user (mới nhất trước).
  list(userId: string) {
    return this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, query: true, createdAt: true },
    });
  }

  /// Thêm/đưa lên đầu 1 từ khoá. Dedupe qua @@unique([userId, query]);
  /// tìm lại từ khoá cũ → cập nhật createdAt = now để nó lên đầu.
  async add(userId: string, query: string) {
    const q = query.trim();
    if (!q) return { success: true };
    await this.prisma.searchHistory.upsert({
      where: { userId_query: { userId, query: q } },
      create: { userId, query: q },
      update: { createdAt: new Date() },
    });
    return { success: true };
  }

  async remove(userId: string, id: string) {
    await this.prisma.searchHistory.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async clear(userId: string) {
    await this.prisma.searchHistory.deleteMany({ where: { userId } });
    return { success: true };
  }
}
