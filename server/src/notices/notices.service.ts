import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NoticeStatus } from '../generated/prisma/enums';
import type { ListNoticesDto } from './dto/list-notices.dto';

const DEFAULT_TAKE = 20;

/** 목록 한 줄 — 본문은 싣지 않는다 (공지 하나가 화면 몇 개 분량일 수 있다) */
export interface PublicNoticeRow {
  id: string;
  title: string;
  isPinned: boolean;
  /** 공개된 공지는 반드시 게시 시각이 있다 (목록 조건이 published_at 을 본다) */
  publishedAt: Date;
}

export interface PublicNoticePage {
  items: PublicNoticeRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

export interface PublicNoticeDetail extends PublicNoticeRow {
  /** 서식 없는 글 — 줄바꿈만 살려 보여준다 */
  content: string;
}

const ROW_SELECT = {
  id: true,
  title: true,
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
  async listPublished({ cursor, take = DEFAULT_TAKE }: ListNoticesDto): Promise<PublicNoticePage> {
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

    return {
      // publishedAt 은 위 조건(lte: now)으로 null 이 걸러지지만 타입은 nullable 이라 좁혀 준다.
      items: items.map((row) => ({ ...row, publishedAt: row.publishedAt! })),
      nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /** 공지 단건 — 공개되지 않은(작성 중·보관·예약) 공지는 없는 것으로 본다 */
  async getPublished(id: string): Promise<PublicNoticeDetail> {
    const notice = await this.prisma.notice.findFirst({
      where: { id, ...this.publishedWhere() },
      select: { ...ROW_SELECT, content: true },
    });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return { ...notice, publishedAt: notice.publishedAt! };
  }

  /**
   * 앱에 보이는 조건 — 공개 상태이고 게시 시각이 지났을 때.
   * 목록과 단건이 같은 조건을 써야 목록에 없는 공지를 주소로 열 수 없다.
   */
  private publishedWhere() {
    return { status: NoticeStatus.PUBLISHED, publishedAt: { lte: new Date() } };
  }
}
