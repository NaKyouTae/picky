import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StickerTemplateStatus } from '../generated/prisma/enums';
import { readSlots, type StickerSlot } from './sticker-slot';

export interface PublicStickerTemplate {
  id: string;
  title: string;
  imageUrl: string;
  /** 템플릿 원본 픽셀 크기 — 앱이 미리보기 비율과 합성 캔버스 크기를 잡는 데 쓴다 */
  imageWidth: number;
  imageHeight: number;
  /** 사진 칸 목록. 배열 순서가 곧 사진 번호(1번부터)다 */
  slots: StickerSlot[];
}

const PUBLIC_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  imageWidth: true,
  imageHeight: true,
  slots: true,
} as const;

@Injectable()
export class StickerTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 앱 스티커 탭에 보여 줄 공개 템플릿 전체.
   *
   * 관리자가 직접 등록하는 규모(수십 건)라 커서 페이지네이션 없이 한 번에 내려준다.
   * `@@index([status, displayOrder, createdAt])` 가 필터와 정렬을 그대로 커버한다.
   */
  async listPublished(): Promise<PublicStickerTemplate[]> {
    const rows = await this.prisma.stickerTemplate.findMany({
      where: { status: StickerTemplateStatus.PUBLISHED },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: PUBLIC_SELECT,
    });

    return rows.map((row) => ({ ...row, slots: readSlots(row.slots) }));
  }
}
