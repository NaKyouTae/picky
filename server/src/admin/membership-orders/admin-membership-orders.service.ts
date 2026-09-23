import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MembershipOrderStatus } from '../../generated/prisma/enums';
import type { ListAdminMembershipOrdersDto } from './dto/list-admin-membership-orders.dto';

const DEFAULT_TAKE = 20;

/** 목록에 필요한 만큼만 — 구매자는 이름·이메일만 함께 가져온다 (N+1 없이 한 쿼리로) */
const ORDER_SELECT = {
  id: true,
  orderCode: true,
  planName: true,
  months: true,
  amount: true,
  status: true,
  method: true,
  paymentKey: true,
  paidAt: true,
  failReason: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

/**
 * 모든 사용자의 회원권 결제 내역 (읽기 전용).
 * 환불을 다루지 않으므로 상태를 바꾸는 API 는 두지 않는다.
 */
@Injectable()
export class AdminMembershipOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 결제 내역 (커서 기반, 최신순).
   * 상태 필터는 `@@index([status, createdAt])`, 필터가 없을 때는 `@@index([createdAt])` 가 정렬을 커버한다.
   * 같은 시각이 있어도 순서가 흔들리지 않도록 id 를 보조 키로 둔다.
   */
  async list({ q, status, active, cursor, take = DEFAULT_TAKE }: ListAdminMembershipOrdersDto) {
    const where = {
      ...(status ? { status } : {}),
      // 이용 중 = 승인됐고 종료일이 아직 남은 건. `@@index([userId, status, endsAt])` 가 아니라
      // 여기서는 사용자 구분 없이 훑으므로 status 인덱스로 좁힌 뒤 종료일을 거른다.
      ...(active === 'true'
        ? { status: MembershipOrderStatus.PAID, endsAt: { gt: new Date() } }
        : {}),
      // 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면 pg_trgm GIN 을 고려할 것.
      ...(q
        ? {
            OR: [
              { orderCode: { contains: q, mode: 'insensitive' as const } },
              { planName: { contains: q, mode: 'insensitive' as const } },
              { user: { name: { contains: q, mode: 'insensitive' as const } } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.membershipOrder.findMany({
      where,
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

  /** 상단 요약 — 승인된 결제의 건수와 매출 합계 (환불이 없으므로 PAID 합계가 곧 매출이다) */
  async summary() {
    const [paid, pending, failed] = await Promise.all([
      this.prisma.membershipOrder.aggregate({
        where: { status: MembershipOrderStatus.PAID },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.membershipOrder.count({ where: { status: MembershipOrderStatus.PENDING } }),
      this.prisma.membershipOrder.count({ where: { status: MembershipOrderStatus.FAILED } }),
    ]);

    return {
      paidCount: paid._count._all,
      paidAmount: paid._sum.amount ?? 0,
      pendingCount: pending,
      failedCount: failed,
    };
  }
}
