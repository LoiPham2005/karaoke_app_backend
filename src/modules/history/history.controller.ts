import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddHistoryDto } from './dto/history.dto';
import { HistoryService } from './history.service';

@ApiTags('history')
@ApiBearerAuth()
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch sử phát (tối đa 100)' })
  list(@CurrentUser('sub') userId: string) {
    return this.history.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Ghi 1 lượt phát vào lịch sử' })
  add(@CurrentUser('sub') userId: string, @Body() dto: AddHistoryDto) {
    return this.history.add(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Xoá toàn bộ lịch sử' })
  clear(@CurrentUser('sub') userId: string) {
    return this.history.clear(userId);
  }
}
