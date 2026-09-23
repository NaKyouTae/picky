import { Environment, NotificationTypeV2 } from '@apple/app-store-server-library';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { MembershipOrderStatus, MembershipStore } from '../generated/prisma/enums';
import { AppleIapError, AppleIapService } from './apple-iap.service';
import type { AppleNotificationDto } from './dto/apple-notification.dto';
import type { ConfirmMembershipOrderDto } from './dto/confirm-membership-order.dto';
import type { CreateMembershipOrderDto } from './dto/create-membership-order.dto';
import type { FailMembershipOrderDto } from './dto/fail-membership-order.dto';
import type { ListMyOrdersDto } from './dto/list-my-orders.dto';
import type { RedeemApplePurchaseDto } from './dto/redeem-apple-purchase.dto';
import { TossPaymentError, TossPaymentsService } from './toss-payments.service';

const DEFAULT_TAKE = 20;

/** 결제창에 넘길 주문 정보 — 금액·주문번호는 서버가 정한 값이어야 한다 */
export interface PreparedOrder {
  orderCode: string;
  orderName: string;
  amount: number;
  /** 토스 SDK 의 customerKey — 유추 불가능해야 해서 사용자 uuid 를 쓴다 */
  customerKey: string;
}

/** 지금 유료 템플릿을 쓸 수 있는지 */
export interface MyMembership {
  active: boolean;
  /** 이용 종료 시각 — 한 번도 구매하지 않았으면 null */
  endsAt: Date | null;
}

const PLAN_SELECT = {
  id: true,
  name: true,
  months: true,
  price: true,
  listPrice: true,
  description: true,
  appleProductId: true,
} as const;

const ORDER_SELECT = {
  id: true,
  orderCode: true,
  planName: true,
  months: true,
  amount: true,
  status: true,
  store: true,
  method: true,
  paidAt: true,
  refundedAt: true,
  failReason: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
} as const;

