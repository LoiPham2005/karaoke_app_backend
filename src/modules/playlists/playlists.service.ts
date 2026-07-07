import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePlaylistDto,
  ReorderPlaylistDto,
  UpdatePlaylistDto,
} from './dto/playlist.dto';
import { SongRefDto } from './dto/song-ref.dto';

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  /// GET /playlists — playlist của user (chưa xoá), mới cập nhật lên đầu.
  list(userId: string) {
    return this.prisma.playlist.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /// POST /playlists — tạo playlist mới cho user.
  create(userId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
      },
    });
  }

  /// GET /playlists/:id — chi tiết + items kèm thông tin bài hát.
  /// Cho xem nếu là owner HOẶC playlist công khai.
  async detail(userId: string, id: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          include: { song: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!playlist) throw new NotFoundException('Không tìm thấy playlist');
    if (playlist.userId !== userId && !playlist.isPublic) {
      throw new ForbiddenException('Bạn không có quyền xem playlist này');
    }
    return playlist;
  }

  /// PATCH /playlists/:id — cập nhật metadata (chỉ owner).
  async update(userId: string, id: string, dto: UpdatePlaylistDto) {
    await this.assertOwner(userId, id);
    return this.prisma.playlist.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
        coverUrl: dto.coverUrl,
      },
    });
  }

  /// DELETE /playlists/:id — soft delete (chỉ owner).
  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.playlist.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  /// POST /playlists/:id/songs — cache-on-write Song rồi thêm vào cuối playlist.
  /// Idempotent: nếu bài đã có (@@unique[playlistId, songId]) → trả item cũ.
  async addSong(userId: string, id: string, dto: SongRefDto) {
    await this.assertOwner(userId, id);

    const existing = await this.prisma.playlistItem.findUnique({
      where: { playlistId_songId: { playlistId: id, songId: dto.youtubeId } },
      include: { song: true },
    });
    if (existing) return existing;

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

    const last = await this.prisma.playlistItem.findFirst({
      where: { playlistId: id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    // Phòng race-condition: nếu vừa bị thêm trùng giữa chừng → trả item đã có.
    const item = await this.prisma.playlistItem.upsert({
      where: { playlistId_songId: { playlistId: id, songId: dto.youtubeId } },
      create: { playlistId: id, songId: dto.youtubeId, position },
      update: {},
      include: { song: true },
    });

    await this.touch(id);
    return item;
  }

  /// DELETE /playlists/:id/songs/:youtubeId — xoá 1 bài khỏi playlist (chỉ owner).
  async removeSong(userId: string, id: string, youtubeId: string) {
    await this.assertOwner(userId, id);
    const item = await this.prisma.playlistItem.findUnique({
      where: { playlistId_songId: { playlistId: id, songId: youtubeId } },
    });
    if (!item) throw new NotFoundException('Bài hát không có trong playlist');

    await this.prisma.playlistItem.delete({ where: { id: item.id } });
    await this.touch(id);
    return { success: true };
  }

  /// PATCH /playlists/:id/reorder — sắp xếp lại theo orderedYoutubeIds (chỉ owner).
  async reorder(userId: string, id: string, dto: ReorderPlaylistDto) {
    await this.assertOwner(userId, id);

    const items = await this.prisma.playlistItem.findMany({
      where: { playlistId: id },
      select: { songId: true },
    });
    const known = new Set(items.map((i) => i.songId));
    if (
      dto.orderedYoutubeIds.length !== items.length ||
      !dto.orderedYoutubeIds.every((sid) => known.has(sid))
    ) {
      throw new BadRequestException(
        'orderedYoutubeIds phải khớp đúng các bài hiện có trong playlist',
      );
    }

    await this.prisma.$transaction([
      ...dto.orderedYoutubeIds.map((songId, index) =>
        this.prisma.playlistItem.update({
          where: { playlistId_songId: { playlistId: id, songId } },
          data: { position: index },
        }),
      ),
      this.prisma.playlist.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return this.detail(userId, id);
  }

  /// Xác nhận playlist tồn tại (chưa xoá) và thuộc về user; ném lỗi nếu không.
  private async assertOwner(userId: string, id: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!playlist) throw new NotFoundException('Không tìm thấy playlist');
    if (playlist.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa playlist này');
    }
  }

  /// Cập nhật updatedAt để playlist nổi lên đầu danh sách sau khi đổi nội dung.
  private touch(id: string) {
    return this.prisma.playlist.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }
}
