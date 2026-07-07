import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/// Shape trả về cho client — khớp interface `Song` của frontend/mobile.
export interface SongResult {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number; // giây
  viewCount: number;
  hasLyrics: boolean;
  isKaraoke: boolean;
  category: string;
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    const key = this.config.get<string>('youtube.apiKey');
    if (!key) {
      throw new HttpException(
        'YOUTUBE_API_KEY chưa được cấu hình ở backend',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return key;
  }

  /// Search YouTube → danh sách bài (đã enrich duration + viewCount).
  async search(q: string, maxResults = 20): Promise<SongResult[]> {
    const key = this.apiKey;
    try {
      // 1) search.list — tốn 100 quota unit. videoEmbeddable=true để loại video chặn nhúng.
      const searchRes = await axios.get(`${YT_BASE}/search`, {
        params: {
          key,
          q,
          part: 'snippet',
          type: 'video',
          maxResults,
          videoEmbeddable: 'true',
          regionCode: 'VN',
          relevanceLanguage: 'vi',
          safeSearch: 'moderate',
        },
        timeout: 10000,
      });

      const items: any[] = searchRes.data.items ?? [];
      const ids = items
        .map((it) => it.id?.videoId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return [];

      // 2) videos.list — chỉ 1 unit, lấy duration + viewCount cho tất cả id.
      const detailRes = await axios.get(`${YT_BASE}/videos`, {
        params: {
          key,
          id: ids.join(','),
          part: 'contentDetails,statistics',
        },
        timeout: 10000,
      });
      const details = new Map<string, any>(
        (detailRes.data.items ?? []).map((d: any) => [d.id, d]),
      );

      return items
        .filter((it) => it.id?.videoId)
        .map((it) => {
          const id: string = it.id.videoId;
          const sn = it.snippet ?? {};
          const detail = details.get(id);
          const title = this.decodeHtml(sn.title ?? '');
          const isKaraoke = /karaoke|beat|nhạc nền|instrumental/i.test(title);
          return {
            youtubeId: id,
            title,
            artist: this.decodeHtml(sn.channelTitle ?? ''),
            thumbnailUrl:
              sn.thumbnails?.high?.url ??
              sn.thumbnails?.medium?.url ??
              sn.thumbnails?.default?.url ??
              '',
            duration: this.parseDuration(detail?.contentDetails?.duration ?? ''),
            viewCount: parseInt(detail?.statistics?.viewCount ?? '0', 10),
            hasLyrics: false,
            isKaraoke,
            category: isKaraoke ? 'karaoke' : 'music',
          } satisfies SongResult;
        });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const reason =
        axios.isAxiosError(err) &&
        err.response?.data?.error?.errors?.[0]?.reason;
      this.logger.error(
        `YouTube search failed (status=${status}, reason=${reason}): ${err}`,
      );
      if (reason === 'quotaExceeded') {
        throw new HttpException(
          'Đã hết quota YouTube API hôm nay',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        'Không gọi được YouTube API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /// Chi tiết 1 video theo id → SongResult (giống item của search). null nếu
  /// id không tồn tại / bị gỡ. Chỉ tốn 1 quota unit (videos.list).
  async getById(id: string): Promise<SongResult | null> {
    const key = this.apiKey;
    try {
      const res = await axios.get(`${YT_BASE}/videos`, {
        params: {
          key,
          id,
          part: 'snippet,contentDetails,statistics',
        },
        timeout: 10000,
      });

      const item = (res.data.items ?? [])[0];
      if (!item) return null;

      const sn = item.snippet ?? {};
      const title = this.decodeHtml(sn.title ?? '');
      const isKaraoke = /karaoke|beat|nhạc nền|instrumental/i.test(title);
      return {
        youtubeId: item.id,
        title,
        artist: this.decodeHtml(sn.channelTitle ?? ''),
        thumbnailUrl:
          sn.thumbnails?.high?.url ??
          sn.thumbnails?.medium?.url ??
          sn.thumbnails?.default?.url ??
          '',
        duration: this.parseDuration(item.contentDetails?.duration ?? ''),
        viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
        hasLyrics: false,
        isKaraoke,
        category: isKaraoke ? 'karaoke' : 'music',
      } satisfies SongResult;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const reason =
        axios.isAxiosError(err) &&
        err.response?.data?.error?.errors?.[0]?.reason;
      this.logger.error(
        `YouTube getById failed (status=${status}, reason=${reason}): ${err}`,
      );
      if (reason === 'quotaExceeded') {
        throw new HttpException(
          'Đã hết quota YouTube API hôm nay',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        'Không gọi được YouTube API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /// ISO-8601 "PT#H#M#S" → tổng số giây.
  private parseDuration(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] ?? '0', 10);
    const min = parseInt(m[2] ?? '0', 10);
    const s = parseInt(m[3] ?? '0', 10);
    return h * 3600 + min * 60 + s;
  }

  /// Giải mã vài HTML entity hay gặp trong title YouTube.
  private decodeHtml(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
