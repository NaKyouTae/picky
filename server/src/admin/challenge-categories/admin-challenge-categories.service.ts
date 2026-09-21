import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateChallengeCategoryDto } from './dto/create-challenge-category.dto';
import type { UpdateChallengeCategoryDto } from './dto/update-challenge-category.dto';

const CATEGORY_FIELDS = {
  id: true,
  name: true,
  emoji: true,
  description: true,
  status: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
  // 카테고리를 지울 수 있는지 어드민이 판단할 수 있게 연결 수를 함께 준다
  _count: { select: { challenges: true, groups: true } },
} as const;

@Injectable()
export class AdminChallengeCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 전체 목록 — 카테고리는 수가 적어 페이지네이션 없이 정렬해 내려준다 */
  list() {
    return this.prisma.challengeCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: CATEGORY_FIELDS,
    });
  }

  async get(id: string) {
    const category = await this.prisma.challengeCategory.findUnique({
      where: { id },
      select: CATEGORY_FIELDS,
    });
    if (!category) throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    return category;
  }

  create(dto: CreateChallengeCategoryDto) {
    return this.prisma.challengeCategory.create({ data: dto, select: CATEGORY_FIELDS });
  }

  async update(id: string, dto: UpdateChallengeCategoryDto) {
    await this.get(id);
    return this.prisma.challengeCategory.update({
      where: { id },
      data: dto,
      select: CATEGORY_FIELDS,
    });
  }

  /**
   * 삭제 — 연결된 챌린지나 그룹이 있으면 막는다.
   * (FK 가 RESTRICT 라 DB 에서도 막히지만, 여기서 먼저 걸러 이유를 알려 준다)
   */
  async remove(id: string) {
    const category = await this.get(id);

    if (category._count.challenges > 0 || category._count.groups > 0) {
      throw new ConflictException(
        '이 카테고리를 쓰는 챌린지나 참여 기록이 있어 삭제할 수 없습니다. 보관(ARCHIVED)으로 바꿔 주세요.',
      );
    }

    await this.prisma.challengeCategory.delete({ where: { id } });
    return { id };
  }
}
