import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SearchSongsDto } from './dto/search-songs.dto';
import { SongsService } from './songs.service';

@ApiTags('songs')
@Controller('songs')
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  // ⚠️ THỨ TỰ ROUTE: các path tĩnh ('search', 'trending') PHẢI khai báo TRƯỚC
  // route param ':youtubeId', nếu không ':youtubeId' sẽ nuốt /songs/search,
  // /songs/trending (coi 'search'/'trending' là giá trị param).

  /// GET /api/v1/songs/search?q=&maxResults=
  /// Public — dùng ở màn search (chưa cần đăng nhập).
  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm bài hát từ YouTube' })
  search(@Query() dto: SearchSongsDto) {
    return this.songs.search(dto.q, dto.maxResults);
  }

  /// GET /api/v1/songs/trending
  /// Public — top bài theo lượt phát trong app (playCountApp).
  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Top bài hát đang hot trong app' })
  trending() {
    return this.songs.trending(20);
  }

  /// GET /api/v1/songs/recent — Public. Bài mới thêm vào hệ thống.
  @Public()
  @Get('recent')
  @ApiOperation({ summary: 'Bài hát mới thêm vào hệ thống' })
  recent() {
    return this.songs.recent(20);
  }

  /// GET /api/v1/songs/:youtubeId/similar
  /// Public — bài hát tương tự (search theo nghệ sĩ/tiêu đề). Khai báo TRƯỚC
  /// ':youtubeId' cho rõ ràng (2 segment nên không đụng nhau).
  @Public()
  @Get(':youtubeId/similar')
  @ApiOperation({ summary: 'Bài hát tương tự' })
  getSimilar(@Param('youtubeId') youtubeId: string) {
    return this.songs.getSimilar(youtubeId);
  }

  /// GET /api/v1/songs/:youtubeId
  /// Public — chi tiết 1 bài (đồng thời cache vào DB). 404 nếu không tồn tại.
  @Public()
  @Get(':youtubeId')
  @ApiOperation({ summary: 'Chi tiết 1 bài hát theo youtubeId' })
  async getById(@Param('youtubeId') youtubeId: string) {
    const song = await this.songs.getById(youtubeId);
    if (!song) {
      throw new NotFoundException('Không tìm thấy bài hát');
    }
    return song;
  }
}
