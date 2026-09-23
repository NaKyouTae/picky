import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import type { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';

/** 목록/단건 모두 같은 형태로 내려주기 위한 공통 select */
const PLAN_SELECT = {
  id: true,
  name: true,
  months: true,
  price: true,
  description: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminMembershipPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 전체 목록 — 회원권은 몇 개 수준이라 페이지네이션 없이 앱과 같은 순서로 내려준다.
   * `@@index([isActive, displayOrder, months])` 가 앱 조회를 커버하고, 여기서는 전량 스캔이라도 무해하다.
   */
  list() {
    return this.prisma.membershipPlan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { months: 'asc' }, { createdAt: 'asc' }],
      select: PLAN_SELECT,
    });
  }

  async get(id: string) {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id },
      select: PLAN_SELECT,
    });
    if (!plan) throw new NotFoundException('회원권을 찾을 수 없습니다.');
    return plan;
  }

  create(dto: CreateMembershipPlanDto) {
    return this.prisma.membershipPlan.create({ data: dto, select: PLAN_SELECT });
  }

  async update(id: string, dto: UpdateMembershipPlanDto) {
    // 존재하지 않는 id 를 Prisma 오류(P2025) 대신 404 로 돌려준다.
    await this.get(id);
    return this.prisma.membershipPlan.update({ where: { id }, data: dto, select: PLAN_SELECT });
  }

  /**
   * 삭제.
   *
   * 구매 기록이 생기면(다음 단계) 지난 구매가 가리키는 플랜이 사라지면 안 되므로,
   * 그때는 이 메서드가 구매 수를 확인해 막고 `isActive: false`(판매 중단)로 안내해야 한다.
   * 지금은 플랜을 참조하는 테이블이 없어 그대로 지운다.
   */
  async remove(id: string) {
    await this.get(id);
    await this.prisma.membershipPlan.delete({ where: { id } });
    return { id };
  }
}
