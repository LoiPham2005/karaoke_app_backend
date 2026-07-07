import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider, ShopPlan, UserPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto } from './dto/billing.dto';

interface PlanInfo {
  plan: UserPlan;
  label: string;
  priceVnd: number; // Int VND
  durationDays: number;
}

interface ShopPlanInfo {
  plan: ShopPlan;
  label: string;
  priceVnd: number;
  durationDays: number;
}

// Bảng giá phần mềm cho tiệm (B2B). Tiệm trả phí thuê bao theo tháng.
const SHOP_PLANS: Record<string, ShopPlanInfo> = {
  SHOP_BASIC: {
    plan: 'SHOP_BASIC',
    label: 'Gói Cơ bản',
    priceVnd: 299000,
    durationDays: 30,
  },
  SHOP_PRO: {
    plan: 'SHOP_PRO',
    label: 'Gói Pro',
    priceVnd: 799000,
    durationDays: 30,
  },
};

// Bảng giá gói Premium B2C (VND). Có thể chuyển sang SystemSetting sau.
const PLANS: Record<string, PlanInfo> = {
  PREMIUM_MONTHLY: {
    plan: 'PREMIUM_MONTHLY',
    label: 'Premium tháng',
    priceVnd: 49000,
    durationDays: 30,
  },
  PREMIUM_YEARLY: {
    plan: 'PREMIUM_YEARLY',
    label: 'Premium năm',
    priceVnd: 490000,
    durationDays: 365,
  },
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /// Danh sách gói (public — hiển thị bảng giá).
  getPlans() {
    return Object.values(PLANS).map((p) => ({
      plan: p.plan,
      label: p.label,
      priceVnd: p.priceVnd,
      durationDays: p.durationDays,
    }));
  }

  /// Trạng thái premium hiện tại của user.
  async getMySubscription(userId: string) {
    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: now } },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    return {
      isPremium: !!sub,
      plan: sub?.userPlan ?? null,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      autoRenew: sub?.autoRenew ?? false,
    };
  }

  /// Tạo phiên thanh toán: 1 Subscription (chờ kích hoạt) + 1 Payment PENDING.
  /// Trả payUrl. THỰC TẾ: payUrl = URL cổng VNPay/Momo (ký từ payment.id+amount).
  /// DEV: payUrl trỏ endpoint mock-confirm để test luồng end-to-end.
  async checkout(userId: string, dto: CheckoutDto) {
    const info = PLANS[dto.plan];
    if (!info) throw new BadRequestException('Gói không hợp lệ');
    const now = new Date();

    const sub = await this.prisma.subscription.create({
      data: {
        subscriberType: 'USER',
        userId,
        userPlan: info.plan,
        status: 'TRIALING', // placeholder tới khi thanh toán thành công
        currentPeriodStart: now,
        currentPeriodEnd: now,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        amount: info.priceVnd,
        currency: 'VND',
        provider: dto.provider ?? PaymentProvider.VNPAY,
        status: 'PENDING',
        userId,
        subscriptionId: sub.id,
        description: `Mua ${info.label}`,
      },
    });

    return {
      paymentId: payment.id,
      subscriptionId: sub.id,
      amount: info.priceVnd,
      plan: info.plan,
      provider: payment.provider,
      // ⚠️ DEV mock. Thực tế thay bằng URL cổng thanh toán (VNPay/Momo).
      payUrl: `/api/v1/payments/${payment.id}/confirm-mock`,
    };
  }

  /// DEV ONLY: giả lập cổng báo thành công → Payment PAID + Subscription ACTIVE
  /// + set User.isPremium + premiumUntil. Thực tế: VNPay/Momo IPN/callback thay
  /// chỗ này (verify chữ ký rồi gọi cùng logic kích hoạt).
  async confirmMock(userId: string, paymentId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('confirm-mock bị tắt ở môi trường production');
    }
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    if (!payment.subscriptionId) {
      throw new BadRequestException('Giao dịch không gắn gói');
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
    });
    if (!sub || !sub.userPlan) throw new NotFoundException('Không tìm thấy gói');

    const info = PLANS[sub.userPlan];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + info.durationDays * 24 * 3600 * 1000);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: now },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isPremium: true, premiumUntil: periodEnd },
      }),
    ]);

    return { success: true, plan: sub.userPlan, premiumUntil: periodEnd };
  }

  // ─────────────────── B2B: thuê bao phần mềm cho tiệm ───────────────────

  /// shopId của user (OWNER/STAFF). Null → chưa gắn tiệm.
  private async resolveShopId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shopId: true },
    });
    if (!user?.shopId) {
      throw new ForbiddenException('Tài khoản chưa gắn tiệm');
    }
    return user.shopId;
  }

  /// Bảng giá gói tiệm (public/owner).
  getShopPlans() {
    return Object.values(SHOP_PLANS).map((p) => ({
      plan: p.plan,
      label: p.label,
      priceVnd: p.priceVnd,
      durationDays: p.durationDays,
    }));
  }

  /// Trạng thái thuê bao của tiệm hiện tại.
  async getShopSubscription(userId: string) {
    const shopId = await this.resolveShopId(userId);
    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: { shopId, status: 'ACTIVE', currentPeriodEnd: { gt: now } },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, status: true, trialEndsAt: true },
    });
    return {
      active: !!sub,
      plan: sub?.shopPlan ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      shopName: shop?.name ?? null,
      shopStatus: shop?.status ?? null,
      trialEndsAt: shop?.trialEndsAt ?? null,
    };
  }

  /// Tạo phiên thanh toán thuê bao tiệm (Subscription SHOP + Payment PENDING).
  async shopCheckout(userId: string, plan: string) {
    const shopId = await this.resolveShopId(userId);
    const info = SHOP_PLANS[plan];
    if (!info) throw new BadRequestException('Gói không hợp lệ');
    const now = new Date();

    const sub = await this.prisma.subscription.create({
      data: {
        subscriberType: 'SHOP',
        shopId,
        shopPlan: info.plan,
        status: 'TRIALING',
        currentPeriodStart: now,
        currentPeriodEnd: now,
      },
    });
    const payment = await this.prisma.payment.create({
      data: {
        amount: info.priceVnd,
        currency: 'VND',
        provider: PaymentProvider.VNPAY,
        status: 'PENDING',
        shopId,
        subscriptionId: sub.id,
        description: `Tiệm mua ${info.label}`,
      },
    });
    return {
      paymentId: payment.id,
      subscriptionId: sub.id,
      amount: info.priceVnd,
      plan: info.plan,
      // ⚠️ DEV mock. Thực tế thay bằng URL cổng thanh toán.
      payUrl: `/api/v1/shops/payments/${payment.id}/confirm-mock`,
    };
  }

  /// DEV ONLY: kích hoạt thuê bao tiệm → Subscription ACTIVE + Shop.status ACTIVE.
  async shopConfirmMock(userId: string, paymentId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('confirm-mock bị tắt ở môi trường production');
    }
    const shopId = await this.resolveShopId(userId);
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    if (!payment.subscriptionId) {
      throw new BadRequestException('Giao dịch không gắn gói');
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
    });
    if (!sub || !sub.shopPlan) throw new NotFoundException('Không tìm thấy gói');

    const info = SHOP_PLANS[sub.shopPlan];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + info.durationDays * 24 * 3600 * 1000);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: now },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      }),
      this.prisma.shop.update({
        where: { id: shopId },
        data: { status: 'ACTIVE', trialEndsAt: null },
      }),
    ]);

    return { success: true, plan: sub.shopPlan, currentPeriodEnd: periodEnd };
  }
}
