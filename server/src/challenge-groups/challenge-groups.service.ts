import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChallengeGroupStatus } from '../generated/prisma/enums';
import type { FinishChallengeGroupDto } from './dto/finish-challenge-group.dto';
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
   * 다음 챌린지 뽑기.
   * 그룹에 이미 담긴 챌린지는 제외하고 뽑아 같은 게 두 번 나오지 않는다.
   * 5개가 차면 더 뽑을 수 없다.
   */
  async drawNext(userId: string, id: string) {
    const group = await this.requireInProgress(userId, id);

    if (group.items.length >= MAX_CHALLENGES_PER_GROUP) {
      throw new ConflictException(
        `한 그룹에는 챌린지를 ${MAX_CHALLENGES_PER_GROUP}개까지만 담을 수 있습니다.`,
      );
    }

    const next = await this.challenges.random({
      categoryId: group.categoryId,
      excludeIds: group.items.map((item) => item.challengeId),
    });

    await this.prisma.challengeGroupItem.create({
      data: {
        groupId: id,
        challengeId: next.id,
        position: group.items.length + 1,
      },
    });

    return this.prisma.challengeGroup.findUniqueOrThrow({
      where: { id },
      select: GROUP_FIELDS,
    });
  }

  /** 완료하거나 그만두기 — 진행 중인 그룹에만 적용된다 */
  async finish(userId: string, id: string, { status }: FinishChallengeGroupDto) {
    await this.requireInProgress(userId, id);
    const now = new Date();

    return this.prisma.challengeGroup.update({
      where: { id },
      data:
        status === 'COMPLETED'
          ? { status: ChallengeGroupStatus.COMPLETED, completedAt: now }
          : { status: ChallengeGroupStatus.ENDED, endedAt: now },
      select: GROUP_FIELDS,
    });
  }

  /** 남의 그룹을 건드리지 못하도록 userId 까지 조건에 넣어 조회한다 */
  private async requireInProgress(userId: string, id: string) {
    const group = await this.prisma.challengeGroup.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        categoryId: true,
        items: { select: { challengeId: true } },
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
