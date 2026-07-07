import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { CheckoutDto, ShopCheckoutDto } from './dto/billing.dto';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('subscriptions/plans')
  @ApiOperation({ summary: 'Bảng giá gói Premium' })
  plans() {
    return this.billing.getPlans();
  }

  @Get('subscriptions/me')
  @ApiOperation({ summary: 'Trạng thái Premium của tôi' })
  me(@CurrentUser('sub') userId: string) {
    return this.billing.getMySubscription(userId);
  }

  @Post('subscriptions/checkout')
  @ApiOperation({ summary: 'Tạo phiên thanh toán mua Premium' })
  checkout(@CurrentUser('sub') userId: string, @Body() dto: CheckoutDto) {
    return this.billing.checkout(userId, dto);
  }

  @Post('payments/:id/confirm-mock')
  @ApiOperation({ summary: '[DEV] Giả lập cổng thanh toán thành công' })
  confirmMock(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.billing.confirmMock(userId, id);
  }

  // ─────────── B2B: thuê bao phần mềm cho tiệm (OWNER) ───────────

  @Public()
  @Get('shops/plans')
  @ApiOperation({ summary: 'Bảng giá gói phần mềm cho tiệm' })
  shopPlans() {
    return this.billing.getShopPlans();
  }

  @Roles(Role.OWNER)
  @Get('shops/subscription')
  @ApiOperation({ summary: 'Trạng thái thuê bao của tiệm tôi' })
  shopSub(@CurrentUser('sub') userId: string) {
    return this.billing.getShopSubscription(userId);
  }

  @Roles(Role.OWNER)
  @Post('shops/subscription/checkout')
  @ApiOperation({ summary: 'Tạo phiên thanh toán thuê bao tiệm' })
  shopCheckout(@CurrentUser('sub') userId: string, @Body() dto: ShopCheckoutDto) {
    return this.billing.shopCheckout(userId, dto.plan);
  }

  @Roles(Role.OWNER)
  @Post('shops/payments/:id/confirm-mock')
  @ApiOperation({ summary: '[DEV] Kích hoạt thuê bao tiệm' })
  shopConfirmMock(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.billing.shopConfirmMock(userId, id);
  }
}
