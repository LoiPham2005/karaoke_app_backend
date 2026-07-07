import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/// Dọn token rác định kỳ — token hết hạn / đã dùng / đã thu hồi đều vô dụng,
/// xoá để bảng nhẹ + truy vấn nhanh. (OTP ngắn hạn nên cân nhắc Redis TTL sau.)
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    const now = new Date();
    try {
      const vt = await this.prisma.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
      });
      const rt = await this.prisma.refreshToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] },
      });
      this.logger.log(
        `🧹 Token cleanup: xoá ${vt.count} verification + ${rt.count} refresh token hết hạn/thu hồi`,
      );
    } catch (e) {
      this.logger.warn(`Token cleanup bỏ qua (DB?): ${(e as Error).message}`);
    }
  }
}
