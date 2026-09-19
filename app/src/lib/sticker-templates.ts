/** 서버(NestJS)의 sticker-templates 응답 타입 — 서버/클라이언트 공용 */

/**
 * 템플릿 안의 사진 한 칸.
 * 좌표·크기는 템플릿 이미지 대비 % 이고, **배열 순서가 곧 사진 번호**다 (index 0 = 1번).
 * % 라서 화면 크기가 달라져도 같은 배치로 그려진다.
 */
export type StickerSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 기울기 (deg) */
  rotation: number;
};

export type StickerTemplate = {
  id: string;
  title: string;
  imageUrl: string;
  /** 템플릿 원본 픽셀 크기 — 미리보기 비율의 기준 */
  imageWidth: number;
  imageHeight: number;
  slots: StickerSlot[];
};
