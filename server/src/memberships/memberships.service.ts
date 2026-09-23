import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MembershipOrderStatus } from '../generated/prisma/enums';
import type { ConfirmMembershipOrderDto } from './dto/confirm-membership-order.dto';
import type { CreateMembershipOrderDto } from './dto/create-membership-order.dto';
import type { FailMembershipOrderDto } from './dto/fail-membership-order.dto';
import type { ListMyOrdersDto } from './dto/list-my-orders.dto';
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
  description: true,
} as const;

const ORDER_SELECT = {
  id: true,
  orderCode: true,
  planName: true,
  months: true,
  amount: true,
  status: true,
  method: true,
  paidAt: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly toss: TossPaymentsService,
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
