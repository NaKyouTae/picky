import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { AppleIapError } from './apple-iap.service';
import { AppleNotificationDto } from './dto/apple-notification.dto';
import { ConfirmMembershipOrderDto } from './dto/confirm-membership-order.dto';
import { CreateMembershipOrderDto } from './dto/create-membership-order.dto';
import { FailMembershipOrderDto } from './dto/fail-membership-order.dto';
import { ListMyOrdersDto } from './dto/list-my-orders.dto';
import { RedeemApplePurchaseDto } from './dto/redeem-apple-purchase.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@Controller('memberships')
export class MembershipsController {
  private readonly logger = new Logger(MembershipsController.name);

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

  @Post('orders/apple')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'App Store 인앱결제 적립 — 영수증을 검증하고 이용 기간을 부여한다',
    description:
      'iOS 앱 전용. 결제는 StoreKit 이 이미 끝냈고 서버는 영수증을 검증해 주문을 PAID 로 만든다. ' +
      '같은 영수증을 다시 보내도 기간이 두 번 늘지 않는다 (멱등).',
  })
  redeemApplePurchase(@Req() req: AuthedRequest, @Body() dto: RedeemApplePurchaseDto) {
    return this.memberships.redeemApplePurchase(req.user!.sub, dto);
  }

  /**
   * App Store Server Notifications V2 수신 — **Apple 이 직접 호출한다.**
   *
   * 로그인 가드를 걸지 않는다. 호출자가 Apple 이라는 보증은 본문(JWS)의 서명이고,
   * 그 검증에 실패하면 401 로 돌려보낸다.
   *
   * 등록 주소는 App Store Connect > 앱 정보 > App Store Server Notifications 이며,
   * **Vercel(app) 이 아니라 NestJS 서버 주소**여야 한다 — 프론트를 거치지 않는다.
   */
  @Post('apple/notifications')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async appleNotifications(@Body() dto: AppleNotificationDto) {
    try {
      await this.memberships.handleAppleNotification(dto);
    } catch (error) {
      if (error instanceof AppleIapError) {
        this.logger.warn(`App Store 알림 서명 검증 실패 (${error.code})`);
        throw new UnauthorizedException();
      }
      throw error;
    }

    // Apple 은 2xx 가 아니면 최대 3일간 재시도한다. 본문은 보지 않는다.
    return { received: true };
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
