import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Người dùng báo lỗi 1 bài. Cache-on-write: UPSERT Song trước (vì
  /// SongReport.songId là FK tới Song.youtubeId), rồi tạo SongReport (PENDING).
  async create(userId: string, dto: CreateReportDto) {
    await this.upsertSong(dto);
    return this.prisma.songReport.create({
      data: {
        userId,
        songId: dto.youtubeId,
        reason: dto.reason,
        detail: dto.detail ?? null,
      },
    });
  }

  private async upsertSong(dto: CreateReportDto) {
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
