import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreatePlaylistDto,
  ReorderPlaylistDto,
  UpdatePlaylistDto,
} from './dto/playlist.dto';
import { SongRefDto } from './dto/song-ref.dto';
import { PlaylistsService } from './playlists.service';

@ApiTags('playlists')
@ApiBearerAuth()
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách playlist của tôi' })
  list(@CurrentUser('sub') userId: string) {
    return this.playlists.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo playlist mới' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreatePlaylistDto) {
    return this.playlists.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết playlist + danh sách bài' })
  detail(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.playlists.detail(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật playlist' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlists.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá playlist (soft delete)' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.playlists.remove(userId, id);
  }

  @Post(':id/songs')
  @ApiOperation({ summary: 'Thêm bài vào playlist' })
  addSong(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SongRefDto,
  ) {
    return this.playlists.addSong(userId, id, dto);
  }

  @Delete(':id/songs/:youtubeId')
  @ApiOperation({ summary: 'Xoá bài khỏi playlist' })
  removeSong(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('youtubeId') youtubeId: string,
  ) {
    return this.playlists.removeSong(userId, id, youtubeId);
  }

  @Patch(':id/reorder')
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự bài trong playlist' })
  reorder(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReorderPlaylistDto,
  ) {
    return this.playlists.reorder(userId, id, dto);
  }
}
