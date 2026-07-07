import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateShopDto,
  ListShopsDto,
  UpdateFeatureFlagDto,
  UpdateShopDto,
} from './dto/super-admin.dto';

const OWNER_SELECT = {
  id: true,
  email: true,
  displayName: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shops ─────────────────────────────────────────────────────────

  /// Danh sách shop (phân trang + lọc search/status), kèm owner + đếm rooms/users.
  async listShops(dto: ListShopsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.ShopWhereInput = { deletedAt: null };
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { slug: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.status) where.status = dto.status;

    const [items, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        include: {
          owner: { select: OWNER_SELECT },
          _count: { select: { rooms: true, users: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shop.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /// Tạo shop status=TRIAL. Nếu ownerEmail có & user tồn tại → gán owner + set OWNER.
  async createShop(dto: CreateShopDto) {
    let ownerId: string | undefined;
    if (dto.ownerEmail) {
      const owner = await this.prisma.user.findUnique({
        where: { email: dto.ownerEmail },
        select: { id: true },
      });
      if (owner) ownerId = owner.id;
    }

    try {
      const shop = await this.prisma.shop.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          status: ShopStatus.TRIAL,
          ...(ownerId ? { ownerId } : {}),
        },
      });

      // Gán user làm OWNER của shop vừa tạo.
      if (ownerId) {
        await this.prisma.user.update({
          where: { id: ownerId },
          data: { role: Role.OWNER, shopId: shop.id },
        });
      }
      return shop;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
      }
      throw e;
    }
  }

  async getShop(id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: OWNER_SELECT },
        _count: { select: { rooms: true, users: true } },
      },
    });
    if (!shop) throw new NotFoundException('Không tìm thấy shop');
    return shop;
  }

  /// Cập nhật shop (duyệt → ACTIVE, khoá → SUSPENDED, đổi thông tin).
  async updateShop(id: string, dto: UpdateShopDto) {
    await this.getShop(id);
    return this.prisma.shop.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
  }

  /// Soft delete (deletedAt = now).
  async deleteShop(id: string) {
    await this.getShop(id);
    return this.prisma.shop.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Quản lý quyền ─────────────────────────────────────────────────

  /// Đổi role bất kỳ user (kể cả phong ADMIN/SUPER_ADMIN). Không cho đổi chính mình.
  async updateUserRole(id: string, role: Role, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Không thể đổi role của chính mình');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        shopId: true,
        status: true,
      },
    });
  }

  // ── System settings ───────────────────────────────────────────────

  listSettings() {
    return this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /// Upsert setting theo key.
  upsertSetting(key: string, value: unknown, updatedBy: string) {
    const json = (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: json, updatedBy },
      update: { value: json, updatedBy },
    });
  }

  // ── Feature flags ─────────────────────────────────────────────────

  listFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /// Upsert feature flag theo key (bật/tắt + mô tả).
  upsertFeatureFlag(key: string, dto: UpdateFeatureFlagDto, updatedBy: string) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled: dto.enabled,
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        updatedBy,
      },
      update: {
        enabled: dto.enabled,
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        updatedBy,
      },
    });
  }
}
