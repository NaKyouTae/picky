import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NoticeStatus } from '../generated/prisma/enums';
import type { ListNoticesDto } from './dto/list-notices.dto';

const DEFAULT_TAKE = 20;

/**
 * 목록 한 줄.
 *
 * 본문까지 함께 내려준다 — 앱은 카드를 펼쳐서 그 자리에서 읽고 상세 화면으로 가지 않는다
 * (Figma 4694:5690). 관리자가 쓰는 글 수십 건이라 한 페이지를 통째로 보내도 가볍다.
 */
export interface PublicNoticeRow {
  id: string;
  title: string;
  /** 서식 없는 글 — 줄바꿈만 살려 보여준다 */
  content: string;
  isPinned: boolean;
  /** 공개된 공지는 반드시 게시 시각이 있다 (목록 조건이 published_at 을 본다) */
  publishedAt: Date;
  /** 이 사용자가 펼쳐 읽은 적이 있는지 — false 면 목록에 (New) 가 붙는다 */
  isRead: boolean;
}

export interface PublicNoticePage {
  items: PublicNoticeRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

/** 마이페이지 '공지사항' 메뉴에 점을 붙일지 */
export interface NoticeUnreadStatus {
  hasUnread: boolean;
}

const ROW_SELECT = {
  id: true,
  title: true,
  content: true,
  isPinned: true,
  publishedAt: true,
} as const;

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 공개된 공지 목록 (커서 기반).
   *
   * 고정 공지를 위로 올린 뒤 게시 시각 역순으로 본다. 정렬 컬럼이 여러 개라
   * 커서는 마지막 행의 id 하나지만, Prisma 가 그 행의 정렬값을 기준으로 이어 읽는다.
   * 선행 컬럼 status 부터 `@@index([status, isPinned, publishedAt])` 가 커버한다.
   */
  async listPublished(
    userId: string,
    { cursor, take = DEFAULT_TAKE }: ListNoticesDto,
  ): Promise<PublicNoticePage> {
    const rows = await this.prisma.notice.findMany({
      where: this.publishedWhere(),
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      select: ROW_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    // 읽음 여부는 이 페이지의 id 를 한 번에 물어 붙인다 (행마다 조회하면 N+1 이다).
    const read = await this.prisma.noticeRead.findMany({
      where: { userId, noticeId: { in: items.map((item) => item.id) } },
      select: { noticeId: true },
    });
    const readIds = new Set(read.map((row) => row.noticeId));

    return {
      items: items.map((row) => ({
        ...row,
        // publishedAt 은 위 조건(lte: now)으로 null 이 걸러지지만 타입은 nullable 이라 좁혀 준다.
        publishedAt: row.publishedAt!,
        isRead: readIds.has(row.id),
      })),
      nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * 아직 펼쳐 보지 않은 공지가 하나라도 있는지 — 마이페이지의 점 하나를 위한 값이다.
   *
   * 개수를 세지 않고 한 건만 찾고 멈춘다 (점에는 숫자가 없다).
   * `reads: { none: ... }` 은 NOT EXISTS 로 나가고, 그 서브쿼리는 `@@unique([userId, noticeId])` 가 받는다.
   */
  async getUnreadStatus(userId: string): Promise<NoticeUnreadStatus> {
    const unread = await this.prisma.notice.findFirst({
      where: { ...this.publishedWhere(), reads: { none: { userId } } },
      select: { id: true },
    });

    return { hasUnread: unread !== null };
  }

  /**
   * 공지 한 건을 읽은 것으로 기록한다 — 앱에서 카드를 펼칠 때 부른다.
   *
   * 같은 공지를 다시 펼쳐도 처음 읽은 때가 사실이므로 이미 있으면 그대로 둔다
   * (`@@unique([userId, noticeId])` 가 중복을 막는다).
   */
  async markRead(userId: string, noticeId: string): Promise<{ id: string }> {
    // 공개되지 않은 공지의 읽음을 만들어 두지 않는다 — 목록에 없는 id 는 거절한다.
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, ...this.publishedWhere() },
      select: { id: true },
    });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');

    await this.prisma.noticeRead.upsert({
      where: { userId_noticeId: { userId, noticeId } },
      create: { userId, noticeId },
      // 이미 읽은 공지는 건드릴 것이 없다 — upsert 를 멱등하게 쓰기 위한 빈 update 다.
      update: {},
    });

    return { id: noticeId };
  }

  /**
   * 앱에 보이는 조건 — 공개 상태이고 게시 시각이 지났을 때.
   * 목록·점·읽음 기록이 모두 같은 조건을 써야 목록에 없는 공지가 다른 길로 새지 않는다.
   */
  private publishedWhere() {
    return { status: NoticeStatus.PUBLISHED, publishedAt: { lte: new Date() } };
  }
}
