import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/// Body báo lỗi 1 bài hát. Gồm metadata bài (cache-on-write UPSERT Song) +
/// lý do/chi tiết. songId của SongReport = youtubeId (FK tới Song.youtubeId).
export class CreateReportDto {
  @ApiProperty({ description: 'YouTube video id', example: 'dQw4w9WgXcQ' })
  @IsString()
  @IsNotEmpty()
  youtubeId!: string;

  @ApiProperty({ description: 'Tiêu đề bài hát', example: 'Lạc Trôi' })
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

  @ApiProperty({ description: 'Lý do báo lỗi', example: 'Video không phát được' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}
