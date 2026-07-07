import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { GetLyricsDto } from './dto/get-lyrics.dto';

/// Shape trả về cho client. lrcContent = LRC (synced) hoặc plain text; null nếu
/// không tìm được lời.
export interface LyricsResult {
  lrcContent: string | null;
  source: string | null;
  language: string | null;
}

interface LrclibTrack {
  id?: number;
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  lang?: string | null;
  instrumental?: boolean;
}

@Injectable()
export class LyricsService {
  private readonly logger = new Logger(LyricsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('lrclib.apiUrl') ?? 'https://lrclib.net/api'
    );
  }

  /// Lấy lời bài hát. Ưu tiên cache DB (theo youtubeId) → LRCLIB get → LRCLIB
  /// search. Không tìm được → trả {lrcContent:null,...} với HTTP 200.
  async get(dto: GetLyricsDto): Promise<LyricsResult> {
    // 1) Cache theo songId (= youtubeId) nếu client gửi youtubeId.
    if (dto.youtubeId) {
      const cached = await this.findCached(dto.youtubeId);
      if (cached) {
        return {
          lrcContent: cached.lrcContent,
          source: cached.source,
          language: cached.language,
        };
      }
    }

    // 2) Gọi LRCLIB (get → fallback search).
    const track = await this.fetchFromLrclib(dto);
    const lrc = track ? (track.syncedLyrics || track.plainLyrics || null) : null;

    if (!track || !lrc) {
      return { lrcContent: null, source: null, language: null };
    }

    const language = track.lang ?? null;

    // 3) Lưu cache nếu bài đã có trong bảng Song (FK). Best-effort.
    if (dto.youtubeId) {
      await this.saveCache(dto.youtubeId, lrc, language);
    }

    return { lrcContent: lrc, source: 'lrclib', language };
  }

  private async findCached(songId: string) {
    try {
      return await this.prisma.lyrics.findUnique({ where: { songId } });
    } catch {
      // DB chưa sẵn sàng → coi như không có cache, đi tiếp LRCLIB.
      return null;
    }
  }

  /// Lưu Lyrics (upsert theo songId) + set Song.hasLyrics=true. Nếu Song chưa
  /// cache (FK fail) hoặc DB lỗi → bỏ qua, KHÔNG throw.
  private async saveCache(songId: string, lrc: string, language: string | null) {
    try {
      await this.prisma.lyrics.upsert({
        where: { songId },
        create: {
          songId,
          lrcContent: lrc,
          source: 'lrclib',
          language,
        },
        update: {
          lrcContent: lrc,
          source: 'lrclib',
          language,
        },
      });
      await this.prisma.song.update({
        where: { youtubeId: songId },
        data: { hasLyrics: true },
      });
    } catch (err) {
      // FK fail (Song chưa cache) / DB lỗi → vẫn trả lyrics cho client.
      this.logger.warn(
        `Bỏ qua lưu lyrics cho songId=${songId}: ${(err as Error).message}`,
      );
    }
  }

  /// LRCLIB get → nếu không có thì search. Trả track đầu tiên hoặc null.
  private async fetchFromLrclib(dto: GetLyricsDto): Promise<LrclibTrack | null> {
    // a) /get — khớp chính xác theo track + artist (+ duration nếu có).
    if (dto.artist) {
      try {
        const params: Record<string, string | number> = {
          track_name: dto.title,
          artist_name: dto.artist,
        };
        if (dto.duration) params.duration = dto.duration;
        const res = await axios.get<LrclibTrack>(`${this.baseUrl}/get`, {
          params,
          timeout: 10000,
        });
        if (res.data && (res.data.syncedLyrics || res.data.plainLyrics)) {
          return res.data;
        }
      } catch (err) {
        // 404 = không khớp → fallback search. Lỗi khác cũng fallback.
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        if (status !== 404) {
          this.logger.warn(`LRCLIB /get lỗi (status=${status}): ${err}`);
        }
      }
    }

    // b) /search — best-effort, lấy kết quả đầu.
    try {
      const q = [dto.title, dto.artist].filter(Boolean).join(' ');
      const res = await axios.get<LrclibTrack[]>(`${this.baseUrl}/search`, {
        params: { q },
        timeout: 10000,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const first = list.find((t) => t.syncedLyrics || t.plainLyrics);
      return first ?? null;
    } catch (err) {
      this.logger.warn(`LRCLIB /search lỗi: ${err}`);
      return null;
    }
  }
}
