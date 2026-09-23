import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChallengesService } from '../challenges/challenges.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BUCKET, SupabaseService } from '../common/supabase/supabase.service';
import type { UploadedImage } from '../common/types/uploaded-image';
import { ChallengeGroupStatus } from '../generated/prisma/enums';
import type { ChallengeSlotDto } from './dto/challenge-slot.dto';
import type { ListChallengeGroupsDto } from './dto/list-challenge-groups.dto';
import type { StartChallengeGroupDto } from './dto/start-challenge-group.dto';

/** 그룹 하나에 담을 수 있는 챌린지 수 */
export const MAX_CHALLENGES_PER_GROUP = 5;

/** 인증 사진 — 클라이언트에서 압축해 올리므로 여유 있게 잡는다 */
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/** 내역 한 페이지 기본 크기 */
const DEFAULT_HISTORY_TAKE = 20;

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
  // 보관한 콜라주가 있는지 — '완료한 챌린지' 목록이 내려받기 버튼을 붙이는 데 쓴다.
  // 유료 회원이 내려받았을 때만 생긴다 (없으면 null).
  collage: { select: { id: true, createdAt: true } },
  // 관계를 select 로 함께 가져와 N+1 을 만들지 않는다.
  items: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      completedAt: true,
      // 경로만 내려준다 — 읽기용 URL 은 필요할 때 signed URL 로 따로 발급한다.
      proofImagePath: true,
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
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * 진행 중인 그룹 전부 (카테고리당 최대 하나, 최신 시작순).
   * 메인 화면이 카드마다 '진행중' 배지와 진행바를 그리는 데 쓴다.
   * `@@index([userId, status])` 가 커버한다.
   */
  active(userId: string) {
    return this.prisma.challengeGroup.findMany({
      where: { userId, status: ChallengeGroupStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      select: GROUP_FIELDS,
    });
  }

  /**
   * 한 카테고리의 진행 중 그룹 (없으면 null).
   * `@@index([userId, categoryId, status])` 가 커버한다.
   */
  private activeInCategory(userId: string, categoryId: string) {
    return this.prisma.challengeGroup.findFirst({
      where: { userId, categoryId, status: ChallengeGroupStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      select: GROUP_FIELDS,
    });
  }

  /**
   * 그룹 하나 — 상태를 가리지 않는다 (끝난 그룹도 돌려준다).
   * 콜라주에서 뒤로 가 마지막 챌린지 화면을 다시 볼 때 쓴다.
   * `userId` 를 조건에 함께 넣어 남의 그룹은 404 가 된다.
   */
  async one(userId: string, id: string) {
    const group = await this.prisma.challengeGroup.findFirst({
      where: { id, userId },
      select: GROUP_FIELDS,
    });
    if (!group) throw new NotFoundException('챌린지 그룹을 찾을 수 없습니다.');
    return group;
  }

  /**
   * 완료한 챌린지 내역 (커서 기반, 최신순).
   *
   * `@@index([userId, createdAt])` 가 선행 컬럼과 정렬을 그대로 커버하고, status 는 그 안에서
   * 걸러지는 잔여 조건이다 — 한 사용자의 그룹은 많아도 수십 건이라 별도 인덱스를 두지 않는다.
   */
  async history(userId: string, { cursor, take = DEFAULT_HISTORY_TAKE }: ListChallengeGroupsDto) {
    const rows = await this.prisma.challengeGroup.findMany({
      where: { userId, status: ChallengeGroupStatus.COMPLETED },
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: GROUP_FIELDS,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  /**
   * 그룹 시작 — 카테고리를 고르는 것이 곧 시작이다.
   * 그룹을 만들고 첫 챌린지를 하나 담는다.
   *
   * 진행 중 그룹은 **카테고리마다** 하나씩 가질 수 있다. 따라서 충돌 판정도
   * 같은 카테고리에 대해서만 한다 — 다른 카테고리가 진행 중이어도 새로 시작할 수 있다.
   * 같은 카테고리가 이미 진행 중이면 409 로 알리고, restart 가 오면 그것을 종료한 뒤 새로 만든다.
   */
  async start(userId: string, { categoryId, restart }: StartChallengeGroupDto) {
    const current = await this.activeInCategory(userId, categoryId);

    if (current && !restart) {
      // 앱이 '이어서 할지 새로 시작할지' 를 물을 수 있도록 진행 중인 그룹을 함께 돌려준다.
      throw new ConflictException({
        message: '이 카테고리에 이미 진행 중인 챌린지 그룹이 있습니다.',
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
  /**
   * 다시 뽑기 — 그 칸의 챌린지만 바꾼다 (번호·완료 여부·사진은 그대로).
   *
   * 이미 끝낸 칸도 바꿀 수 있다. 완료를 풀지는 않는데, 앞선 칸이 다시 미완료가 되면
   * '진행 중인 칸' 이 뒤로 밀려 그룹의 진행 상태가 꼬이기 때문이다.
   */
  async redraw(userId: string, id: string, { position }: ChallengeSlotDto = {}) {
    const group = await this.requireInProgress(userId, id);
    const target = targetItem(group.items, position);

    const next = await this.challenges.random({
      categoryId: group.categoryId,
      excludeIds: group.items.map((item) => item.challengeId),
    });

    await this.prisma.challengeGroupItem.update({
      where: { id: target.id },
      data: { challengeId: next.id },
    });

    return this.byId(id);
  }

  /**
   * 현재 챌린지 완료 → 다음 칸으로 넘어간다.
   * 인증 사진이 올라와 있어야 한다.
   * 마지막 칸(5번째)을 완료하면 그룹 전체가 완료된다.
   * 더 뽑을 챌린지가 남지 않은 경우에도 그룹을 완료로 닫는다 (빈 칸으로 멈추지 않게).
   */
  async completeCurrent(userId: string, id: string, { position }: ChallengeSlotDto = {}) {
    const group = await this.requireInProgress(userId, id);
    const current = targetItem(group.items, position);

    // 인증 사진이 있어야 완료할 수 있다 — 5칸이 모두 사진을 갖게 되므로
    // 마지막에 콜라주에 넣을 5장이 항상 확보된다.
    if (!current.proofImagePath) {
      throw new BadRequestException('인증 사진을 올려야 완료할 수 있습니다.');
    }

    // 이미 끝낸 칸을 다시 등록한 경우 — 사진은 업로드 때 이미 저장됐고 새로 뽑을 것도 없다.
    // 화면은 이 응답을 받아 진행 중인 칸으로 돌아간다.
    if (current.completedAt !== null) {
      return this.byId(id);
    }

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

  /**
   * 그만두기 — 완료하지 않고 그룹을 닫는다 (완료는 completeCurrent 가 담당한다).
   * 콜라주를 만들지 않으므로 올려둔 인증 사진은 여기서 전부 버린다.
   */
  async end(userId: string, id: string) {
    await this.requireInProgress(userId, id);
    await this.discardProofs(id);

    return this.prisma.challengeGroup.update({
      where: { id },
      data: { status: ChallengeGroupStatus.ENDED, endedAt: new Date() },
      select: GROUP_FIELDS,
    });
  }

  /**
   * 현재 칸의 인증 사진 업로드.
   * 이미 올린 사진이 있으면 교체하고 이전 파일은 버린다.
   */
  async uploadProof(
    userId: string,
    id: string,
    file: UploadedImage | undefined,
    { position }: ChallengeSlotDto = {},
  ) {
    if (!file) throw new BadRequestException('이미지 파일이 필요합니다.');

    const ext = ALLOWED_PROOF_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('PNG · JPG · WebP 이미지만 올릴 수 있습니다.');
    if (file.size > MAX_PROOF_BYTES) {
      throw new BadRequestException('이미지는 5MB 이하만 올릴 수 있습니다.');
    }

    const group = await this.requireInProgress(userId, id);
    const current = targetItem(group.items, position);

    // 파일명은 서버가 정한다 — 원본 이름을 쓰면 경로 조작·덮어쓰기 위험이 있다.
    const path = `${id}/${current.position}-${randomUUID()}${ext}`;
    await this.supabase.uploadTo(BUCKET.proofs, path, file.buffer, file.mimetype);

    const previous = current.proofImagePath;
    await this.prisma.challengeGroupItem.update({
      where: { id: current.id },
      data: { proofImagePath: path },
    });
    if (previous) await this.supabase.removeFrom(BUCKET.proofs, [previous]);

    return this.byId(id);
  }

  /**
   * 콜라주를 만들기 위한 인증 사진 읽기 주소.
   * private 버킷이라 짧은 signed URL 을 그때그때 발급한다 (DB 에 저장하지 않는다).
   */
  async proofUrls(userId: string, id: string) {
    const group = await this.prisma.challengeGroup.findFirst({
      where: { id, userId },
      select: {
        items: {
          orderBy: { position: 'asc' },
          select: { position: true, proofImagePath: true },
        },
      },
    });
    if (!group) throw new NotFoundException('챌린지 그룹을 찾을 수 없습니다.');

    const withProof = group.items.filter(
      (item): item is { position: number; proofImagePath: string } => item.proofImagePath !== null,
    );

    return Promise.all(
      withProof.map(async (item) => ({
        position: item.position,
        url: await this.supabase.createSignedUrl(BUCKET.proofs, item.proofImagePath),
      })),
    );
  }

  /**
   * 인증 사진 버리기 — 콜라주를 만든 뒤 클라이언트가 호출한다.
   * 사진은 영구 보관하지 않으므로 콜라주가 만들어지면 원본을 남기지 않는다.
   */
  async discardProofs(id: string, userId?: string) {
    const items = await this.prisma.challengeGroupItem.findMany({
      where: {
        groupId: id,
        proofImagePath: { not: null },
        ...(userId ? { group: { userId } } : {}),
      },
      select: { id: true, proofImagePath: true },
    });

    if (items.length === 0) return { removed: 0 };

    await this.supabase.removeFrom(
      BUCKET.proofs,
      items.map((item) => item.proofImagePath!),
    );
    await this.prisma.challengeGroupItem.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { proofImagePath: null },
    });

    return { removed: items.length };
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
          select: {
            id: true,
            position: true,
            challengeId: true,
            completedAt: true,
            proofImagePath: true,
          },
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
/**
 * 다룰 칸을 고른다.
 *
 * `position` 이 없으면 진행 중인 칸(지금까지의 동작)이고, 있으면 그 번호의 칸이다.
 * 아직 뽑지 않은 칸은 존재하지 않으므로 404 가 된다 — 앞선 칸을 건너뛰고 손댈 수 없다.
 */
function targetItem<T extends { position: number; completedAt: Date | null }>(
  items: T[],
  position?: number,
): T {
  if (position === undefined) return currentItem(items);

  const item = items.find((candidate) => candidate.position === position);
  if (!item) {
    throw new NotFoundException('아직 열리지 않은 챌린지입니다.');
  }
  return item;
}

function currentItem<T extends { completedAt: Date | null }>(items: T[]): T {
  const current = items.find((item) => item.completedAt === null);
  if (!current) {
    // 진행 중 그룹이라면 완료되지 않은 칸이 반드시 하나 있다.
    throw new ConflictException('진행 중인 챌린지가 없습니다.');
  }
  return current;
}
