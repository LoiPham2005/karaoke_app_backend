import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateShopDto,
  ListShopsDto,
  UpdateFeatureFlagDto,
  UpdateShopDto,
  UpdateUserRoleDto,
  UpsertSettingDto,
} from './dto/super-admin.dto';
import { SuperAdminService } from './super-admin.service';

/// Endpoint chỉ dành cho SUPER_ADMIN — quản lý shops, system settings, feature flags.
/// Cùng @Controller('admin') với AdminController nhưng path con khác nên không trùng route.
@ApiTags('super-admin')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class SuperAdminController {
  constructor(private readonly superAdmin: SuperAdminService) {}

  // ── Shops ──
  @Get('shops')
  @ApiOperation({ summary: 'Danh sách shop (phân trang + lọc)' })
  listShops(@Query() dto: ListShopsDto) {
    return this.superAdmin.listShops(dto);
  }

  @Post('shops')
  @ApiOperation({ summary: 'Tạo shop (TRIAL); gán OWNER nếu ownerEmail tồn tại' })
  createShop(@Body() dto: CreateShopDto) {
    return this.superAdmin.createShop(dto);
  }

  @Get('shops/:id')
  @ApiOperation({ summary: 'Chi tiết shop' })
  getShop(@Param('id') id: string) {
    return this.superAdmin.getShop(id);
  }

  @Patch('shops/:id')
  @ApiOperation({ summary: 'Cập nhật shop (duyệt ACTIVE / khoá SUSPENDED)' })
  updateShop(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.superAdmin.updateShop(id, dto);
  }

  @Delete('shops/:id')
  @ApiOperation({ summary: 'Xoá mềm shop' })
  deleteShop(@Param('id') id: string) {
    return this.superAdmin.deleteShop(id);
  }

  // ── Quản lý quyền ──
  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Đổi role user (kể cả ADMIN/SUPER_ADMIN)' })
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.superAdmin.updateUserRole(id, dto.role, currentUserId);
  }

  // ── System settings ──
  @Get('settings')
  @ApiOperation({ summary: 'Danh sách system settings' })
  listSettings() {
    return this.superAdmin.listSettings();
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Upsert system setting theo key' })
  upsertSetting(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.superAdmin.upsertSetting(key, dto.value, currentUserId);
  }

  // ── Feature flags ──
  @Get('feature-flags')
  @ApiOperation({ summary: 'Danh sách feature flags' })
  listFeatureFlags() {
    return this.superAdmin.listFeatureFlags();
  }

  @Patch('feature-flags/:key')
  @ApiOperation({ summary: 'Upsert feature flag theo key (bật/tắt)' })
  upsertFeatureFlag(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.superAdmin.upsertFeatureFlag(key, dto, currentUserId);
  }
}
