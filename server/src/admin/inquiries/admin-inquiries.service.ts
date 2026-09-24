import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BUCKET, SupabaseService } from '../../common/supabase/supabase.service';
import { InquiryStatus, InquiryType } from '../../generated/prisma/enums';
import type { ListAdminInquiriesDto } from './dto/list-admin-inquiries.dto';
import type { UpdateInquiryDto } from './dto/update-inquiry.dto';

const DEFAULT_TAKE = 20;

export interface AdminInquiryRow {
  id: string;
  type: InquiryType;
  content: string;
  email: string;
  status: InquiryStatus;
  adminNote: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** 보낸 사람 — 탈퇴해도 행이 남으므로(소프트 삭제) 늘 채워진다 */
  user: { id: string; name: string; email: string | null };
  /** 첨부 사진 수 — 목록에서는 개수만 보여주고 실물은 상세에서 연다 */
  imageCount: number;
}

export interface AdminInquiryPage {
  items: AdminInquiryRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

/** 첨부 사진 한 장 — private 버킷이라 열 때마다 짧은 signed URL 을 새로 발급한다 */
export interface AdminInquiryImage {
  id: string;
  displayOrder: number;
  /** 발급에 실패한 장은 null (한 장 때문에 문의 전체를 못 여는 것보다 낫다) */
  url: string | null;
}

export interface AdminInquiryDetail extends AdminInquiryRow {
  images: AdminInquiryImage[];
}

const ROW_SELECT = {
  id: true,
  type: true,
  content: true,
  email: true,
  status: true,
  adminNote: true,
  answeredAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  _count: { select: { images: true } },
} as const;

@Injectable()
export class AdminInquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * 문의 목록 (커서 기반, 최신순).
   *
   * 상태·유형 필터는 각각 `@@index([status, createdAt])` · `@@index([type, createdAt])` 가
   * 커버한다. 사진은 개수만 세어 내려준다 — 목록에서 20건치 signed URL 을 발급하면
   * 열어 보지도 않을 주소를 매번 만들게 된다.
   */
  async list({
    q,
    status,
    type,
    cursor,
    take = DEFAULT_TAKE,
  }: ListAdminInquiriesDto): Promise<AdminInquiryPage> {
    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      // 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면 pg_trgm GIN 을 고려할 것.
      ...(q
        ? {
            OR: [
              { content: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.inquiry.findMany({
      where,
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: ROW_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => toRow(row)),
      nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /** 문의 단건 — 첨부 사진의 읽기 주소를 함께 발급한다 */
  async get(id: string): Promise<AdminInquiryDetail> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      select: {
        ...ROW_SELECT,
        images: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, imagePath: true, displayOrder: true },
        },
      },
    });
    if (!inquiry) throw new NotFoundException('문의를 찾을 수 없습니다.');

    // 사진마다 따로 부르면 요청이 장 수만큼 나간다 — 일괄 발급으로 한 번에 받는다.
    const signed = await this.supabase.createSignedUrls(
      BUCKET.inquiries,
      inquiry.images.map((image) => image.imagePath),
    );

    return {
      ...toRow(inquiry),
      images: inquiry.images.map((image) => ({
        id: image.id,
        displayOrder: image.displayOrder,
        url: signed.get(image.imagePath) ?? null,
      })),
    };
  }

  /**
   * 처리 상태·메모 수정.
   *
   * 답변 시각은 관리자가 따로 적지 않는다 — '답변 완료' 로 바꾼 순간이 곧 회신한 때다.
   * 다시 접수·확인 중으로 되돌리면 비운다 (답변하지 않은 문의에 답변 시각이 남으면 안 된다).
   */
  async update(id: string, dto: UpdateInquiryDto): Promise<AdminInquiryDetail> {
    const current = await this.get(id);
    const status = dto.status ?? current.status;
    const answered = status === InquiryStatus.ANSWERED;

    await this.prisma.inquiry.update({
      where: { id },
      data: {
        ...(dto.status === undefined ? {} : { status: dto.status }),
        // 빈 문자열은 '메모 지우기' 다 (생략은 그대로 두기).
        ...(dto.adminNote === undefined ? {} : { adminNote: dto.adminNote.trim() || null }),
        answeredAt: answered ? (current.answeredAt ?? new Date()) : null,
      },
    });

    return this.get(id);
  }

  /**
   * 문의 삭제 — 첨부 사진도 함께 버린다.
   *
   * 행을 먼저 지우면 사진 경로를 잃어버려 파일이 Storage 에 영영 남는다 (탈퇴 처리와 같은 순서).
   * 사진 삭제가 실패해도 로그만 남고 진행한다 (`removeFrom` 이 예외를 올리지 않는다).
   */
  async remove(id: string): Promise<{ id: string }> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      select: { images: { select: { imagePath: true } } },
    });
    if (!inquiry) throw new NotFoundException('문의를 찾을 수 없습니다.');

    await this.supabase.removeFrom(
      BUCKET.inquiries,
      inquiry.images.map((image) => image.imagePath),
    );
    // inquiry_images 는 FK 의 Cascade 로 함께 지워진다.
    await this.prisma.inquiry.delete({ where: { id } });
    return { id };
  }
}

/** `_count` 를 화면이 쓰는 이름(imageCount)으로 펴 준다 */
function toRow(row: {
  _count: { images: number };
  user: { id: string; name: string; email: string | null };
} & Omit<AdminInquiryRow, 'imageCount' | 'user'>): AdminInquiryRow {
  const { _count, ...rest } = row;
  return { ...rest, imageCount: _count.images };
}
