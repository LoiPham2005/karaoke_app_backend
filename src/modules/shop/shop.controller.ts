import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShopService } from './shop.service';
import {
  AddQueueItemDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRoomDto,
  CreateStaffDto,
  ListOrdersDto,
  ListSessionsDto,
  ExtendSessionDto,
  OpenSessionDto,
  UpdateOrderDto,
  UpdateProductDto,
  UpdateQueueItemDto,
  UpdateRoomDto,
  UpdateShopDto,
  UpdateStaffDto,
} from './dto/shop.dto';

/// API B2B cho OWNER (chủ tiệm) + STAFF (nhân viên). Scoping theo user.shopId.
@ApiTags('shop')
@ApiBearerAuth()
@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  // ── Shop (OWNER) ──
  @Get('me')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Thông tin tiệm + đếm rooms/staff' })
  getMe(@CurrentUser('sub') userId: string) {
    return this.shop.getMyShop(userId);
  }

  @Patch('me')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Cập nhật thông tin tiệm' })
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateShopDto) {
    return this.shop.updateMyShop(userId, dto);
  }

  @Get('stats')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Thống kê dashboard tiệm' })
  stats(@CurrentUser('sub') userId: string) {
    return this.shop.stats(userId);
  }

  // ── Rooms ──
  @Get('rooms')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Danh sách phòng' })
  listRooms(@CurrentUser('sub') userId: string) {
    return this.shop.listRooms(userId);
  }

  @Post('rooms')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Tạo phòng' })
  createRoom(@CurrentUser('sub') userId: string, @Body() dto: CreateRoomDto) {
    return this.shop.createRoom(userId, dto);
  }

  @Patch('rooms/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Cập nhật phòng' })
  updateRoom(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.shop.updateRoom(userId, id, dto);
  }

  @Delete('rooms/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Xoá phòng (soft: isActive=false)' })
  deleteRoom(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.deleteRoom(userId, id);
  }

  // ── Staff (OWNER) ──
  @Get('staff')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Danh sách nhân viên' })
  listStaff(@CurrentUser('sub') userId: string) {
    return this.shop.listStaff(userId);
  }

  @Post('staff')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Tạo nhân viên (role STAFF)' })
  createStaff(@CurrentUser('sub') userId: string, @Body() dto: CreateStaffDto) {
    return this.shop.createStaff(userId, dto);
  }

  @Patch('staff/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Khoá/mở nhân viên' })
  updateStaff(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.shop.updateStaff(userId, id, dto.status);
  }

  @Delete('staff/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Xoá nhân viên (gỡ shopId + BANNED)' })
  deleteStaff(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.deleteStaff(userId, id);
  }

  // ── Products ──
  @Get('products')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Danh sách sản phẩm' })
  listProducts(@CurrentUser('sub') userId: string) {
    return this.shop.listProducts(userId);
  }

  @Post('products')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Tạo sản phẩm' })
  createProduct(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.shop.createProduct(userId, dto);
  }

  @Patch('products/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Cập nhật sản phẩm' })
  updateProduct(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.shop.updateProduct(userId, id, dto);
  }

  @Delete('products/:id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Xoá sản phẩm (soft: isActive=false)' })
  deleteProduct(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.deleteProduct(userId, id);
  }

  // ── Sessions ──
  @Get('sessions')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Danh sách phiên (default OPEN) kèm phòng' })
  listSessions(
    @CurrentUser('sub') userId: string,
    @Query() dto: ListSessionsDto,
  ) {
    return this.shop.listSessions(userId, dto);
  }

  @Post('rooms/:roomId/open')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Mở phiên cho phòng' })
  openSession(
    @CurrentUser('sub') userId: string,
    @Param('roomId') roomId: string,
    @Body() dto: OpenSessionDto,
  ) {
    return this.shop.openSession(userId, roomId, dto);
  }

  @Get('sessions/:id')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Chi tiết phiên + queue + orders' })
  getSession(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.getSession(userId, id);
  }

  @Post('sessions/:id/extend')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Gia hạn phiên đặt giờ (+phút, cộng tiền)' })
  extendSession(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ExtendSessionDto,
  ) {
    return this.shop.extendSession(userId, id, dto.minutes);
  }

  @Post('sessions/:id/close')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Đóng phiên + tính tiền' })
  closeSession(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.closeSession(userId, id);
  }

  // ── Room queue ──
  @Get('sessions/:id/queue')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Hàng chờ bài của phiên' })
  listQueue(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.shop.listQueue(userId, id);
  }

  @Post('sessions/:id/queue')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Thêm bài vào hàng chờ' })
  addQueueItem(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddQueueItemDto,
  ) {
    return this.shop.addQueueItem(userId, id, dto);
  }

  @Delete('queue/:itemId')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Xoá bài khỏi hàng chờ' })
  deleteQueueItem(
    @CurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.shop.deleteQueueItem(userId, itemId);
  }

  @Patch('queue/:itemId')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Cập nhật trạng thái bài (PLAYED...)' })
  updateQueueItem(
    @CurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQueueItemDto,
  ) {
    return this.shop.updateQueueItem(userId, itemId, dto.status);
  }

  // ── Orders ──
  @Post('sessions/:id/orders')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Tạo đơn F&B cho phiên' })
  createOrder(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.shop.createOrder(userId, id, dto);
  }

  @Get('orders')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Danh sách đơn (lọc theo sessionId)' })
  listOrders(@CurrentUser('sub') userId: string, @Query() dto: ListOrdersDto) {
    return this.shop.listOrders(userId, dto);
  }

  @Patch('orders/:id')
  @Roles(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn' })
  updateOrder(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.shop.updateOrder(userId, id, dto.status);
  }
}
