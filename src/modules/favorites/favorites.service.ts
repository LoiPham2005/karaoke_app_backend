import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SongRefDto } from './dto/favorites.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /// Danh sách bài yêu thích của user (kèm thông tin bài hát), mới nhất trước.
  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { song: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// Thêm vào yêu thích — idempotent qua @@unique([userId, songId]).
  /// Cache-on-write: UPSERT Song từ metadata client gửi trước khi link.
  async add(userId: string, dto: SongRefDto) {
    await this.upsertSong(dto);

    return this.prisma.favorite.upsert({
      where: { userId_songId: { userId, songId: dto.youtubeId } },
      create: { userId, songId: dto.youtubeId },
      update: {},
      include: { song: true },
    });
  }

  /// Xoá khỏi yêu thích theo youtubeId.
  async remove(userId: string, youtubeId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, songId: youtubeId },
    });
    return { success: true };
  }

  private async upsertSong(dto: SongRefDto) {
    await this.prisma.song.upsert({
      where: { youtubeId: dto.youtubeId },
      create: {
        youtubeId: dto.youtubeId,
        title: dto.title,
        artist: dto.artist,
        thumbnailUrl: dto.thumbnailUrl,
        duration: dto.duration ?? 0,
      },
      update: {},
    });
  }
}
