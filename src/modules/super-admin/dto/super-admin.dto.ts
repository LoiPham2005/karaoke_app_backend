import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, ShopStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListShopsDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên / slug' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ShopStatus })
  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CreateShopDto {
  @ApiProperty({ description: 'Tên tiệm' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Slug duy nhất' })
  @IsString()
  slug!: string;

  @ApiPropertyOptional({
    description: 'Email chủ tiệm; nếu user tồn tại → gán OWNER',
  })
  @IsOptional()
  @IsString()
  ownerEmail?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: ShopStatus,
    description: 'Duyệt: ACTIVE; Khoá: SUSPENDED',
  })
  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, description: 'Role mới (kể cả ADMIN/SUPER_ADMIN)' })
  @IsEnum(Role)
  role!: Role;
}

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Giá trị (JSON tuỳ ý: string/number/object/...)',
  })
  value!: unknown;
}

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Bật / tắt flag' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'Mô tả flag' })
  @IsOptional()
  @IsString()
  description?: string;
}
