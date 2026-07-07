import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  ListPaymentsDto,
  ListReportsDto,
  ListUsersDto,
  SetPremiumDto,
  UpdateReportDto,
  UpdateUserDto,
} from './dto/admin.dto';

/// Toàn bộ endpoint admin — chỉ ADMIN / SUPER_ADMIN (RolesGuard global).
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan' })
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sách người dùng (phân trang + lọc)' })
  users(@Query() dto: ListUsersDto) {
    return this.admin.users(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Cập nhật role / trạng thái user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Danh sách báo cáo bài hát' })
  reports(@Query() dto: ListReportsDto) {
    return this.admin.reports(dto);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Xử lý báo cáo (RESOLVED / REJECTED)' })
  updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.admin.updateReport(id, dto.status);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Danh sách giao dịch (phân trang + lọc status)' })
  payments(@Query() dto: ListPaymentsDto) {
    return this.admin.payments(dto);
  }

  @Post('users/:id/premium')
  @ApiOperation({ summary: 'Cấp / gỡ Premium thủ công (days = 0 để gỡ)' })
  setPremium(@Param('id') id: string, @Body() dto: SetPremiumDto) {
    return this.admin.setUserPremium(id, dto.days);
  }
}
