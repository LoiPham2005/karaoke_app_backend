import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class GetLyricsDto {
  @ApiPropertyOptional({
    description: 'YouTube id của bài (để cache theo songId)',
    example: 'kJQP7kiw5Fk',
  })
  @IsOptional()
  @IsString()
  youtubeId?: string;

  @ApiProperty({ description: 'Tên bài hát', example: 'Despacito' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Tên ca sĩ', example: 'Luis Fonsi' })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({ description: 'Thời lượng bài hát (giây)', example: 281 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;
}
