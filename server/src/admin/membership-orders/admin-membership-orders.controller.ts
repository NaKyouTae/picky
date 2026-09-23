import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminMembershipOrdersService } from './admin-membership-orders.service';
import { ListAdminMembershipOrdersDto } from './dto/list-admin-membership-orders.dto';

@ApiTags('admin-membership-orders')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/membership-orders')
export class AdminMembershipOrdersController {
  constructor(private readonly orders: AdminMembershipOrdersService) {}

  /** 'summary' 를 :id 로 오해할 라우트가 없으므로 순서는 자유롭다 */
  @Get('summary')
  @ApiOperation({ summary: '결제 요약 (승인 건수·매출 합계)' })
  summary() {
    return this.orders.summary();
  }

  @Get()
  @ApiOperation({ summary: '전체 결제 내역 (커서 페이지네이션 · 상태/검색)' })
  list(@Query() query: ListAdminMembershipOrdersDto) {
    return this.orders.list(query);
  }
}
