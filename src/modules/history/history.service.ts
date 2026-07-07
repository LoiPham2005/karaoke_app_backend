import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddHistoryDto } from './dto/history.dto';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /// Lịch sử phát của user (kèm thông tin bài hát), mới nhất trước, tối đa 100.
  async list(userId: string) {
    return this.prisma.history.findMany({
      where: { userId },
      include: { song: true },
      orderBy: { playedAt: 'desc' },
      take: 100,
    });
  }

  /// Ghi 1 lượt phát vào lịch sử.
  /// Cache-on-write: UPSERT Song từ metadata client gửi trước khi ghi.
  /// Đồng thời tăng Song.playCountApp +1 (trending).
  async add(userId: string, dto: AddHistoryDto) {
    await this.prisma.song.upsert({
      where: { youtubeId: dto.youtubeId },
      create: {
        youtubeId: dto.youtubeId,
        title: dto.title,
        artist: dto.artist,
        thumbnailUrl: dto.thumbnailUrl,
        duration: dto.duration ?? 0,
        playCountApp: 1,
      },
      update: { playCountApp: { increment: 1 } },
    });

    return this.prisma.history.create({
      data: {
        userId,
        songId: dto.youtubeId,
        secondsPlayed: dto.secondsPlayed,
      },
      include: { song: true },
    });
  }

  /// Xoá toàn bộ lịch sử của user.
  async clear(userId: string) {
    await this.prisma.history.deleteMany({ where: { userId } });
    return { success: true };
  }
}
