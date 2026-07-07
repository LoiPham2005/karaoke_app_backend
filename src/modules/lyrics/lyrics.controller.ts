import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GetLyricsDto } from './dto/get-lyrics.dto';
import { LyricsService } from './lyrics.service';

@ApiTags('lyrics')
@Controller('lyrics')
export class LyricsController {
  constructor(private readonly lyrics: LyricsService) {}

  /// GET /api/v1/lyrics?youtubeId=&title=&artist=&duration=
  /// Public — lấy lời bài (cache DB → LRCLIB). Không có lời → trả null (200).
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy lời bài hát (LRCLIB, có cache)' })
  get(@Query() dto: GetLyricsDto) {
    return this.lyrics.get(dto);
  }
}
