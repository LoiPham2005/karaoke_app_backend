import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ enum: ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'] })
  @IsIn(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'])
  plan!: 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';

  @ApiPropertyOptional({ enum: PaymentProvider, default: 'VNPAY' })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

export class ShopCheckoutDto {
  @ApiProperty({ enum: ['SHOP_BASIC', 'SHOP_PRO'] })
  @IsIn(['SHOP_BASIC', 'SHOP_PRO'])
  plan!: 'SHOP_BASIC' | 'SHOP_PRO';
}
