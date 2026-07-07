import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddSearchDto } from './dto/add-search.dto';
import { SearchHistoryService } from './search-history.service';

@ApiTags('search-history')
@ApiBearerAuth()
@Controller('search-history')
export class SearchHistoryController {
  constructor(private readonly service: SearchHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch sử tìm kiếm gần đây' })
  list(@CurrentUser('sub') userId: string) {
    return this.service.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Lưu 1 từ khoá tìm kiếm' })
  add(@CurrentUser('sub') userId: string, @Body() dto: AddSearchDto) {
    return this.service.add(userId, dto.query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá 1 mục lịch sử' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Xoá toàn bộ lịch sử tìm kiếm' })
  clear(@CurrentUser('sub') userId: string) {
    return this.service.clear(userId);
  }
}
