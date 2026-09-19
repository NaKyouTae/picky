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

/**
 * 템플릿 안의 사진 한 칸.
 * 좌표·크기는 모두 템플릿 이미지 대비 % 이고, **배열 순서가 곧 사진 번호**다 (index 0 = 1번).
 */
export type StickerSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 기울기 (deg) */
  rotation: number;
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
  slots: StickerSlot[];
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

/** 한 페이지 크기 — 서버 기본값과 맞춘다 */
export const STICKER_PAGE_SIZE = 20;

/** 한 템플릿에 넣을 수 있는 사진 칸 수 — 서버 DTO 의 MAX_SLOTS 와 맞춘다 */
export const MAX_SLOTS = 12;

/** 업로드 API 응답 */
export type StickerImageUpload = { path: string; url: string };

/** 새 칸을 만들 때 쓰는 최소 크기 (%) — 실수로 점 하나를 찍는 걸 막는다 */
export const MIN_SLOT_SIZE = 3;

/** 슬롯 좌표는 소수점 둘째 자리까지만 — 저장값이 불필요하게 길어지지 않도록 */
export function roundSlotValue(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 0~100 범위를 벗어난 값이 들어오지 않게 자른다 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
