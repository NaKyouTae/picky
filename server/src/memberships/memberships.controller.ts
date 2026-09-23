import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { ConfirmMembershipOrderDto } from './dto/confirm-membership-order.dto';
import { CreateMembershipOrderDto } from './dto/create-membership-order.dto';
import { FailMembershipOrderDto } from './dto/fail-membership-order.dto';
import { ListMyOrdersDto } from './dto/list-my-orders.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  // 가격은 로그인 전에도 보여 줄 수 있어야 하므로 가드를 걸지 않는다.
  @Get('plans')
  @ApiOperation({ summary: '판매 중인 회원권 목록' })
  listPlans() {
    return this.memberships.listPlans();
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 이용권 상태 (유료 템플릿 사용 가능 여부)' })
  me(@Req() req: AuthedRequest) {
    return this.memberships.getMyMembership(req.user!.sub);
  }

  @Get('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 결제 내역 (커서 페이지네이션)' })
  listMyOrders(@Req() req: AuthedRequest, @Query() query: ListMyOrdersDto) {
    return this.memberships.listMyOrders(req.user!.sub, query);
  }

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '주문 생성 — 결제창에 넘길 주문번호·금액을 돌려준다' })
  createOrder(@Req() req: AuthedRequest, @Body() dto: CreateMembershipOrderDto) {
    return this.memberships.createOrder(req.user!.sub, dto);
  }

  @Post('orders/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '결제 승인 — 이용 기간을 부여한다' })
  confirmOrder(@Req() req: AuthedRequest, @Body() dto: ConfirmMembershipOrderDto) {
    return this.memberships.confirmOrder(req.user!.sub, dto);
  }

  @Post('orders/fail')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '결제 실패·중단 기록' })
  markFailed(@Req() req: AuthedRequest, @Body() dto: FailMembershipOrderDto) {
    return this.memberships.markFailed(req.user!.sub, dto);
  }
}
