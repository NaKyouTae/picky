import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChallengeGroupStatus } from '../generated/prisma/enums';
import type { StartChallengeGroupDto } from './dto/start-challenge-group.dto';

/** 그룹 하나에 담을 수 있는 챌린지 수 */
export const MAX_CHALLENGES_PER_GROUP = 5;

/** 앱이 그룹 화면을 그리는 데 필요한 필드 */
const GROUP_FIELDS = {
  id: true,
  status: true,
  startedAt: true,
  endedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, emoji: true, description: true } },
  // 관계를 select 로 함께 가져와 N+1 을 만들지 않는다.
  items: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      completedAt: true,
      createdAt: true,
      challenge: {
        select: { id: true, title: true, description: true, duration: true, emoji: true },
      },
    },
  },
} as const;

@Injectable()
export class ChallengeGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challenges: ChallengesService,
  ) {}

  /** 진행 중인 그룹 하나 (없으면 null) — `@@index([userId, status])` 가 커버한다 */
  active(userId: string) {
    return this.prisma.challengeGroup.findFirst({
      where: { userId, status: ChallengeGroupStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      select: GROUP_FIELDS,
    });
  }

  /**
   * 그룹 시작 — 카테고리를 고르는 것이 곧 시작이다.
   * 그룹을 만들고 첫 챌린지를 하나 담는다.
   * 진행 중인 그룹이 이미 있으면 409 로 알리고, restart 가 오면 이전 것을 종료한 뒤 새로 만든다.
   */
  async start(userId: string, { categoryId, restart }: StartChallengeGroupDto) {
    const current = await this.active(userId);

    if (current && !restart) {
      // 앱이 '이어서 할지 새로 시작할지' 를 물을 수 있도록 진행 중인 그룹을 함께 돌려준다.
      throw new ConflictException({
        message: '이미 진행 중인 챌린지 그룹이 있습니다.',
        activeGroup: current,
      });
    }

    // 뽑을 챌린지가 없으면 여기서 NotFound 가 올라온다 — 그룹을 만들기 전에 확인된다.
    const first = await this.challenges.random({ categoryId });
    const now = new Date();

    const create = this.prisma.challengeGroup.create({
      data: {
        userId,
        categoryId,
        startedAt: now,
        items: { create: { challengeId: first.id, position: 1 } },
      },
      select: GROUP_FIELDS,
    });

    if (!current) return create;

    // 종료와 생성을 한 트랜잭션으로 묶어 '진행 중이 둘' 인 상태가 생기지 않게 한다.
    const [, created] = await this.prisma.$transaction([
      this.prisma.challengeGroup.update({
        where: { id: current.id },
        data: { status: ChallengeGroupStatus.ENDED, endedAt: now },
      }),
      create,
    ]);

    return created;
  }

  /**
   * 다시 뽑기 — **현재 칸의 챌린지만 교체**한다.
   * 칸(position)은 그대로 두므로 번호가 올라가지 않는다. 새 칸은 완료할 때만 늘어난다.
   * 그룹에 들어 있는 챌린지는 제외하고 뽑아 같은 게 다시 나오지 않는다.
   */
  async redraw(userId: string, id: string) {
    const group = await this.requireInProgress(userId, id);
    const current = currentItem(group.items);

    const next = await this.challenges.random({
      categoryId: group.categoryId,
      excludeIds: group.items.map((item) => item.challengeId),
    });

    await this.prisma.challengeGroupItem.update({
      where: { id: current.id },
      data: { challengeId: next.id },
    });

    return this.byId(id);
  }

  /**
   * 현재 챌린지 완료 → 다음 칸으로 넘어간다.
   * 마지막 칸(5번째)을 완료하면 그룹 전체가 완료된다.
   * 더 뽑을 챌린지가 남지 않은 경우에도 그룹을 완료로 닫는다 (빈 칸으로 멈추지 않게).
   */
  async completeCurrent(userId: string, id: string) {
    const group = await this.requireInProgress(userId, id);
    const current = currentItem(group.items);
    const now = new Date();

    const completeItem = this.prisma.challengeGroupItem.update({
      where: { id: current.id },
      data: { completedAt: now },
    });
    const completeGroup = this.prisma.challengeGroup.update({
      where: { id },
      data: { status: ChallengeGroupStatus.COMPLETED, completedAt: now },
    });

    if (current.position >= MAX_CHALLENGES_PER_GROUP) {
      await this.prisma.$transaction([completeItem, completeGroup]);
      return this.byId(id);
    }

    const next = await this.challenges
      .random({
        categoryId: group.categoryId,
        excludeIds: group.items.map((item) => item.challengeId),
      })
      .catch(() => null);

    if (!next) {
      await this.prisma.$transaction([completeItem, completeGroup]);
      return this.byId(id);
    }

    await this.prisma.$transaction([
      completeItem,
      this.prisma.challengeGroupItem.create({
        data: { groupId: id, challengeId: next.id, position: current.position + 1 },
      }),
    ]);

    return this.byId(id);
  }

  /** 그만두기 — 완료하지 않고 그룹을 닫는다 (완료는 completeCurrent 가 담당한다) */
  async end(userId: string, id: string) {
    await this.requireInProgress(userId, id);

    return this.prisma.challengeGroup.update({
      where: { id },
      data: { status: ChallengeGroupStatus.ENDED, endedAt: new Date() },
      select: GROUP_FIELDS,
    });
  }

  private byId(id: string) {
    return this.prisma.challengeGroup.findUniqueOrThrow({ where: { id }, select: GROUP_FIELDS });
  }

  /** 남의 그룹을 건드리지 못하도록 userId 까지 조건에 넣어 조회한다 */
  private async requireInProgress(userId: string, id: string) {
    const group = await this.prisma.challengeGroup.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        categoryId: true,
        items: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, challengeId: true, completedAt: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('챌린지 그룹을 찾을 수 없습니다.');
    }
    if (group.status !== ChallengeGroupStatus.IN_PROGRESS) {
      throw new ConflictException('이미 끝난 챌린지 그룹입니다.');
    }
    return group;
  }
}

/** 아직 완료하지 않은 칸 = 지금 진행 중인 챌린지 */
function currentItem<T extends { completedAt: Date | null }>(items: T[]): T {
  const current = items.find((item) => item.completedAt === null);
  if (!current) {
    // 진행 중 그룹이라면 완료되지 않은 칸이 반드시 하나 있다.
    throw new ConflictException('진행 중인 챌린지가 없습니다.');
  }
  return current;
}
