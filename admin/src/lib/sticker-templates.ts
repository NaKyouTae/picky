/** 서버(NestJS)의 admin-sticker-templates 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type StickerTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const STICKER_STATUSES: StickerTemplateStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const STICKER_STATUS_LABELS: Record<StickerTemplateStatus, string> = {
  DRAFT: '작성 중',
  PUBLISHED: '공개',
  ARCHIVED: '보관',
};

export const STICKER_STATUS_STYLES: Record<StickerTemplateStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-gray-100 text-ink-sub',
};

export type AdminStickerTemplate = {
  id: string;
  title: string;
  status: StickerTemplateStatus;
  imageUrl: string;
  /** Storage 경로 — 저장 시 그대로 돌려보낸다 */
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  displayOrder: number;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
};

export type AdminStickerTemplatePage = {
  items: AdminStickerTemplate[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/**
 * 한 번에 불러오는 템플릿 수.
 * 순서를 목록 전체 단위로 다시 매기므로 페이지를 나누지 않고 모두 받는다
 * (서버 DTO 의 take 상한과 맞춘다).
 */
export const STICKER_LIST_LIMIT = 100;

/** 업로드 API 응답 */
export type StickerImageUpload = { path: string; url: string };
