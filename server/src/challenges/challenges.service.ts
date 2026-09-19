import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChallengeCategory, ChallengeStatus } from '../generated/prisma/enums';
import type { RandomChallengeDto } from './dto/random-challenge.dto';

export interface PublicChallenge {
  id: string;
  category: ChallengeCategory;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
}

export interface ChallengeCategorySummary {
  category: ChallengeCategory;
  /** 공개된 챌린지 수 — 0 이면 앱에서 "준비 중" 으로 표시한다 */
  count: number;
}

const PUBLIC_SELECT = {
  id: true,
  category: true,
  title: true,
  description: true,
  duration: true,
  emoji: true,
} as const;

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 카테고리별 공개 챌린지 수.
   * groupBy 한 번으로 세 카테고리를 모두 받아 N+1 (카테고리마다 count) 을 만들지 않는다.
   */
  async categorySummary(): Promise<ChallengeCategorySummary[]> {
    const grouped = await this.prisma.challenge.groupBy({
      by: ['category'],
      where: { status: ChallengeStatus.PUBLISHED },
      _count: { _all: true },
    });

    const counts = new Map(grouped.map((row) => [row.category, row._count._all]));
    // 아직 등록이 없는 카테고리도 0 으로 내려줘야 앱이 항상 세 칸을 그릴 수 있다.
    return Object.values(ChallengeCategory).map((category) => ({
      category,
      count: counts.get(category) ?? 0,
    }));
  }

  /**
   * 카테고리 안에서 공개 챌린지 하나를 랜덤으로 뽑는다.
   *
   * `ORDER BY random()` 은 매번 전체를 정렬하므로 쓰지 않는다. 대신
   * `@@index([category, status])` 로 후보 id 만 훑은 뒤(행당 36바이트) 하나를 골라
   * 단건 조회한다 — 챌린지 수는 관리자가 등록하는 규모라 이 정도면 충분하다.
   */
  async random({ category, excludeId }: RandomChallengeDto): Promise<PublicChallenge> {
    const candidates = await this.prisma.challenge.findMany({
      where: { category, status: ChallengeStatus.PUBLISHED },
      select: { id: true },
    });

    // 후보가 하나뿐이면 제외 조건을 무시한다 (뽑을 게 없어지므로).
    const pool =
      excludeId && candidates.length > 1
        ? candidates.filter((row) => row.id !== excludeId)
        : candidates;

    if (pool.length === 0) {
      throw new NotFoundException('아직 등록된 챌린지가 없습니다.');
    }

    const picked = pool[randomInt(pool.length)];
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: picked.id },
      select: PUBLIC_SELECT,
    });

    // 뽑은 직후 관리자가 삭제/비공개로 바꾼 극히 드문 경우
    if (!challenge) throw new NotFoundException('아직 등록된 챌린지가 없습니다.');
    return challenge;
  }
}
