import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StickerTemplateStatus } from '../generated/prisma/enums';

/** 사진이 들어갈 칸 하나 — 템플릿 원본 픽셀 기준, angle 은 라디안 */
export interface StickerSlot {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

export interface PublicStickerTemplate {
  id: string;
  title: string;
  imageUrl: string;
  /**
   * 템플릿 선택 화면에 보여 줄 그림. imageUrl 은 칸이 뚫린 합성용 레이어라
   * 칸이 화면 전체인 템플릿은 전부 투명해서 빈 카드로 보인다.
   * 미리보기를 따로 올리지 않은 옛 템플릿은 imageUrl 을 그대로 쓴다.
   */
  previewImageUrl: string;
  /** 템플릿 원본 픽셀 크기 — 앱이 칸 좌표를 화면 배율로 환산하는 기준이다 */
  imageWidth: number;
  imageHeight: number;
  slots: StickerSlot[];
  slotCount: number;
  /** 유료 템플릿 — 앱이 자물쇠/결제 안내를 붙이는 기준 */
  isPaid: boolean;
}

const PUBLIC_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  previewImageUrl: true,
  imageWidth: true,
  imageHeight: true,
  slots: true,
  slotCount: true,
  isPaid: true,
} as const;

@Injectable()
export class StickerTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 앱 콜라주 화면에 보여 줄 공개 템플릿 전체.
   *
   * 칸이 없는 템플릿은 콜라주로 쓸 수 없으므로 내려주지 않는다 (칸 정보가 생기기 전에
   * 등록된 옛 템플릿이 그렇다). 관리자가 직접 등록하는 규모(수십 건)라 커서
   * 페이지네이션 없이 한 번에 준다. 선행 컬럼 status 를
   * `@@index([status, displayOrder, createdAt])` 가 커버하고, slotCount 는 그 안에서 걸러진다.
   */
  async listPublished(): Promise<PublicStickerTemplate[]> {
    const rows = await this.prisma.stickerTemplate.findMany({
      where: { status: StickerTemplateStatus.PUBLISHED, slotCount: { gt: 0 } },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: PUBLIC_SELECT,
    });

    return rows.map(({ previewImageUrl, ...row }) => ({
      ...row,
      // Prisma 의 Json 은 타입이 열려 있어(JsonValue) 응답 형태로 좁혀 준다.
      slots: row.slots as unknown as StickerSlot[],
      previewImageUrl: previewImageUrl ?? row.imageUrl,
    }));
  }
}
