import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListPaymentsDto,
  ListReportsDto,
  ListUsersDto,
  UpdateUserDto,
} from './dto/admin.dto';

// Field user trả cho admin (không lộ passwordHash...).
const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  shopId: true,
  isPremium: true,
  premiumUntil: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /// Thống kê tổng quan cho dashboard.
  async stats() {
    const [
      totalUsers,
      premiumUsers,
      totalSongs,
      totalPlaylists,
      pendingReports,
      playAgg,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isPremium: true, deletedAt: null } }),
      this.prisma.song.count(),
      this.prisma.playlist.count({ where: { deletedAt: null } }),
      this.prisma.songReport.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.song.aggregate({ _sum: { playCountApp: true } }),
      // Doanh thu = tổng Payment đã thanh toán (VND).
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
    ]);
    return {
      totalUsers,
      premiumUsers,
      totalSongs,
      totalPlaylists,
      pendingReports,
      totalPlays: playAgg._sum.playCountApp ?? 0,
      revenueVnd: revenueAgg._sum.amount ?? 0,
    };
  }

  /// Danh sách user có phân trang + lọc theo search/role.
  async users(dto: ListUsersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (dto.search) {
      where.OR = [
        { email: { contains: dto.search, mode: 'insensitive' } },
        { displayName: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.role) where.role = dto.role;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  updateUser(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      select: USER_SELECT,
    });
  }

  /// Danh sách báo cáo (kèm bài + người báo) có phân trang + lọc status.
  async reports(dto: ListReportsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.SongReportWhereInput = dto.status
      ? { status: dto.status }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.songReport.findMany({
        where,
        include: {
          song: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.songReport.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  updateReport(id: string, status: ReportStatus) {
    return this.prisma.songReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === ReportStatus.PENDING ? null : new Date(),
      },
    });
  }

  /// Danh sách giao dịch (kèm user + gói) có phân trang + lọc status.
  async payments(dto: ListPaymentsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.PaymentWhereInput = dto.status
      ? { status: dto.status }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          subscription: { select: { userPlan: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /// Cấp/gỡ Premium thủ công. days > 0 → cấp từ bây giờ + days ngày; days = 0 → gỡ.
  setUserPremium(id: string, days: number) {
    const premiumUntil =
      days > 0 ? new Date(Date.now() + days * 24 * 3600 * 1000) : null;
    return this.prisma.user.update({
      where: { id },
      data: { isPremium: days > 0, premiumUntil },
      select: USER_SELECT,
    });
  }
}
