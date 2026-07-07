import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderQueueDto {
  @ApiProperty({
    description: 'Danh sách id của QueueItem theo thứ tự mong muốn',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedItemIds!: string[];
}
