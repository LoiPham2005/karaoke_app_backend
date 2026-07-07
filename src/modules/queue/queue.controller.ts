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
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { SongRefDto } from './dto/song-ref.dto';
import { QueueService } from './queue.service';

@ApiTags('queue')
@ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get()
  @ApiOperation({ summary: 'Hàng chờ cá nhân của tôi' })
  list(@CurrentUser('sub') userId: string) {
    return this.queue.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm bài vào cuối hàng chờ' })
  add(@CurrentUser('sub') userId: string, @Body() dto: SongRefDto) {
    return this.queue.add(userId, dto);
  }

  // Khai báo TRƯỚC route ':id' để 'reorder' không bị nhận nhầm thành id.
  @Patch('reorder')
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự hàng chờ' })
  reorder(@CurrentUser('sub') userId: string, @Body() dto: ReorderQueueDto) {
    return this.queue.reorder(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Xoá toàn bộ hàng chờ' })
  clear(@CurrentUser('sub') userId: string) {
    return this.queue.clear(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá 1 item khỏi hàng chờ' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.queue.remove(userId, id);
  }
}
