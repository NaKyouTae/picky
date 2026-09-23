import { api } from '@/lib/api';
import type { Slot } from '@picky/collage';

/**
 * 어드민 콜라주 실험실에서 등록한 템플릿.
 * 칸 좌표(slots)는 `imageWidth`/`imageHeight` 기준 픽셀이라, 화면에 그릴 때 배율 하나만 곱한다.
 */
export type CollageTemplate = {
  id: string;
  title: string;
  /** 사진 자리가 뚫린 합성용 레이어 — 캔버스에 덮어 그리는 데 쓴다 */
  imageUrl: string;
  /**
   * 템플릿 선택 화면에 보여 줄 그림.
   * imageUrl 은 칸이 뚫려 있어 칸이 화면 전체인 템플릿은 전부 투명하다 — 그래서 따로 받는다.
   * (미리보기가 없는 옛 템플릿은 서버가 imageUrl 로 채워 준다)
   */
  previewImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  slots: Slot[];
  slotCount: number;
  /** 유료 템플릿 — 무료 사용자에게 잠금/결제 안내를 붙일 기준 */
  isPaid: boolean;
};

/**
 * 공개된 콜라주 템플릿 전체 (칸이 없는 것은 서버가 걸러 준다).
 * 서버 컴포넌트 전용 — 브라우저는 BFF(`/api/sticker-templates`)로 호출한다.
 */
export async function getCollageTemplates(): Promise<CollageTemplate[]> {
  return api
    .get<CollageTemplate[]>('/sticker-templates', { cache: 'no-store' })
    .catch(() => [] as CollageTemplate[]);
}
