import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SongResult, YoutubeService } from './youtube.service';

@Injectable()
export class SongsService {
  constructor(
    private readonly youtube: YoutubeService,
    private readonly prisma: PrismaService,
  ) {}

  /// Tìm bài hát. Hiện uỷ quyền trực tiếp cho YouTube; sau này có thể thêm
  /// cache Redis (giảm quota) + lưu bảng Song cho trending/history.
  search(q: string, maxResults = 20): Promise<SongResult[]> {
    return this.youtube.search(q, maxResults);
  }

  /// Chi tiết 1 bài theo youtubeId. Gọi YouTube, đồng thời upsert vào bảng Song
  /// (cache) để phục vụ trending/lyrics. Trả null nếu video không tồn tại.
  async getById(youtubeId: string): Promise<SongResult | null> {
    const result = await this.youtube.getById(youtubeId);
    if (!result) return null;

    // Upsert cache — best-effort. Không để lỗi DB chặn việc trả dữ liệu.
    try {
      await this.prisma.song.upsert({
        where: { youtubeId: result.youtubeId },
        create: {
          youtubeId: result.youtubeId,
          title: result.title,
          artist: result.artist || null,
          thumbnailUrl: result.thumbnailUrl || null,
          duration: result.duration,
          viewCount: result.viewCount,
          isKaraoke: result.isKaraoke,
        },
        update: {
          title: result.title,
          artist: result.artist || null,
          thumbnailUrl: result.thumbnailUrl || null,
          duration: result.duration,
          viewCount: result.viewCount,
          isKaraoke: result.isKaraoke,
          lastCheckedAt: new Date(),
        },
      });
    } catch {
      // DB chưa sẵn sàng → vẫn trả kết quả YouTube cho client.
    }

    return result;
  }

  /// Bài hát "tương tự" theo youtubeId. YouTube Data API đã bỏ
  /// `relatedToVideoId`, nên ta lấy detail bài gốc rồi search theo nghệ sĩ
  /// (fallback: tiêu đề), loại chính bài đó ra. Tốn ~101 quota (getById + search).
  async getSimilar(youtubeId: string, limit = 10): Promise<SongResult[]> {
    const song = await this.youtube.getById(youtubeId);
    if (!song) return [];
    const q = (song.artist || song.title || '').trim();
    if (!q) return [];
    const results = await this.youtube.search(q, limit + 5);
    return results.filter((s) => s.youtubeId !== youtubeId).slice(0, limit);
  }

  /// Top bài đang hot theo playCountApp (lượt phát trong app). Lấy từ DB.
  /// DB rỗng / chưa kết nối → trả [].
  async trending(limit = 20): Promise<SongResult[]> {
    try {
      const rows = await this.prisma.song.findMany({
        where: { isAvailable: true },
        orderBy: { playCountApp: 'desc' },
        take: limit,
      });
      return rows.map((s) => this.toSongResult(s));
    } catch {
      return [];
    }
  }

  /// Bài mới được thêm vào hệ thống (Song.cachedAt mới nhất). DB rỗng → [].
  async recent(limit = 20): Promise<SongResult[]> {
    try {
      const rows = await this.prisma.song.findMany({
        where: { isAvailable: true },
        orderBy: { cachedAt: 'desc' },
        take: limit,
      });
      return rows.map((s) => this.toSongResult(s));
    } catch {
      return [];
    }
  }

  /// Map 1 row Song (DB) → SongResult (shape client). Bù null → '' cho các
  /// field bắt buộc của SongResult.
  private toSongResult(s: {
    youtubeId: string;
    title: string;
    artist: string | null;
    thumbnailUrl: string | null;
    duration: number;
    viewCount: number;
    hasLyrics: boolean;
    isKaraoke: boolean;
  }): SongResult {
    return {
      youtubeId: s.youtubeId,
      title: s.title,
      artist: s.artist ?? '',
      thumbnailUrl: s.thumbnailUrl ?? '',
      duration: s.duration,
      viewCount: s.viewCount,
      hasLyrics: s.hasLyrics,
      isKaraoke: s.isKaraoke,
      category: s.isKaraoke ? 'karaoke' : 'music',
    };
  }
}
