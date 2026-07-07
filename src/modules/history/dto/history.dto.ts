import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/// Metadata bài hát client gửi lên để cache-on-write (UPSERT Song trước khi ghi history).
/// Kèm secondsPlayed: số giây hát thực tế.
export class AddHistoryDto {
  @ApiProperty({ description: 'YouTube video id (= Song.youtubeId)', example: 'dQw4w9WgXcQ' })
  @IsString()
  @IsNotEmpty()
  youtubeId!: string;

  @ApiProperty({ description: 'Tiêu đề bài hát', example: 'Lạc Trôi - Sơn Tùng M-TP' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Nghệ sĩ', example: 'Sơn Tùng M-TP' })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({ description: 'Ảnh thumbnail' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Thời lượng (giây)', example: 252 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ description: 'Số giây hát thực tế', example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  secondsPlayed?: number;
}
