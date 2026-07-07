import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddSearchDto {
  @ApiProperty({ description: 'Từ khoá tìm kiếm', example: 'Sơn Tùng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  query!: string;
}
