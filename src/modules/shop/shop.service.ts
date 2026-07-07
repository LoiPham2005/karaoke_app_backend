import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  Role,
  RoomQueueStatus,
  RoomStatus,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddQueueItemDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRoomDto,
  CreateStaffDto,
  ListOrdersDto,
  ListSessionsDto,
  OpenSessionDto,
  UpdateProductDto,
  UpdateRoomDto,
  UpdateShopDto,
} from './dto/shop.dto';

// Field staff trả về (KHÔNG lộ passwordHash...).
const STAFF_SELECT = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  shopId: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Scoping helper ──
  /// Lấy shopId gắn với user. Mọi query B2B đều filter theo shopId này.
  /// KHÔNG bao giờ nhận shopId từ client.
  private async getShopId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shopId: true },
    });
    if (!user?.shopId) {
      throw new ForbiddenException('Tài khoản chưa gắn tiệm');
    }
    return user.shopId;
  }

  // ══════════════════════════════════════════════════════════
  // SHOP
  // ══════════════════════════════════════════════════════════

  /// Thông tin tiệm của user hiện tại + đếm rooms/staff.
  async getMyShop(userId: string) {
    const shopId = await this.getShopId(userId);
    const [shop, roomsCount, staffCount] = await Promise.all([
      this.prisma.shop.findUnique({ where: { id: shopId } }),
      this.prisma.room.count({ where: { shopId } }),
      this.prisma.user.count({
        where: { shopId, role: Role.STAFF, deletedAt: null },
      }),
    ]);
    if (!shop) throw new NotFoundException('Không tìm thấy tiệm');
    return { ...shop, roomsCount, staffCount };
  }

  async updateMyShop(userId: string, dto: UpdateShopDto) {
    const shopId = await this.getShopId(userId);
    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
    });
  }

  /// Thống kê dashboard tiệm.
  /// revenueToday/Month = tổng Order PAID trong ngày/tháng (doanh thu F&B đã
  /// thanh toán). Chọn Order PAID thay vì PlaySession để phản ánh tiền thực thu
  /// theo từng đơn (session có thể chưa close).
  async stats(userId: string) {
    const shopId = await this.getShopId(userId);
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      roomsTotal,
      roomsOccupied,
      activeSessions,
      ordersToday,
      revenueTodayAgg,
      revenueMonthAgg,
    ] = await Promise.all([
      this.prisma.room.count({ where: { shopId, isActive: true } }),
      this.prisma.room.count({
        where: { shopId, status: RoomStatus.OCCUPIED },
      }),
      this.prisma.playSession.count({
        where: { shopId, status: SessionStatus.OPEN },
      }),
      this.prisma.order.count({
        where: { shopId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          shopId,
          status: OrderStatus.PAID,
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          shopId,
          status: OrderStatus.PAID,
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      roomsTotal,
      roomsOccupied,
      activeSessions,
      ordersToday,
      revenueToday: revenueTodayAgg._sum.totalAmount ?? 0,
      revenueMonth: revenueMonthAgg._sum.totalAmount ?? 0,
    };
  }

  // ══════════════════════════════════════════════════════════
  // ROOMS
  // ══════════════════════════════════════════════════════════

  async listRooms(userId: string) {
    const shopId = await this.getShopId(userId);
    return this.prisma.room.findMany({
      where: { shopId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRoom(userId: string, dto: CreateRoomDto) {
    const shopId = await this.getShopId(userId);
    return this.prisma.room.create({
      data: {
        shopId,
        name: dto.name,
        code: dto.code ?? null,
        capacity: dto.capacity ?? null,
        roomType: dto.roomType ?? null,
        hourlyPrice: dto.hourlyPrice,
      },
    });
  }

  async updateRoom(userId: string, id: string, dto: UpdateRoomDto) {
    const shopId = await this.getShopId(userId);
    await this.assertRoom(shopId, id);
    return this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.roomType !== undefined ? { roomType: dto.roomType } : {}),
        ...(dto.hourlyPrice !== undefined
          ? { hourlyPrice: dto.hourlyPrice }
          : {}),
      },
    });
  }

  /// Xoá phòng: soft-delete (isActive = false). Giữ lịch sử session.
  async deleteRoom(userId: string, id: string) {
    const shopId = await this.getShopId(userId);
    await this.assertRoom(shopId, id);
    return this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async assertRoom(shopId: string, id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room || room.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    return room;
  }

  // ══════════════════════════════════════════════════════════
  // STAFF
  // ══════════════════════════════════════════════════════════

  async listStaff(userId: string) {
    const shopId = await this.getShopId(userId);
    return this.prisma.user.findMany({
      where: { shopId, role: Role.STAFF, deletedAt: null },
      select: STAFF_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(userId: string, dto: CreateStaffDto) {
    const shopId = await this.getShopId(userId);
    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
        role: Role.STAFF,
        shopId,
      },
      select: STAFF_SELECT,
    });
  }

  async updateStaff(userId: string, id: string, status: UserStatus) {
    const shopId = await this.getShopId(userId);
    await this.assertStaff(shopId, id);
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: STAFF_SELECT,
    });
  }

  /// Xoá nhân viên: gỡ khỏi tiệm (shopId = null) + status = BANNED.
  /// Giữ bản ghi user để không mất lịch sử (openedSessions...).
  async deleteStaff(userId: string, id: string) {
    const shopId = await this.getShopId(userId);
    await this.assertStaff(shopId, id);
    return this.prisma.user.update({
      where: { id },
      data: { shopId: null, status: UserStatus.BANNED },
      select: STAFF_SELECT,
    });
  }

  private async assertStaff(shopId: string, id: string) {
    const staff = await this.prisma.user.findUnique({ where: { id } });
    if (!staff || staff.shopId !== shopId || staff.role !== Role.STAFF) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    return staff;
  }

  // ══════════════════════════════════════════════════════════
  // PRODUCTS
  // ══════════════════════════════════════════════════════════

  async listProducts(userId: string) {
    const shopId = await this.getShopId(userId);
    return this.prisma.product.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(userId: string, dto: CreateProductDto) {
    const shopId = await this.getShopId(userId);
    return this.prisma.product.create({
      data: {
        shopId,
        name: dto.name,
        price: dto.price,
        category: dto.category,
        imageUrl: dto.imageUrl ?? null,
      },
    });
  }

  async updateProduct(userId: string, id: string, dto: UpdateProductDto) {
    const shopId = await this.getShopId(userId);
    await this.assertProduct(shopId, id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      },
    });
  }

  /// Xoá sản phẩm: soft-delete (isActive = false).
  async deleteProduct(userId: string, id: string) {
    const shopId = await this.getShopId(userId);
    await this.assertProduct(shopId, id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async assertProduct(shopId: string, id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return product;
  }

  // ══════════════════════════════════════════════════════════
  // SESSIONS
  // ══════════════════════════════════════════════════════════

  async listSessions(userId: string, dto: ListSessionsDto) {
    const shopId = await this.getShopId(userId);
    const status = dto.status ?? SessionStatus.OPEN;
    return this.prisma.playSession.findMany({
      where: { shopId, status },
      include: { room: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  /// Mở phiên cho phòng. Chặn nếu phòng đã có phiên OPEN.
  async openSession(userId: string, roomId: string, dto: OpenSessionDto) {
    const shopId = await this.getShopId(userId);
    const room = await this.assertRoom(shopId, roomId);

    const existing = await this.prisma.playSession.findFirst({
      where: { roomId, status: SessionStatus.OPEN },
    });
    if (existing) {
      throw new ForbiddenException('Phòng đang có phiên mở');
    }

    // Chế độ ĐẶT GIỜ TRƯỚC (prepaid): trả tiền phòng ngay + đặt mốc hết giờ.
    // Bỏ trống plannedMinutes → chế độ MỞ (tính giờ khi đóng), roomCharge = 0.
    const now = new Date();
    const planned = dto.plannedMinutes && dto.plannedMinutes > 0 ? dto.plannedMinutes : null;
    const expiresAt = planned ? new Date(now.getTime() + planned * 60_000) : null;
    const roomCharge = planned
      ? Math.round((planned / 60) * room.hourlyPrice)
      : 0;

    const [session] = await this.prisma.$transaction([
      this.prisma.playSession.create({
        data: {
          shopId,
          roomId: room.id,
          status: SessionStatus.OPEN,
          openedByStaffId: userId,
          guestCount: dto.guestCount ?? null,
          startedAt: now,
          plannedMinutes: planned,
          expiresAt,
          roomCharge, // prepaid: tính ngay; mở: 0 (tính khi đóng)
        },
      }),
      this.prisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      }),
    ]);
    return session;
  }

  /// Gia hạn phiên ĐẶT GIỜ (prepaid): +minutes vào expiresAt + cộng tiền phòng.
  /// Nếu đã quá hạn thì tính tiếp từ now (không bù khoảng đã hết).
  async extendSession(userId: string, id: string, minutes: number) {
    const shopId = await this.getShopId(userId);
    const session = await this.prisma.playSession.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!session || session.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy phiên');
    }
    if (session.status !== SessionStatus.OPEN) {
      throw new ForbiddenException('Phiên không ở trạng thái mở');
    }
    if (session.plannedMinutes == null || !session.expiresAt) {
      throw new BadRequestException('Phiên mở (tính giờ sau) không cần gia hạn');
    }
    if (minutes <= 0) throw new BadRequestException('Số phút không hợp lệ');

    const base = Math.max(session.expiresAt.getTime(), Date.now());
    const newExpires = new Date(base + minutes * 60_000);
    const extraCharge = Math.round((minutes / 60) * session.room.hourlyPrice);

    return this.prisma.playSession.update({
      where: { id },
      data: {
        plannedMinutes: session.plannedMinutes + minutes,
        expiresAt: newExpires,
        roomCharge: session.roomCharge + extraCharge,
      },
    });
  }

  /// Chi tiết phiên + queue (order by position) + orders kèm items.
  async getSession(userId: string, id: string) {
    const shopId = await this.getShopId(userId);
    const session = await this.prisma.playSession.findUnique({
      where: { id },
      include: {
        room: true,
        queueItems: { orderBy: { position: 'asc' } },
        orders: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session || session.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy phiên');
    }
    return session;
  }

  /// Đóng phiên:
  ///   - Prepaid (plannedMinutes != null): roomCharge GIỮ NGUYÊN (đã tính theo
  ///     giờ đặt + gia hạn lúc mở/extend).
  ///   - Mở (plannedMinutes null): roomCharge = ceil(số giờ thực startedAt→now) * giá.
  ///   totalAmount = roomCharge + tổng totalAmount mọi Order CHƯA huỷ (trừ CANCELLED).
  ///   Room.status = AVAILABLE, status = CLOSED, endedAt = now.
  async closeSession(userId: string, id: string) {
    const shopId = await this.getShopId(userId);
    const session = await this.prisma.playSession.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!session || session.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy phiên');
    }
    if (session.status !== SessionStatus.OPEN) {
      throw new ForbiddenException('Phiên không ở trạng thái mở');
    }

    const now = new Date();
    let roomCharge: number;
    if (session.plannedMinutes != null) {
      // Prepaid: đã tính tiền phòng lúc mở + gia hạn.
      roomCharge = session.roomCharge;
    } else {
      // Mở: tính giờ thực, làm tròn lên trọn giờ.
      const hours = Math.ceil(
        (now.getTime() - session.startedAt.getTime()) / 3_600_000,
      );
      roomCharge = Math.max(0, hours) * session.room.hourlyPrice;
    }

    const fbAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        sessionId: id,
        status: { not: OrderStatus.CANCELLED },
      },
    });
    const totalAmount = roomCharge + (fbAgg._sum.totalAmount ?? 0);

    const [updated] = await this.prisma.$transaction([
      this.prisma.playSession.update({
        where: { id },
        data: {
          status: SessionStatus.CLOSED,
          endedAt: now,
          roomCharge,
          totalAmount,
        },
      }),
      this.prisma.room.update({
        where: { id: session.roomId },
        data: { status: RoomStatus.AVAILABLE },
      }),
    ]);
    return updated;
  }

  private async assertSession(shopId: string, id: string) {
    const session = await this.prisma.playSession.findUnique({
      where: { id },
    });
    if (!session || session.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy phiên');
    }
    return session;
  }

  // ══════════════════════════════════════════════════════════
  // ROOM QUEUE
  // ══════════════════════════════════════════════════════════

  async listQueue(userId: string, sessionId: string) {
    const shopId = await this.getShopId(userId);
    await this.assertSession(shopId, sessionId);
    return this.prisma.roomQueueItem.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
    });
  }

  async addQueueItem(userId: string, sessionId: string, dto: AddQueueItemDto) {
    const shopId = await this.getShopId(userId);
    const session = await this.assertSession(shopId, sessionId);
    // Phòng đặt giờ đã hết hạn → chặn hát tiếp tới khi gia hạn.
    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException(
        'Phòng đã hết giờ, vui lòng gia hạn để hát tiếp',
      );
    }
    const last = await this.prisma.roomQueueItem.findFirst({
      where: { sessionId },
      orderBy: { position: 'desc' },
    });
    const position = (last?.position ?? 0) + 1;
    return this.prisma.roomQueueItem.create({
      data: {
        sessionId,
        songYoutubeId: dto.songYoutubeId,
        songTitle: dto.songTitle,
        songThumbnail: dto.songThumbnail ?? null,
        position,
        status: RoomQueueStatus.QUEUED,
      },
    });
  }

  async deleteQueueItem(userId: string, itemId: string) {
    const shopId = await this.getShopId(userId);
    const item = await this.assertQueueItem(shopId, itemId);
    await this.prisma.roomQueueItem.delete({ where: { id: item.id } });
    return { id: item.id };
  }

  /// Cập nhật trạng thái bài trong queue. PLAYED → set playedAt.
  async updateQueueItem(
    userId: string,
    itemId: string,
    status: RoomQueueStatus,
  ) {
    const shopId = await this.getShopId(userId);
    const item = await this.assertQueueItem(shopId, itemId);
    return this.prisma.roomQueueItem.update({
      where: { id: item.id },
      data: {
        status,
        ...(status === RoomQueueStatus.PLAYED
          ? { playedAt: new Date() }
          : {}),
      },
    });
  }

  private async assertQueueItem(shopId: string, itemId: string) {
    const item = await this.prisma.roomQueueItem.findUnique({
      where: { id: itemId },
      include: { session: true },
    });
    if (!item || item.session.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy bài trong hàng chờ');
    }
    return item;
  }

  // ══════════════════════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════════════════════

  /// Tạo order cho phiên. Đọc Product (verify cùng shop) → snapshot
  /// name + unitPrice; lineTotal = qty * unitPrice; totalAmount = tổng.
  async createOrder(userId: string, sessionId: string, dto: CreateOrderDto) {
    const shopId = await this.getShopId(userId);
    await this.assertSession(shopId, sessionId);

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const items = dto.items.map((i) => {
      const product = byId.get(i.productId);
      if (!product) {
        throw new NotFoundException(
          `Không tìm thấy sản phẩm ${i.productId} trong tiệm`,
        );
      }
      const lineTotal = i.qty * product.price;
      return {
        productId: product.id,
        name: product.name,
        qty: i.qty,
        unitPrice: product.price,
        lineTotal,
      };
    });
    const totalAmount = items.reduce((sum, i) => sum + i.lineTotal, 0);

    return this.prisma.order.create({
      data: {
        shopId,
        sessionId,
        status: OrderStatus.PENDING,
        totalAmount,
        note: dto.note ?? null,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  async listOrders(userId: string, dto: ListOrdersDto) {
    const shopId = await this.getShopId(userId);
    return this.prisma.order.findMany({
      where: {
        shopId,
        ...(dto.sessionId ? { sessionId: dto.sessionId } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrder(userId: string, id: string, status: OrderStatus) {
    const shopId = await this.getShopId(userId);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.shopId !== shopId) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }
}
