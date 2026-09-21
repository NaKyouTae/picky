import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ChallengeStatus } from '../../generated/prisma/enums';
import type { CreateChallengeDto } from './dto/create-challenge.dto';
import type { ListAdminChallengesDto } from './dto/list-admin-challenges.dto';
import type { UpdateChallengeDto } from './dto/update-challenge.dto';

const DEFAULT_TAKE = 20;

export interface AdminChallengeRow {
  id: string;
  categoryId: string;
  /** 목록에서 카테고리 이름을 바로 그릴 수 있게 함께 내려준다 */
  category: { id: string; name: string; emoji: string | null };
  status: ChallengeStatus;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminChallengePage {
  items: AdminChallengeRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

/** 목록/단건 모두 같은 형태로 내려주기 위한 공통 select */
const CHALLENGE_SELECT = {
  id: true,
  categoryId: true,
  // 관계를 select 로 함께 가져와 N+1 을 만들지 않는다.
  category: { select: { id: true, name: true, emoji: true } },
  status: true,
  title: true,
  description: true,
  duration: true,
  emoji: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 챌린지 목록 (커서 기반).
   * 정렬은 createdAt 역순 + id 보조 키. 상태 필터는 `@@index([status, createdAt])` 가 커버한다.
   */
  async list({
    q,
    categoryId,
    status,
    cursor,
    take = DEFAULT_TAKE,
  }: ListAdminChallengesDto): Promise<AdminChallengePage> {
    const where = {
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      // 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면 pg_trgm GIN 을 고려할 것.
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    const rows = await this.prisma.challenge.findMany({
      where,
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: CHALLENGE_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  async get(id: string): Promise<AdminChallengeRow> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      select: CHALLENGE_SELECT,
    });
    if (!challenge) throw new NotFoundException('챌린지를 찾을 수 없습니다.');
    return challenge;
  }

  create(dto: CreateChallengeDto): Promise<AdminChallengeRow> {
    return this.prisma.challenge.create({ data: dto, select: CHALLENGE_SELECT });
  }

  async update(id: string, dto: UpdateChallengeDto): Promise<AdminChallengeRow> {
    // 존재하지 않는 id 를 Prisma 오류(P2025) 대신 404 로 돌려준다.
    await this.get(id);
    return this.prisma.challenge.update({ where: { id }, data: dto, select: CHALLENGE_SELECT });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.challenge.delete({ where: { id } });
  }
}
