import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChallengeStatus } from '../generated/prisma/enums';
import type { RandomChallengeDto } from './dto/random-challenge.dto';

export interface PublicChallenge {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
}

/** 앱 메인 화면에 나열되는 카테고리 */
export interface PublicChallengeCategory {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  /** 이 카테고리의 공개 챌린지 수 — 0 이면 앱에서 "준비 중" 으로 표시한다 */
  challengeCount: number;
}

const PUBLIC_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  description: true,
  duration: true,
  emoji: true,
} as const;

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 앱에 나열할 카테고리 목록.
   * 공개 챌린지 수는 _count 로 한 번에 받아 카테고리마다 count 를 도는 N+1 을 만들지 않는다.
   */
  async categories(): Promise<PublicChallengeCategory[]> {
    const rows = await this.prisma.challengeCategory.findMany({
      where: { status: ChallengeStatus.PUBLISHED },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        emoji: true,
        description: true,
        _count: { select: { challenges: { where: { status: ChallengeStatus.PUBLISHED } } } },
      },
    });

    return rows.map(({ _count, ...category }) => ({
      ...category,
      challengeCount: _count.challenges,
    }));
  }

  /**
   * 카테고리 안에서 공개 챌린지 하나를 랜덤으로 뽑는다.
   *
   * `ORDER BY random()` 은 매번 전체를 정렬하므로 쓰지 않는다. 대신
   * `@@index([categoryId, status])` 로 후보 id 만 훑은 뒤(행당 16바이트) 하나를 골라
   * 단건 조회한다 — 챌린지 수는 관리자가 등록하는 규모라 이 정도면 충분하다.
   */
  async random({ categoryId, excludeIds }: RandomChallengeDto): Promise<PublicChallenge> {
    const candidates = await this.prisma.challenge.findMany({
      where: {
        categoryId,
        status: ChallengeStatus.PUBLISHED,
        // 그룹에 이미 담긴 챌린지는 다시 뽑히지 않는다.
        ...(excludeIds?.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      throw new NotFoundException('더 뽑을 챌린지가 없습니다.');
    }

    const picked = candidates[randomInt(candidates.length)];
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: picked.id },
      select: PUBLIC_SELECT,
    });

    // 뽑은 직후 관리자가 삭제/비공개로 바꾼 극히 드문 경우
    if (!challenge) throw new NotFoundException('더 뽑을 챌린지가 없습니다.');
    return challenge;
  }
}
