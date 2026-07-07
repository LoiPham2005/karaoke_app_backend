import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SongRefDto } from './dto/favorites.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bài hát yêu thích' })
  list(@CurrentUser('sub') userId: string) {
    return this.favorites.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm bài hát vào yêu thích' })
  add(@CurrentUser('sub') userId: string, @Body() dto: SongRefDto) {
    return this.favorites.add(userId, dto);
  }

  @Delete(':youtubeId')
  @ApiOperation({ summary: 'Xoá bài hát khỏi yêu thích' })
  remove(@CurrentUser('sub') userId: string, @Param('youtubeId') youtubeId: string) {
    return this.favorites.remove(userId, youtubeId);
  }
}
