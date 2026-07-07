import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/// DTO dùng chung khi client gửi 1 bài hát để thêm vào hàng chờ.
/// Cache-on-write: service upsert vào bảng Song trước khi tạo QueueItem.
export class SongRefDto {
  @ApiProperty({ description: 'YouTube video id', example: 'dQw4w9WgXcQ' })
  @IsString()
  @IsNotEmpty()
  youtubeId!: string;

  @ApiProperty({ description: 'Tên bài hát', example: 'Lạc Trôi' })
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

  @ApiPropertyOptional({ description: 'Thời lượng (giây)', example: 215 })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}