/**
 * 회원권 판매 + 결제.
 *
 * 환불은 다루지 않는다 — 승인된 결제는 그대로 남고, 이용 기간도 되돌리지 않는다.
 */
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toss: TossPaymentsService,
    private readonly apple: AppleIapService,
  ) {}

  /** 판매 중인 회원권 — 앱 구매 화면 */
  listPlans() {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { months: 'asc' }],
      select: PLAN_SELECT,
    });
  }

  /**
   * 내 이용권 상태.
   * 승인된 주문 중 만료가 가장 늦은 것 하나만 보면 된다 (연장 구매는 기간을 이어 붙인다).
   * `@@index([userId, status, endsAt])` 가 이 조건을 그대로 커버한다.
   */
  async getMyMembership(userId: string): Promise<MyMembership> {
    const latest = await this.prisma.membershipOrder.aggregate({
      where: { userId, status: MembershipOrderStatus.PAID },
      _max: { endsAt: true },
    });

    const endsAt = latest._max.endsAt;
    return { active: endsAt !== null && endsAt > new Date(), endsAt };
  }

  /**
   * 회원권이 **지금** 살아 있는지 확인한다 — 아니면 403.
   *
   * 유료 기능(콜라주 보관·다시 내려받기)을 쓰기 전에 부른다. 기간이 끝나면 막히고
   * 다시 구매해야 풀린다 — 한 번 샀다고 영구히 열리지 않는다.
   * 프런트가 '기간 만료' 와 '한 번도 안 삼' 을 구분해 안내할 수 있도록 문구를 나눈다.
   */
  async assertActive(userId: string): Promise<MyMembership> {
    const membership = await this.getMyMembership(userId);
    if (!membership.active) {
      throw new ForbiddenException(
        membership.endsAt
          ? '회원권 기간이 끝났어요. 다시 구매하면 이어서 이용할 수 있어요.'
          : '회원권을 구매하면 이용할 수 있어요.',
      );
    }
    return membership;
  }

  /** 내 결제 내역 (커서 기반, 최신순) */
  async listMyOrders(userId: string, { cursor, take = DEFAULT_TAKE }: ListMyOrdersDto) {
    const rows = await this.prisma.membershipOrder.findMany({
      where: { userId },
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: ORDER_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;
    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  /**
   * 결제창을 띄우기 전 주문을 만든다 (PENDING).
   *
   * 금액과 기간은 플랜에서 읽어 스냅샷으로 굳힌다 — 클라이언트가 보낸 금액을 믿지 않고,
   * 나중에 플랜 가격이 바뀌어도 이 주문의 승인 금액은 흔들리지 않는다.
   */
  async createOrder(userId: string, { planId }: CreateMembershipOrderDto): Promise<PreparedOrder> {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: planId },
      select: { ...PLAN_SELECT, isActive: true },
    });
    if (!plan) throw new NotFoundException('회원권을 찾을 수 없습니다.');
    if (!plan.isActive) throw new BadRequestException('판매가 종료된 회원권입니다.');

    // 토스 주문번호 규칙: 영문/숫자/-/_ 6~64자. uuid 를 붙여 충돌을 없앤다.
    const orderCode = `picky-${randomUUID()}`;

    await this.prisma.membershipOrder.create({
      data: {
        orderCode,
        userId,
        planId: plan.id,
        planName: plan.name,
        months: plan.months,
        amount: plan.price,
      },
      select: { id: true },
    });

    return { orderCode, orderName: plan.name, amount: plan.price, customerKey: userId };
  }

  /**
   * 승인 — 결제창이 성공으로 돌아온 뒤 서버에서 확정한다.
   *
   * 1) 주문이 내 것인지, 금액이 주문과 같은지 확인한다 (쿼리 파라미터는 조작될 수 있다)
   * 2) 토스에 승인을 요청한다 (같은 주문번호로 두 번 승인되지 않도록 멱등키를 보낸다)
   * 3) 이용 기간을 계산해 PAID 로 굳힌다
   *
   * 성공 화면을 새로고침하면 다시 호출되므로, 이미 PAID 인 주문은 그대로 돌려준다.
   */
  async confirmOrder(userId: string, dto: ConfirmMembershipOrderDto) {
    const order = await this.prisma.membershipOrder.findUnique({
      where: { orderCode: dto.orderId },
      select: { id: true, userId: true, amount: true, months: true, status: true },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }
    if (order.status === MembershipOrderStatus.PAID) {
      return this.getOrder(order.id);
    }
    if (order.amount !== dto.amount) {
      throw new BadRequestException('결제 금액이 주문 금액과 다릅니다.');
    }

    let payment;
    try {
      payment = await this.toss.confirm({
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        amount: dto.amount,
      });
    } catch (error) {
      if (error instanceof TossPaymentError) {
        // 실패도 내역에 남긴다 — 사용자가 왜 안 됐는지 확인할 수 있어야 한다.
        await this.prisma.membershipOrder.update({
          where: { id: order.id },
          data: {
            status: MembershipOrderStatus.FAILED,
            failReason: `${error.code}: ${error.message}`.slice(0, 300),
          },
        });
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // 기간 계산과 저장을 한 트랜잭션에 묶는다 — 두 번 눌러 기간이 두 번 늘어나지 않게 한다.
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.membershipOrder.aggregate({
        where: { userId, status: MembershipOrderStatus.PAID, endsAt: { gt: now } },
        _max: { endsAt: true },
      });

      // 남은 기간이 있으면 그 뒤에 이어 붙인다 (연장 구매).
      const startsAt = current._max.endsAt ?? now;

      return tx.membershipOrder.update({
        where: { id: order.id },
        data: {
          status: MembershipOrderStatus.PAID,
          paymentKey: payment.paymentKey,
          method: payment.method ?? null,
          paidAt: payment.approvedAt ? new Date(payment.approvedAt) : now,
          failReason: null,
          startsAt,
          endsAt: addMonths(startsAt, order.months),
        },
        select: ORDER_SELECT,
      });
    });
  }

  /** 결제창에서 실패·중단된 주문에 사유를 남긴다 (이미 승인된 주문은 건드리지 않는다) */
  async markFailed(userId: string, dto: FailMembershipOrderDto) {
    const order = await this.prisma.membershipOrder.findUnique({
      where: { orderCode: dto.orderId },
      select: { id: true, userId: true, status: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }
    if (order.status === MembershipOrderStatus.PAID) return this.getOrder(order.id);

    return this.prisma.membershipOrder.update({
      where: { id: order.id },
      data: {
        status: MembershipOrderStatus.FAILED,
        failReason: `${dto.code ?? 'UNKNOWN'}: ${dto.message ?? '결제가 중단되었습니다.'}`.slice(
          0,
          300,
        ),
      },
      select: ORDER_SELECT,
    });
  }

  /**
   * App Store 인앱결제 적립.
   *
   * 토스 흐름과 순서가 반대다 — **결제가 먼저 끝나고 주문은 그 뒤에 만든다.** StoreKit 이
   * 결제를 처리한 뒤에야 영수증이 나오므로 PENDING 단계가 없고, 검증을 통과하면 바로 PAID 다.
   *
   * 같은 영수증이 두 번 올 수 있다 — 앱이 거래를 finish 하기 전에 종료됐거나, 응답을 못 받아
   * 재시도할 때다. `appleTransactionId` 의 unique 제약이 중복 적립을 막고, 이미 적립한
   * 거래는 그대로 돌려준다.
   */
  async redeemApplePurchase(userId: string, dto: RedeemApplePurchaseDto) {
    let transaction;
    try {
      transaction = await this.apple.verifyTransaction(dto.signedTransactionInfo);
    } catch (error) {
      if (error instanceof AppleIapError) throw new BadRequestException(error.message);
      throw error;
    }

    // Sandbox 는 TestFlight·심사원이 쓰는 환경이라 운영에서도 받아 줘야 한다.
    // 다만 실제 매출이 아니므로 구분할 수 있게 남긴다 (운영에서 갑자기 늘면 확인이 필요하다).
    if (transaction.environment !== Environment.PRODUCTION) {
      this.logger.warn(
        `${transaction.environment} 결제로 이용 기간을 부여합니다: ` +
          `transactionId=${transaction.transactionId} userId=${userId}`,
      );
    }

    const already = await this.findRedeemed(transaction.transactionId, userId);
    if (already) return already;

    // 판매를 중단한(isActive: false) 플랜이어도 막지 않는다 —
    // Apple 이 이미 결제를 끝냈으므로 기간은 줘야 한다.
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { appleProductId: transaction.productId },
      select: { id: true, name: true, months: true, price: true },
    });
    if (!plan) {
      // 돈은 빠져나갔는데 줄 회원권이 없는 상태다. 상품 ID 매핑이 빠진 것이므로
      // 로그로 남겨 두고 수동으로 처리해야 한다.
      this.logger.error(
        `매핑되지 않은 App Store 상품: productId=${transaction.productId} ` +
          `transactionId=${transaction.transactionId} userId=${userId}`,
      );
      throw new BadRequestException('알 수 없는 상품입니다. 고객센터로 문의해 주세요.');
    }

    // 실제 청구액은 App Store 가격 티어라 DB 가격과 다를 수 있다 —
    // 영수증이 알려 주면 그 값을, 아니면 플랜 가격을 내역에 적는다.
    const amount = transaction.amount ?? plan.price;

    try {
      // 기간 계산과 저장을 한 트랜잭션에 묶는다 (confirmOrder 와 같은 이유).
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const current = await tx.membershipOrder.aggregate({
          where: { userId, status: MembershipOrderStatus.PAID, endsAt: { gt: now } },
          _max: { endsAt: true },
        });

        // 남은 기간이 있으면 그 뒤에 이어 붙인다 (연장 구매).
        const startsAt = current._max.endsAt ?? now;

        return tx.membershipOrder.create({
          data: {
            // 주문번호는 거래 ID 로 만든다 — 거래당 하나라 자연히 유일하다.
            orderCode: `picky-ios-${transaction.transactionId}`,
            userId,
            planId: plan.id,
            planName: plan.name,
            months: plan.months,
            amount,
            status: MembershipOrderStatus.PAID,
            store: MembershipStore.APPLE,
            appleTransactionId: transaction.transactionId,
            appleOriginalTransactionId: transaction.originalTransactionId,
            // 내역 화면의 결제수단 자리 — 토스는 '카드' 처럼 한글 표기를 준다.
            method: 'App Store',
            paidAt: transaction.purchasedAt,
            startsAt,
            endsAt: addMonths(startsAt, plan.months),
          },
          select: ORDER_SELECT,
        });
      });
    } catch (error) {
      // 같은 영수증이 거의 동시에 두 번 오면 unique 제약에 걸린다.
      // 먼저 들어간 주문이 있으면 그것이 정답이다.
      const saved = await this.findRedeemed(transaction.transactionId, userId);
      if (saved) return saved;
      throw error;
    }
  }

  /**
   * App Store Server Notifications V2 처리.
   *
   * Apple 이 환불을 승인해도 우리 DB 는 알 수 없다 — 이 알림이 유일한 통로다.
   * 알림을 받지 않으면 환불된 회원이 이용 기간을 그대로 쓰게 된다.
   *
   * **어떤 경우에도 예외를 밖으로 던지지 않는다.** Apple 은 2xx 가 아니면 최대 3일간
   * 재시도하는데, 우리가 처리할 수 없는 알림(자동갱신 구독 이벤트 등)까지 계속 되돌아오면
   * 로그만 더러워진다. 서명 검증 실패만 컨트롤러가 401 로 돌려준다.
   */
  async handleAppleNotification(dto: AppleNotificationDto): Promise<void> {
    // 서명 검증 실패는 그대로 던진다 — Apple 이 보낸 것이 아니므로 재시도할 값이 아니다.
    const notification = await this.apple.verifyNotification(dto.signedPayload);
    const type = notification.notificationType;

    // App Store Connect 의 '알림 테스트' 버튼이 보내는 것 — 주소가 살아 있는지만 확인한다.
    if (type === NotificationTypeV2.TEST) {
      this.logger.log('App Store 알림 연결 테스트를 받았습니다.');
      return;
    }

    // 자동갱신 구독을 쓰지 않으므로 갱신·만료 알림은 할 일이 없다.
    // 다만 무엇이 오는지는 남겨 둔다 — 상품 유형을 바꾸면 여기서 먼저 드러난다.
    if (type !== NotificationTypeV2.REFUND && type !== NotificationTypeV2.REFUND_REVERSED) {
      this.logger.log(`처리하지 않는 App Store 알림: ${type ?? 'UNKNOWN'}`);
      return;
    }

    const signed = notification.data?.signedTransactionInfo;
    if (!signed) {
      this.logger.warn(`${type} 알림에 거래 정보가 없습니다.`);
      return;
    }

    const transaction = await this.apple.decodeTransaction(signed);
    const order = await this.prisma.membershipOrder.findUnique({
      where: { appleTransactionId: transaction.transactionId },
      select: { id: true, userId: true, status: true },
    });

    if (!order) {
      // 적립 전에 환불됐거나 다른 환경(Sandbox↔Production)의 거래다. 되살릴 주문이 없다.
      this.logger.warn(
        `${type} 알림에 해당하는 주문이 없습니다: transactionId=${transaction.transactionId}`,
      );
      return;
    }

    const refunded = type === NotificationTypeV2.REFUND;

    await this.prisma.$transaction(async (tx) => {
      await tx.membershipOrder.update({
        where: { id: order.id },
        data: refunded
          ? {
              status: MembershipOrderStatus.REFUNDED,
              refundedAt: transaction.revokedAt ?? new Date(),
            }
          : // REFUND_REVERSED — Apple 이 환불을 취소했다. 기간을 되돌려 준다.
            { status: MembershipOrderStatus.PAID, refundedAt: null },
      });

      await this.rebuildPeriods(order.userId, tx);
    });

    this.logger.log(`${type} 반영: orderId=${order.id} userId=${order.userId}`);
  }

  /**
   * 사용자의 이용 기간을 처음부터 다시 계산한다.
   *
   * 구매는 "결제 시점과 남은 기간 중 나중 쪽에 개월 수를 더한다" 로 이어 붙였다. 각 주문이
   * 결제 시각을 들고 있으므로, 환불된 주문만 빼고 결제 순서대로 그 계산을 다시 밟으면
   * 처음과 같은 결과가 나온다.
   *
   * **환불된 주문 한 건만 손대면 안 된다.** 이용권 유효 여부는 `max(endsAt)` 로 보는데,
   * 중간 주문이 환불돼도 뒤 주문의 endsAt 이 그대로 남아 기간이 전혀 줄지 않는다.
   */
  private async rebuildPeriods(userId: string, tx: Prisma.TransactionClient) {
    const orders = await tx.membershipOrder.findMany({
      where: { userId, status: MembershipOrderStatus.PAID },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        months: true,
        paidAt: true,
        createdAt: true,
        startsAt: true,
        endsAt: true,
      },
    });

    let previousEnd: Date | null = null;

    for (const order of orders) {
      // paidAt 은 PAID 면 항상 있지만, 타입이 optional 이라 생성 시각으로 대비해 둔다.
      const paidAt = order.paidAt ?? order.createdAt;
      const startsAt = previousEnd && previousEnd > paidAt ? previousEnd : paidAt;
      const endsAt = addMonths(startsAt, order.months);
      previousEnd = endsAt;

      // 값이 그대로면 건드리지 않는다 — 환불 한 건에 모든 주문을 다시 쓸 이유가 없다.
      if (
        order.startsAt?.getTime() === startsAt.getTime() &&
        order.endsAt?.getTime() === endsAt.getTime()
      ) {
        continue;
      }

      await tx.membershipOrder.update({ where: { id: order.id }, data: { startsAt, endsAt } });
    }
  }

  /**
   * 이미 적립한 App Store 거래인지 확인한다.
   *
   * 한 Apple 계정으로 산 영수증을 다른 picky 계정에 넣으려는 경우를 막는다 —
   * 기기를 빌려 로그인만 바꾸면 같은 영수증을 다시 보낼 수 있다.
   */
  private async findRedeemed(appleTransactionId: string, userId: string) {
    const order = await this.prisma.membershipOrder.findUnique({
      where: { appleTransactionId },
      select: { id: true, userId: true },
    });
    if (!order) return null;
    if (order.userId !== userId) {
      throw new BadRequestException('이미 다른 계정에 사용된 결제입니다.');
    }
    return this.getOrder(order.id);
  }

  private getOrder(id: string) {
    return this.prisma.membershipOrder.findUniqueOrThrow({ where: { id }, select: ORDER_SELECT });
  }
}

/**
 * 개월 수를 더한다.
 *
 * `setMonth` 는 1월 31일 + 1개월을 3월 3일로 넘겨 버리므로, 날짜가 작아졌으면
 * 이전 달의 말일로 당긴다 (1/31 + 1개월 = 2/28).
 */
function addMonths(base: Date, months: number): Date {
  const date = new Date(base);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() < day) date.setDate(0);
  return date;
}
