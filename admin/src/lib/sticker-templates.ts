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

/** 템플릿 이용 조건 — 폼의 select 값으로 쓰려고 boolean 을 문자열로 바꿔 둔다 */
export type StickerTemplatePricing = 'FREE' | 'PAID';

export const STICKER_PRICINGS: StickerTemplatePricing[] = ['FREE', 'PAID'];

export const STICKER_PRICING_LABELS: Record<StickerTemplatePricing, string> = {
  FREE: '무료',
  PAID: '유료',
};

export const STICKER_PRICING_STYLES: Record<StickerTemplatePricing, string> = {
  FREE: 'bg-gray-100 text-ink-sub',
  PAID: 'bg-brand-500/10 text-brand-600',
};

export function toPricing(isPaid: boolean): StickerTemplatePricing {
  return isPaid ? 'PAID' : 'FREE';
}

/** 사진이 들어갈 칸 하나 (angle 은 라디안) */
export type StickerSlot = { cx: number; cy: number; w: number; h: number; angle: number };

export type AdminStickerTemplate = {
  id: string;
  title: string;
  status: StickerTemplateStatus;
  imageUrl: string;
  /** 고객용 미리보기 — 없으면(옛 템플릿) imageUrl 로 대신 본다 */
  previewImageUrl: string | null;
  /** Storage 경로 — 저장 시 그대로 돌려보낸다 */
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  /** 사진이 들어갈 칸 — 템플릿 원본 픽셀 기준 */
  slots: StickerSlot[];
  /** slots 길이 — 0 이면 콜라주로 쓸 수 없어 앱 목록에 나오지 않는다 */
  slotCount: number;
  /** 유료 템플릿 여부 — false 면 무료 */
  isPaid: boolean;
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

/** 업로드 가능한 이미지 형식 — 서버(admin-sticker-templates.service)의 허용 목록과 같다 */
export const STICKER_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** 이미지 한 장의 최대 크기 — 서버의 MAX_IMAGE_BYTES 와 같다 (넘으면 413 대신 먼저 막는다) */
export const STICKER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
