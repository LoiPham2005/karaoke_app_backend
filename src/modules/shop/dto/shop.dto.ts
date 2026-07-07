import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderStatus,
  ProductCategory,
  RoomQueueStatus,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Shop ──
export class UpdateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

// ── Rooms ──
export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Mã ngắn, unique trong 1 tiệm' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: 'VIP | Standard...' })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiProperty({ description: 'Giá theo giờ (VND)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hourlyPrice!: number;
}

export class UpdateRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hourlyPrice?: number;
}

// ── Staff ──
export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Mật khẩu (sẽ được hash argon2)' })
  @IsString()
  password!: string;
}

export class UpdateStaffDto {
  @ApiProperty({ enum: UserStatus, description: 'Khoá/mở nhân viên' })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

// ── Products ──
export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Giá (VND)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

// ── Sessions ──
export class ListSessionsDto {
  @ApiPropertyOptional({ enum: SessionStatus, default: SessionStatus.OPEN })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}

export class OpenSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guestCount?: number;

  @ApiPropertyOptional({
    description: 'Số phút khách đặt trước (vd 120 = 2h). Bỏ trống = mở tính giờ sau.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedMinutes?: number;
}

export class ExtendSessionDto {
  @ApiProperty({ description: 'Số phút gia hạn thêm (vd 60 = +1h)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutes!: number;
}

// ── Room queue ──
export class AddQueueItemDto {
  @ApiProperty()
  @IsString()
  songYoutubeId!: string;

  @ApiProperty()
  @IsString()
  songTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  songThumbnail?: string;
}

export class UpdateQueueItemDto {
  @ApiProperty({ enum: RoomQueueStatus })
  @IsEnum(RoomQueueStatus)
  status!: RoomQueueStatus;
}

// ── Orders ──
export class CreateOrderItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateOrderDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class ListOrdersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}
