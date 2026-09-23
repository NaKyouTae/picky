import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NoticeStatus } from '../../generated/prisma/enums';
import type { CreateNoticeDto } from './dto/create-notice.dto';
import type { ListAdminNoticesDto } from './dto/list-admin-notices.dto';
import type { UpdateNoticeDto } from './dto/update-notice.dto';

const DEFAULT_TAKE = 20;

export interface AdminNoticeRow {
  id: string;
  title: string;
  content: string;
  status: NoticeStatus;
  isPinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminNoticePage {
  items: AdminNoticeRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

/** 목록/단건 모두 같은 형태로 내려주기 위한 공통 select */
const NOTICE_SELECT = {
  id: true,
  title: true,
  content: true,
  status: true,
  isPinned: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminNoticesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 공지 목록 (커서 기반).
   *
   * 어드민은 작성 순서로 보는 게 편하므로 게시 시각이 아니라 createdAt 역순 + id 보조 키다.
   * 상태 필터는 `@@index([status, createdAt])` 가 커버한다.
   */
  async list({
    q,
    status,
    cursor,
    take = DEFAULT_TAKE,
  }: ListAdminNoticesDto): Promise<AdminNoticePage> {
    const where = {
      ...(status ? { status } : {}),
      // 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면 pg_trgm GIN 을 고려할 것.
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    const rows = await this.prisma.notice.findMany({
      where,
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: NOTICE_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  async get(id: string): Promise<AdminNoticeRow> {
    const notice = await this.prisma.notice.findUnique({ where: { id }, select: NOTICE_SELECT });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return notice;
  }

  create(dto: CreateNoticeDto): Promise<AdminNoticeRow> {
    const status = dto.status ?? NoticeStatus.DRAFT;

    return this.prisma.notice.create({
      data: {
        title: dto.title,
        content: dto.content,
        status,
        isPinned: dto.isPinned ?? false,
        publishedAt: this.resolvePublishedAt(status, toDate(dto.publishedAt)),
      },
      select: NOTICE_SELECT,
    });
  }

  async update(id: string, dto: UpdateNoticeDto): Promise<AdminNoticeRow> {
    // 존재하지 않는 id 를 Prisma 오류(P2025) 대신 404 로 돌려준다.
    // 게시 시각을 채울지 판단하려면 바뀐 뒤의 상태를 알아야 해서 지금 값도 함께 읽는다.
    const current = await this.get(id);

    const status = dto.status ?? current.status;
    // 생략(undefined)은 "그대로 두기", null 은 "비우기" 다.
    const given = dto.publishedAt === undefined ? current.publishedAt : toDate(dto.publishedAt);

    return this.prisma.notice.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        ...(dto.isPinned === undefined ? {} : { isPinned: dto.isPinned }),
        publishedAt: this.resolvePublishedAt(status, given),
      },
      select: NOTICE_SELECT,
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.get(id);
    await this.prisma.notice.delete({ where: { id } });
    return { id };
  }

  /**
   * 게시 시각을 정한다.
   *
   * 공개로 바꾸면서 시각을 비워 두면 그 순간을 넣는다 — 앱 목록이 `published_at <= now()` 로
   * 거르기 때문에, 비어 있으면 공개해도 아무에게도 보이지 않는다.
   * 공개가 아닌 상태에서는 넣어 둔 값을 건드리지 않는다 (다시 공개하면 원래 날짜로 돌아간다).
   */
  private resolvePublishedAt(status: NoticeStatus, publishedAt: Date | null): Date | null {
    if (status === NoticeStatus.PUBLISHED && !publishedAt) return new Date();
    return publishedAt;
  }
}

/** ISO 문자열(또는 null)을 Date 로 — DTO 가 IsDateString 으로 형식을 이미 검증했다 */
function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
