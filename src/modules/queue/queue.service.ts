import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { SongRefDto } from './dto/song-ref.dto';

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  /// GET /queue — hàng chờ cá nhân của user, theo position tăng dần.
  /// Lấy thông tin bài hát qua 1 query Song riêng rồi ghép map (theo songId).
  async list(userId: string) {
    const items = await this.prisma.queueItem.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });
    if (items.length === 0) return [];

    const songs = await this.prisma.song.findMany({
      where: { youtubeId: { in: items.map((i) => i.songId) } },
    });
    const songById = new Map(songs.map((s) => [s.youtubeId, s]));

    return items.map((item) => ({
      ...item,
      song: songById.get(item.songId) ?? null,
    }));
  }

  /// POST /queue — cache-on-write Song rồi thêm vào cuối hàng chờ.
  async add(userId: string, dto: SongRefDto) {
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

    const last = await this.prisma.queueItem.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const item = await this.prisma.queueItem.create({
      data: { userId, songId: dto.youtubeId, position },
    });
    const song = await this.prisma.song.findUnique({
      where: { youtubeId: dto.youtubeId },
    });
    return { ...item, song };
  }

  /// DELETE /queue/:id — xoá 1 item (chỉ của chính user).
  async remove(userId: string, id: string) {
    const item = await this.prisma.queueItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Không tìm thấy item trong hàng chờ');
    }
    await this.prisma.queueItem.delete({ where: { id } });
    return { success: true };
  }

  /// DELETE /queue — xoá toàn bộ hàng chờ của user.
  async clear(userId: string) {
    await this.prisma.queueItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  /// PATCH /queue/reorder — sắp xếp lại theo orderedItemIds (transaction).
  async reorder(userId: string, dto: ReorderQueueDto) {
    const items = await this.prisma.queueItem.findMany({
      where: { userId },
      select: { id: true },
    });
    const known = new Set(items.map((i) => i.id));
    if (
      dto.orderedItemIds.length !== items.length ||
      !dto.orderedItemIds.every((itemId) => known.has(itemId))
    ) {
      throw new BadRequestException(
        'orderedItemIds phải khớp đúng các item hiện có trong hàng chờ',
      );
    }

    await this.prisma.$transaction(
      dto.orderedItemIds.map((id, index) =>
        this.prisma.queueItem.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return this.list(userId);
  }
}
